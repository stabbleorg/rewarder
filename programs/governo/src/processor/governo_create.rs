use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

pub fn process_create_governo(
    ctx: Context<CreateGoverno>,
    min_lock_duration: u32,
    max_lock_duration: u32,
) -> Result<()> {
    require_gt!(min_lock_duration, 0);
    require_gt!(max_lock_duration, min_lock_duration);

    ctx.accounts.governo.set_inner(Governo {
        admin: ctx.accounts.admin.key(),
        gov_mint: ctx.accounts.gov_mint.key(),
        ve_mint: ctx.accounts.ve_mint.key(),
        decimals: ctx.accounts.gov_mint.decimals,
        authority_bump: ctx.bumps.governo_authority,
        min_lock_duration,
        max_lock_duration,
        total_locked_amount: 0,
        total_voting_weight: 0,
        rewarder: None,
        realm: None,
        padding: [0; 54],
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateGoverno<'info> {
    pub admin: Signer<'info>,

    pub gov_mint: Account<'info, Mint>,

    pub ve_mint: Account<'info, Mint>,

    #[account(zero, rent_exempt = enforce)]
    pub governo: Account<'info, Governo>,

    /// CHECK: OK
    #[account(seeds = [Governo::AUTHORITY_PREFIX, &governo.key().to_bytes()], bump)]
    pub governo_authority: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for CreateGoverno<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(
            self.ve_mint.to_account_info().owner.key(),
            self.gov_mint.to_account_info().owner.key()
        );

        assert_eq!(self.ve_mint.decimals, self.gov_mint.decimals);
        assert_eq!(self.ve_mint.supply, 0);
        assert_eq!(self.ve_mint.mint_authority.unwrap(), self.governo_authority.key());
        assert_eq!(self.ve_mint.freeze_authority.unwrap(), self.governo_authority.key());

        Ok(())
    }
}
