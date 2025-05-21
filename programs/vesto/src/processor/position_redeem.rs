use crate::{constant::*, error::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{burn, transfer_checked, Burn, Token, TokenAccount, TransferChecked};
use governo::state::Governo;

pub fn process_redeem_position(ctx: Context<RedeemPosition>) -> Result<()> {
    let timestamp = Clock::get()?.unix_timestamp;
    require_gte!(timestamp, ctx.accounts.config.initial_unlock_time, VestoError::Locked);

    if let Some(user_iou_token) = &ctx.accounts.user_iou_token {
        assert_eq!(user_iou_token.mint, ctx.accounts.iou_mint.key());

        ctx.accounts.config.total_amount += user_iou_token.amount;
        require_gte!(ctx.accounts.config.total_capacity, ctx.accounts.config.total_amount);

        ctx.accounts.pool.total_amount += user_iou_token.amount;
        ctx.accounts.position.amount += user_iou_token.amount;

        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: user_iou_token.to_account_info(),
                    mint: ctx.accounts.iou_mint.to_account_info(),
                    to: ctx.accounts.position_iou_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            user_iou_token.amount,
            ctx.accounts.governo.decimals,
        )?;
    }

    let initial_amount = u64::try_from(
        ctx.accounts.position.amount as u128 * ctx.accounts.config.initial_unlock_bps as u128 / ONE_IN_BASIS_POINTS,
    )?;

    let vesting_amount = ctx.accounts.position.amount - initial_amount;

    let vested_amount = if timestamp >= ctx.accounts.config.vesting_end_time {
        vesting_amount
    } else if timestamp > ctx.accounts.config.vesting_start_time {
        let mut elapsed_time = timestamp - ctx.accounts.config.vesting_start_time;
        if ctx.accounts.config.release_interval > 1 {
            elapsed_time = elapsed_time / ctx.accounts.config.release_interval * ctx.accounts.config.release_interval;
        }

        u64::try_from(vesting_amount as u128 * elapsed_time as u128 / ctx.accounts.config.vesting_duration as u128)?
    } else {
        0
    };

    let released_amount = initial_amount + vested_amount;

    if released_amount > ctx.accounts.position.claimed {
        let redemption = released_amount - ctx.accounts.position.claimed;

        ctx.accounts.config.total_claimed += redemption;
        ctx.accounts.pool.total_redeemed += redemption;
        ctx.accounts.position.claimed = released_amount;

        ctx.accounts.position.authority_seeds(|signer_seed| {
            burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        from: ctx.accounts.position_iou_token.to_account_info(),
                        mint: ctx.accounts.iou_mint.to_account_info(),
                        authority: ctx.accounts.position.to_account_info(),
                    },
                )
                .with_signer(&[&signer_seed]),
                redemption,
            )
        })?;

        ctx.accounts.config.authority_seeds(|signer_seed| {
            transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.vault_gov_token.to_account_info(),
                        mint: ctx.accounts.gov_mint.to_account_info(),
                        to: ctx.accounts.user_gov_token.to_account_info(),
                        authority: ctx.accounts.vault_authority.to_account_info(),
                    },
                )
                .with_signer(&[&signer_seed]),
                redemption,
                ctx.accounts.governo.decimals,
            )
        })?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct RedeemPosition<'info> {
    pub user: Signer<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub user_gov_token: UncheckedAccount<'info>,
    #[account(mut)]
    pub user_iou_token: Option<Account<'info, TokenAccount>>,

    #[account(mut, has_one = gov_mint)]
    pub governo: Account<'info, Governo>,
    #[account(mut, has_one = governo)]
    pub config: Account<'info, VestingConfig>,
    #[account(mut, has_one = config, has_one = iou_mint)]
    pub pool: Account<'info, VestingPool>,

    #[account(mut, has_one = pool, has_one = user)]
    pub position: Account<'info, VestingPosition>,
    #[account(mut,
        associated_token::mint = iou_mint,
        associated_token::authority = position,
    )]
    pub position_iou_token: Account<'info, TokenAccount>,

    #[account(seeds = [VAULT_AUTHORITY_PREFIX, &config.key().to_bytes()], bump = config.authority_bump)]
    /// CHECK: OK
    pub vault_authority: UncheckedAccount<'info>,
    #[account(mut,
        associated_token::mint = gov_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_gov_token: Account<'info, TokenAccount>,

    /// CHECK: OK
    pub gov_mint: UncheckedAccount<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub iou_mint: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}
