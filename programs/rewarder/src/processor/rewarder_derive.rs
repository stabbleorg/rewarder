use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;

pub fn process_derive_rewarder(ctx: Context<DeriveRewarder>) -> Result<()> {
    ctx.accounts.rewarder.parent_rewarder = Some(ctx.accounts.parent_rewarder.key());

    Ok(())
}

#[derive(Accounts)]
pub struct DeriveRewarder<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub rewarder: Account<'info, Rewarder>,

    pub parent_rewarder: Account<'info, Rewarder>,
}

impl<'info> Validate<'info> for DeriveRewarder<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.rewarder.total_weights, 0);
        assert_ne!(self.rewarder.key(), self.parent_rewarder.key());

        if self.rewarder.parent_rewarder.is_some() {
            assert_ne!(self.rewarder.parent_rewarder.unwrap(), self.parent_rewarder.key());
        }

        Ok(())
    }
}
