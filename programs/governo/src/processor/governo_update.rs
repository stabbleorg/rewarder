use crate::state::*;
use anchor_lang::prelude::*;
use rewarder::{state::Rewarder, ID as REWARDER_PROGRAM_ID};
use spl_governance::ID as SPL_GOVERNANCE_ID;

pub fn process_update_rewarder<'a, 'b, 'c, 'info>(
    ctx: Context<'_, '_, 'info, 'info, UpdateGoverno<'info>>,
) -> Result<()> {
    if ctx.remaining_accounts.len() == 0 {
        ctx.accounts.governo.rewarder = None;
    } else {
        let rewarder_account_info = &ctx.remaining_accounts[0];
        assert_eq!(rewarder_account_info.owner.key(), REWARDER_PROGRAM_ID);

        let data = rewarder_account_info.try_borrow_data()?;
        assert_eq!(data[..8], *Rewarder::DISCRIMINATOR);

        ctx.accounts.governo.rewarder = Some(rewarder_account_info.key());
    }

    Ok(())
}

pub fn process_update_realm<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, 'info, 'info, UpdateGoverno<'info>>) -> Result<()> {
    if ctx.remaining_accounts.len() == 0 {
        ctx.accounts.governo.realm = None;
    } else {
        let realm_account_info = &ctx.remaining_accounts[0];
        assert_eq!(realm_account_info.owner.key(), SPL_GOVERNANCE_ID);

        // TODO: validate discriminator
        // let data = realm_account_info.try_borrow_data()?;
        // assert_eq!(data[..1], *RealmV2::DISCRIMINATOR);

        ctx.accounts.governo.realm = Some(realm_account_info.key());
    }

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateGoverno<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub governo: Account<'info, Governo>,
}
