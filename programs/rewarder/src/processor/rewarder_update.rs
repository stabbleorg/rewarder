use crate::state::*;
use anchor_lang::prelude::*;

pub fn process_update_rewarder(
    ctx: Context<UpdateRewarder>,
    total_rewards: u64,
    epoch_starts_at: i64,
    epoch_ends_at: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;

    require_gt!(epoch_starts_at, current_time);
    require_gt!(epoch_ends_at, epoch_starts_at);

    if current_time > ctx.accounts.rewarder.last_updated_at {
        ctx.accounts.rewarder.refresh_rewards_per_weight(current_time)?;

        if current_time >= ctx.accounts.rewarder.epoch_ends_at {
            ctx.accounts.rewarder.cumulative_rewards += ctx.accounts.rewarder.total_rewards;
        } else {
            let rewards_distributed = u64::try_from(
                ctx.accounts.rewarder.total_rewards as u128
                    * (current_time - ctx.accounts.rewarder.epoch_starts_at) as u128
                    / ctx.accounts.rewarder.epoch_duration as u128,
            )
            .unwrap();
            ctx.accounts.rewarder.cumulative_rewards += rewards_distributed;
        }

        ctx.accounts.rewarder.epoch_index += 1;
    }

    ctx.accounts.rewarder.total_rewards = total_rewards;
    ctx.accounts.rewarder.epoch_starts_at = epoch_starts_at;
    ctx.accounts.rewarder.epoch_ends_at = epoch_ends_at;
    ctx.accounts.rewarder.epoch_duration = epoch_ends_at - epoch_starts_at;
    ctx.accounts.rewarder.last_updated_at = epoch_starts_at;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateRewarder<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = admin)]
    pub rewarder: Account<'info, Rewarder>,
}
