use crate::state::*;
use anchor_common::{token::is_supported_mint, validate::Validate};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

pub fn process_create_governo(
    ctx: Context<CreateGoverno>,
    min_lock_duration: u32,
    max_lock_duration: u32,
) -> Result<()> {
    require_gt!(min_lock_duration, 0);
    require_eq!(max_lock_duration, min_lock_duration);

    ctx.accounts.governo.set_inner(Governo {
        admin: ctx.accounts.admin.key(),
        gov_mint: ctx.accounts.gov_mint.key(),
        ve_mint: ctx.accounts.ve_mint.key(),
        authority_bump: ctx.bumps.governo_authority,
        min_lock_duration,
        max_lock_duration,
        total_locked_amount: 0,
        padding: [0; 128],
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateGoverno<'info> {
    pub admin: Signer<'info>,

    pub gov_mint: InterfaceAccount<'info, Mint>,

    pub ve_mint: InterfaceAccount<'info, Mint>,

    #[account(zero, rent_exempt = enforce)]
    pub governo: Account<'info, Governo>,

    /// CHECK: OK
    #[account(seeds = [Governo::AUTHORITY_PREFIX, &governo.key().to_bytes()], bump)]
    pub governo_authority: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for CreateGoverno<'info> {
    fn validate(&self) -> Result<()> {
        assert!(is_supported_mint(&self.gov_mint).unwrap());
        assert!(is_supported_mint(&self.ve_mint).unwrap());

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
