use crate::{error::GovernoError, state::*};
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn_checked, close_account, BurnChecked, CloseAccount, Mint, TokenAccount, TokenInterface,
};

pub fn process_force_close_locker(ctx: Context<ForceCloseLocker>) -> Result<()> {
    ctx.accounts.governo.total_locked_amount -= ctx.accounts.locker.locked_amount;
    ctx.accounts.governo.emit_governo_updated();

    ctx.accounts.locker.authority_seeds(|signer_seed| {
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
            ctx.accounts.locker_gov_token.amount,
            ctx.accounts.gov_mint.decimals,
        )?;

        close_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.locker_gov_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                    destination: ctx.accounts.bot.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
        )?;

        if ctx.accounts.locker_ve_token.amount > 0 {
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
        }

        close_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.locker_ve_token.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                    destination: ctx.accounts.bot.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
        )
    })
}

#[derive(Accounts)]
pub struct ForceCloseLocker<'info> {
    #[account(mut)]
    pub bot: Signer<'info>,

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

    #[account(mut, close = bot, has_one = governo)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump = locker.authority_bump)]
    pub locker_authority: UncheckedAccount<'info>,

    #[account(mut, has_one = gov_mint, has_one = ve_mint)]
    pub governo: Account<'info, Governo>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> Validate<'info> for ForceCloseLocker<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.ve_mint.to_account_info().owner.key(), self.token_program.key());
        assert_ne!(self.locker.voting_weight, 0);
        assert_eq!(self.locker.voting_weight, self.locker.voting_weight_used);

        require_gte!(
            Clock::get()?.unix_timestamp,
            self.locker.unlocks_at,
            GovernoError::LockerActive
        );

        Ok(())
    }
}
