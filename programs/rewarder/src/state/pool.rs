use super::Rewarder;
use anchor_lang::prelude::*;

#[account]
pub struct Pool {
    /// Reference to the [Rewarder] that this pool belongs to.
    pub rewarder: Pubkey,

    /// The mint of the token that users stake in this pool.
    pub mint: Pubkey,

    pub decimals: u8,

    /// Weight multiplier for the pool.
    pub weight: u32,

    /// Total amount of tokens staked in the pool.
    pub total_amount: u64,

    ///
    pub total_rewards_debt: u64,

    ///
    pub total_rewards_credit: u64,

    ///
    pub total_rewards_distributed: u64,

    ///
    pub total_weights: u128,

    ///
    pub rewards_per_amount: u128,

    /// Number of active miners (stakers) in this pool.
    pub num_miners: u32,
}

impl Pool {
    pub const REWARDS_PER_AMOUNT_PRECISION: u128 = 1_000_000_000;

    pub fn refresh_rewards_per_amount(&mut self, rewards_per_weight: u128) -> Result<()> {
        if self.total_amount > 0 {
            let rewards_distributed = rewards_per_weight * self.total_weights / Rewarder::REWARDS_PER_WEIGHT_PRECISION
                + self.total_rewards_credit as u128
                - self.total_rewards_debt as u128;
            let rewards_per_amount = (rewards_distributed - self.total_rewards_distributed as u128)
                * Pool::REWARDS_PER_AMOUNT_PRECISION
                / self.total_amount as u128;

            self.rewards_per_amount += rewards_per_amount;
            self.total_rewards_distributed = u64::try_from(rewards_distributed).unwrap();
        }

        Ok(())
    }
}
