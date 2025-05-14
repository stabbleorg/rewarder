use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CloseGoverno<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin, close = admin)]
    pub governo: Account<'info, Governo>,
}

impl<'info> Validate<'info> for CloseGoverno<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.governo.total_locked_amount, 0);
        assert_eq!(self.governo.total_voting_weight, 0);

        Ok(())
    }
}
