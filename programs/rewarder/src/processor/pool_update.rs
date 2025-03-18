use crate::state::*;
use anchor_lang::prelude::*;

pub fn process_update_pool(ctx: Context<UpdatePool>, weight: u32) -> Result<()> {
    assert_ne!(weight, ctx.accounts.pool.weight);

    ctx.accounts.pool.weight = weight;

    let current_time = Clock::get()?.unix_timestamp;

    if current_time > ctx.accounts.rewarder.last_updated_at {
        ctx.accounts.rewarder.refresh_rewards_per_weight(current_time)?;

        ctx.accounts
            .pool
            .refresh_rewards_per_amount(ctx.accounts.rewarder.rewards_per_weight)?;
    }

    let total_weights = weight as u128 * ctx.accounts.pool.total_amount as u128;

    if total_weights > ctx.accounts.pool.total_weights {
        let weights = total_weights - ctx.accounts.pool.total_weights;

        if ctx.accounts.rewarder.rewards_per_weight > 0 {
            ctx.accounts.pool.total_rewards_debt += u64::try_from(
                ctx.accounts.rewarder.rewards_per_weight * weights / Rewarder::REWARDS_PER_WEIGHT_PRECISION + 1,
            )
            .unwrap();
        }

        ctx.accounts.rewarder.total_weights += weights;
        ctx.accounts.pool.total_weights = total_weights;
    } else {
        let weights = ctx.accounts.pool.total_weights - total_weights;

        if ctx.accounts.rewarder.rewards_per_weight > 0 {
            ctx.accounts.pool.total_rewards_credit += u64::try_from(
                ctx.accounts.rewarder.rewards_per_weight * weights / Rewarder::REWARDS_PER_WEIGHT_PRECISION,
            )
            .unwrap();
        }

        ctx.accounts.rewarder.total_weights -= weights;
        ctx.accounts.pool.total_weights = total_weights;
    }

    ctx.accounts.pool.emit_pool_updated();
    ctx.accounts.rewarder.emit_rewards_per_weight_updated();

    Ok(())
}

#[derive(Accounts)]
pub struct UpdatePool<'info> {
    pub admin: Signer<'info>,

    #[account(mut, has_one = rewarder)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = admin)]
    pub rewarder: Account<'info, Rewarder>,
}
