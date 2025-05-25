use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{close_account, transfer_checked, CloseAccount, Mint, TokenAccount, TransferChecked};

pub fn process_close_rewarder(ctx: Context<CloseRewarder>) -> Result<()> {
    ctx.accounts.rewarder.authority_seeds(|signer_seed| {
        if ctx.accounts.rewarder_token.amount > 0 {
            transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.rewarder_token.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        to: ctx.accounts.user_token.to_account_info(),
                        authority: ctx.accounts.rewarder_authority.to_account_info(),
                    },
                )
                .with_signer(&[&signer_seed]),
                ctx.accounts.rewarder_token.amount,
                ctx.accounts.mint.decimals,
            )?;
        }

        close_account(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.rewarder_token.to_account_info(),
                    destination: ctx.accounts.admin.to_account_info(),
                    authority: ctx.accounts.rewarder_authority.to_account_info(),
                },
            )
            .with_signer(&[&signer_seed]),
        )
    })
}

#[derive(Accounts)]
pub struct CloseRewarder<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin, close = admin)]
    pub rewarder: Account<'info, Rewarder>,

    /// CHECK: OK
    #[account(seeds = [Rewarder::AUTHORITY_PREFIX, &rewarder.key().to_bytes()], bump = rewarder.authority_bump)]
    pub rewarder_authority: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: OK
    #[account(mut)]
    pub user_token: UncheckedAccount<'info>,

    #[account(mut,
        associated_token::mint = rewarder.mint,
        associated_token::authority = rewarder_authority,
    )]
    pub rewarder_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for CloseRewarder<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.rewarder.num_pools, 0);
        assert_eq!(self.rewarder.total_weights, 0);
        assert_eq!(self.token_program.key(), self.user_token.owner.key());

        Ok(())
    }
}
