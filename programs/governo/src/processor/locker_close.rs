use crate::{error::GovernoError, state::*};
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn_checked, close_account, transfer_checked, BurnChecked, CloseAccount, Mint, TokenAccount, TokenInterface,
    TransferChecked,
};

pub fn process_close_locker(ctx: Context<CloseLocker>) -> Result<()> {
    ctx.accounts.governo.total_locked_amount -= ctx.accounts.locker.locked_amount;
    ctx.accounts.governo.total_voting_weight -= ctx.accounts.locker.voting_weight;
    ctx.accounts.governo.emit_governo_updated();

    ctx.accounts.locker.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.locker_gov_token.to_account_info(),
                    mint: ctx.accounts.gov_mint.to_account_info(),
                    to: ctx.accounts.user_gov_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.locked_amount,
            ctx.accounts.gov_mint.decimals,
        )?;

        let remaining_amount = ctx.accounts.locker_gov_token.amount - ctx.accounts.locker.locked_amount;
        if remaining_amount > 0 {
            burn_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    BurnChecked {
                        mint: ctx.accounts.gov_mint.to_account_info(),
                        from: ctx.accounts.locker_gov_token.to_account_info(),
                        authority: ctx.accounts.locker_authority.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                remaining_amount,
                ctx.accounts.gov_mint.decimals,
            )?;
        }

        close_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.locker_gov_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                    destination: ctx.accounts.user.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
        )?;

        burn_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                BurnChecked {
                    mint: ctx.accounts.ve_mint.to_account_info(),
                    from: ctx.accounts.locker_ve_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker_ve_token.amount,
            ctx.accounts.ve_mint.decimals,
        )?;

        close_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.locker_ve_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                    destination: ctx.accounts.user.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
        )
    })
}

#[derive(Accounts)]
pub struct CloseLocker<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut,
        associated_token::mint = gov_mint,
        associated_token::authority = user,
    )]
    pub user_gov_token: InterfaceAccount<'info, TokenAccount>,

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

    #[account(mut)]
    pub gov_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub ve_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, close = user, has_one = user, has_one = governo)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump = locker.authority_bump)]
    pub locker_authority: UncheckedAccount<'info>,

    #[account(mut, has_one = gov_mint, has_one = ve_mint)]
    pub governo: Account<'info, Governo>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Validate<'info> for CloseLocker<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.ve_mint.to_account_info().owner.key(), self.token_program.key());

        require_gte!(
            self.locker_ve_token.amount,
            self.locker.voting_weight,
            GovernoError::VotingWeightInsufficient,
        );
        require_gte!(
            Clock::get()?.unix_timestamp,
            self.locker.unlocks_at,
            GovernoError::LockerActive
        );

        Ok(())
    }
}
