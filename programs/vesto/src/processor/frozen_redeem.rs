use crate::{constant::*, error::*, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{
    burn, thaw_account, transfer_checked, Burn, Mint, ThawAccount, Token, TokenAccount,
    TransferChecked,
};
use governo::state::Governo;

pub fn process_frozen_redeem(ctx: Context<FrozenRedeem>) -> Result<()> {
    // Verify the signer is the freeze authority of the IOU mint
    require_keys_eq!(
        ctx.accounts.iou_mint.freeze_authority.unwrap(),
        ctx.accounts.freeze_authority.key(),
        VestoError::InvalidFreezeAuthority
    );

    // Verify the frozen IOU token account is actually frozen
    // The thaw_account instruction will fail if not frozen, but we check here for clarity
    require!(
        matches!(ctx.accounts.frozen_iou_token.state, anchor_spl::token::spl_token::state::AccountState::Frozen),
        VestoError::TokenAccountNotFrozen
    );

    // Verify the IOU token account's mint matches the pool's IOU mint
    require_keys_eq!(
        ctx.accounts.frozen_iou_token.mint,
        ctx.accounts.pool.iou_mint,
        VestoError::InvalidIouMint
    );

    // Verify the pool's config matches the provided config
    require_keys_eq!(
        ctx.accounts.pool.config,
        ctx.accounts.config.key(),
        VestoError::InvalidConfig
    );

    // Get the amount to redeem (all tokens in the frozen account)
    let amount_to_redeem = ctx.accounts.frozen_iou_token.amount;

    // Thaw the frozen token account
    thaw_account(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        ThawAccount {
            account: ctx.accounts.frozen_iou_token.to_account_info(),
            mint: ctx.accounts.iou_mint.to_account_info(),
            authority: ctx.accounts.freeze_authority.to_account_info(),
        },
    ))?;

    // Reload the token account to get updated state
    ctx.accounts.frozen_iou_token.reload()?;

    // Burn all tokens from the thawed account
    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.iou_mint.to_account_info(),
                from: ctx.accounts.frozen_iou_token.to_account_info(),
                authority: ctx.accounts.freeze_authority.to_account_info(),
            },
        ),
        amount_to_redeem,
    )?;

    // Transfer equivalent amount of gov tokens from vault to the signer
    ctx.accounts.config.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_gov_token.to_account_info(),
                    mint: ctx.accounts.gov_mint.to_account_info(),
                    to: ctx.accounts.freeze_authority_gov_token.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
            )
            .with_signer(&[&signer_seed]),
            amount_to_redeem,
            ctx.accounts.governo.decimals,
        )
    })?;

    Ok(())
}

#[derive(Accounts)]
pub struct FrozenRedeem<'info> {
    /// The freeze authority of the IOU mint (must be the signer)
    #[account(mut)]
    pub freeze_authority: Signer<'info>,

    /// The frozen IOU token account to redeem
    #[account(mut)]
    pub frozen_iou_token: Account<'info, TokenAccount>,

    /// The IOU mint account
    #[account(
        constraint = iou_mint.key() == frozen_iou_token.mint @ VestoError::InvalidIouMint,
        constraint = iou_mint.freeze_authority.is_some() @ VestoError::InvalidFreezeAuthority,
        constraint = iou_mint.freeze_authority.unwrap() == freeze_authority.key() @ VestoError::InvalidFreezeAuthority
    )]
    pub iou_mint: Account<'info, Mint>,

    /// The vesting pool that uses this IOU mint
    #[account(
        constraint = pool.iou_mint == iou_mint.key() @ VestoError::InvalidIouMint
    )]
    pub pool: Account<'info, VestingPool>,

    /// The vesting config associated with this pool
    #[account(
        has_one = governo,
        constraint = config.key() == pool.config @ VestoError::InvalidConfig
    )]
    pub config: Account<'info, VestingConfig>,

    /// The governo account
    #[account(has_one = gov_mint)]
    pub governo: Account<'info, Governo>,

    /// The vault authority PDA (derived from config)
    #[account(
        seeds = [VAULT_AUTHORITY_PREFIX, &config.key().to_bytes()],
        bump = config.authority_bump
    )]
    /// CHECK: OK
    pub vault_authority: UncheckedAccount<'info>,

    /// The vault governance token account (owned by vault_authority)
    #[account(
        mut,
        constraint = vault_gov_token.mint == gov_mint.key() @ VestoError::InvalidGovMint,
        constraint = vault_gov_token.owner == vault_authority.key() @ VestoError::InvalidVaultAuthority
    )]
    pub vault_gov_token: Account<'info, TokenAccount>,

    /// The governance mint ($STB tokens)
    /// CHECK: OK
    pub gov_mint: UncheckedAccount<'info>,

    /// The freeze authority's governance token account (where redeemed tokens will be sent)
    /// CHECK: OK - Token account is validated in the instruction logic
    #[account(mut)]
    pub freeze_authority_gov_token: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
}

