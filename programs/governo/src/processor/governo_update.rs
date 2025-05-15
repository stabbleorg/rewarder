use crate::state::*;
use anchor_lang::prelude::*;
use rewarder::{state::Rewarder, ID as REWARDER_PROGRAM_ID};

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

#[derive(Accounts)]
pub struct UpdateGoverno<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub governo: Account<'info, Governo>,
}
