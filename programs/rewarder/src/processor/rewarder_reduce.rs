use crate::state::*;
use anchor_lang::prelude::*;
use crate::processor::UpdateRewarder;

pub fn process_reduce_rewarder_emissions(
    ctx: Context<UpdateRewarder>,
    reduce_amount: u64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;
    ctx.accounts.rewarder.refresh_rewards_per_weight(current_time)?;

    let reduce_amount = std::cmp::min(reduce_amount, ctx.accounts.rewarder.total_rewards);
    ctx.accounts.rewarder.total_rewards = ctx.accounts.rewarder.total_rewards.saturating_sub(reduce_amount);

    ctx.accounts.rewarder.emit_rewarder_updated();
    Ok(())
}