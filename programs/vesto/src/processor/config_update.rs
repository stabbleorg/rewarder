use crate::state::*;
use anchor_lang::prelude::*;
use governo::state::Governo;

pub fn process_update_vesting_period(
    ctx: Context<UpdateConfig>,
    initial_unlock_time: i64,
    vesting_start_time: i64,
    vesting_end_time: i64,
) -> Result<()> {
    ctx.accounts.config.initial_unlock_time = initial_unlock_time;
    ctx.accounts.config.vesting_start_time = vesting_start_time;
    ctx.accounts.config.vesting_end_time = vesting_end_time;
    ctx.accounts.config.vesting_duration = vesting_end_time - vesting_start_time;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(has_one = admin)]
    pub governo: Account<'info, Governo>,

    #[account(mut, has_one = governo)]
    pub config: Account<'info, VestingConfig>,
}
