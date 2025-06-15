use crate::{error::GovernoError, state::*};
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked};

pub fn process_deposit_voting_weight(ctx: Context<UpdateVotingWeight>) -> Result<()> {
    require_eq!(
        ctx.accounts.locker.voting_weight_used,
        ctx.accounts.locker.voting_weight,
        GovernoError::VotingWeightAlreadyRefunded,
    );

    ctx.accounts.locker.voting_weight_used = 0;

    ctx.accounts.governo.total_voting_weight += ctx.accounts.locker.voting_weight;
    ctx.accounts.governo.emit_governo_updated();

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_ve_token.to_account_info(),
                mint: ctx.accounts.ve_mint.to_account_info(),
                to: ctx.accounts.locker_ve_token.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        ctx.accounts.locker.voting_weight,
        ctx.accounts.ve_mint.decimals,
    )
}

pub fn process_withdraw_voting_weight(ctx: Context<UpdateVotingWeight>) -> Result<()> {
    require_gt!(
        ctx.accounts.locker.unlocks_at,
        Clock::get()?.unix_timestamp,
        GovernoError::LockerExpired
    );
    require_eq!(
        ctx.accounts.locker.voting_weight_used,
        0,
        GovernoError::VotingWeightAlreadyUsed,
    );

    ctx.accounts.locker.voting_weight_used = ctx.accounts.locker.voting_weight;

    ctx.accounts.governo.total_voting_weight -= ctx.accounts.locker.voting_weight;
    ctx.accounts.governo.emit_governo_updated();

    ctx.accounts.locker.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.locker_ve_token.to_account_info(),
                    mint: ctx.accounts.ve_mint.to_account_info(),
                    to: ctx.accounts.user_ve_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.voting_weight,
            ctx.accounts.ve_mint.decimals,
        )
    })
}

#[derive(Accounts)]
pub struct UpdateVotingWeight<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut,
        associated_token::mint = ve_mint,
        associated_token::authority = authority,
    )]
    pub user_ve_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = ve_mint,
        associated_token::authority = locker_authority,
    )]
    pub locker_ve_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub ve_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, has_one = authority, has_one = governo)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump = locker.authority_bump)]
    pub locker_authority: UncheckedAccount<'info>,

    #[account(mut, has_one = ve_mint)]
    pub governo: Account<'info, Governo>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Validate<'info> for UpdateVotingWeight<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.ve_mint.to_account_info().owner.key(), self.token_program.key());
        assert_ne!(self.locker.voting_weight, 0);

        Ok(())
    }
}
