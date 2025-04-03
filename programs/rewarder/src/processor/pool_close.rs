use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;

pub fn process_close_pool(ctx: Context<ClosePool>) -> Result<()> {
    ctx.accounts.rewarder.num_pools -= 1;

    Ok(())
}

#[derive(Accounts)]
pub struct ClosePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut, has_one = rewarder, close = admin)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = admin)]
    pub rewarder: Account<'info, Rewarder>,
}

impl<'info> Validate<'info> for ClosePool<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.pool.num_miners, 0);
        assert_eq!(self.pool.weight, 0);
        assert_eq!(self.pool.total_amount, 0);

        Ok(())
    }
}
