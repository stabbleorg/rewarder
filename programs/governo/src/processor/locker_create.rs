use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    mint_to_checked, transfer_checked, Mint, MintToChecked, TokenAccount, TransferChecked,
};
use math::fixed_math::{FixedDiv, FixedMul, FixedPow};

const MULTIPLIER_BASE: u64 = 1_050_000_000;

pub fn process_create_locker(ctx: Context<CreateLocker>, amount: u64, duration: u32) -> Result<()> {
    require_gte!(duration, ctx.accounts.governo.min_lock_duration);
    require_gte!(ctx.accounts.governo.max_lock_duration, duration);

    // amount * 1.05 ^ n
    let ve_amount = amount
        .mul_down(
            MULTIPLIER_BASE
                .pow_down(
                    (duration as u64)
                        .div_down(ctx.accounts.governo.min_lock_duration as u64)
                        .unwrap(),
                )
                .unwrap(),
        )
        .unwrap();

    ctx.accounts.governo.total_locked_amount += amount;
    ctx.accounts.governo.emit_governo_updated();

    let timestamp = Clock::get()?.unix_timestamp;

    ctx.accounts.locker.set_inner(Locker {
        governo: ctx.accounts.governo.key(),
        authority: ctx.accounts.user.key(),
        authority_bump: ctx.bumps.locker_authority,
        locked_amount: amount,
        voting_weight: ve_amount,
        voting_weight_used: 0,
        locked_at: timestamp,
        unlocks_at: timestamp + duration as i64,
    });

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_gov_token.to_account_info(),
                mint: ctx.accounts.gov_mint.to_account_info(),
                to: ctx.accounts.locker_gov_token.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.gov_mint.decimals,
    )?;

    ctx.accounts.governo.authority_seeds(|signer_seed| {
        mint_to_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintToChecked {
                    mint: ctx.accounts.ve_mint.to_account_info(),
                    to: ctx.accounts.locker_ve_token.to_account_info(),
                    authority: ctx.accounts.governo_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ve_amount,
            ctx.accounts.ve_mint.decimals,
        )
    })
}

#[derive(Accounts)]
pub struct CreateLocker<'info> {
    pub user: Signer<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_gov_token: UncheckedAccount<'info>,

    #[account(mut,
        associated_token::mint = gov_mint,
        associated_token::authority = locker_authority,
    )]
    pub locker_gov_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = ve_mint,
        associated_token::authority = locker_authority,
    )]
    pub locker_ve_token: InterfaceAccount<'info, TokenAccount>,

    pub gov_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub ve_mint: InterfaceAccount<'info, Mint>,

    #[account(zero, rent_exempt = enforce)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump)]
    pub locker_authority: UncheckedAccount<'info>,

    #[account(mut, has_one = gov_mint, has_one = ve_mint)]
    pub governo: Account<'info, Governo>,

    /// CHECK: OK
    #[account(seeds = [Governo::AUTHORITY_PREFIX, &governo.key().to_bytes()], bump = governo.authority_bump)]
    pub governo_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for CreateLocker<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.ve_mint.to_account_info().owner.key(), self.token_program.key());

        Ok(())
    }
}
