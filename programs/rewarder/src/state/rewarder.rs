use anchor_common::located::Located;
use anchor_lang::prelude::*;

#[account]
pub struct Rewarder {
    /// The admin authority that can manage the epoch rewards and to add new pools.
    pub admin: Pubkey,

    /// The mint of the token that will be distributed as rewards.
    pub mint: Pubkey,

    pub decimals: u8,

    /// Bump seed for the PDA that holds the reward tokens.
    pub authority_bump: u8,

    /// Total rewards distributed historically since inception until last epoch.
    pub cumulative_rewards: u64,

    /// Total rewards allocated for the current epoch.
    pub total_rewards: u64,

    pub total_rewards_claimed: u64,

    /// The sum of all pool weights; used to compute reward distribution across pools.
    pub total_weights: u128,

    /// Cumulative rewards per unit weight; updated over time as rewards are accrued.
    pub rewards_per_weight: u128,

    /// The number of pools registered under this Rewarder.
    pub num_pools: u32,

    /// Index of current epoch.
    pub epoch_index: u32,

    /// Unix timestamp marking the start of the current epoch.
    pub epoch_starts_at: i64,

    /// Unix timestamp marking the end of the current epoch.
    pub epoch_ends_at: i64,

    ///
    pub epoch_duration: i64,

    /// Unix timestamp of the last update to the reward distribution.
    pub last_updated_at: i64,

    /// Optional reference to a parent [Rewarder]. If set, this rewarder acts as a child in a double reward mechanism,
    /// where rewards accrued here may be re-staked into the parent rewarder for additional reward accumulation.
    pub parent_rewarder: Option<Pubkey>,
}

impl Rewarder {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"rewarder_authority";

    pub const REWARDS_PER_WEIGHT_PRECISION: u128 = 1_000_000_000;

    pub fn refresh_rewards_per_weight(&mut self, current_time: i64) -> Result<()> {
        let (elapsed_time, last_updated_at) = if current_time >= self.epoch_ends_at {
            (self.epoch_ends_at - self.last_updated_at, self.epoch_ends_at)
        } else {
            (current_time - self.last_updated_at, current_time)
        };

        if self.total_weights > 0 {
            let rewards_accrued = self.total_rewards as u128 * elapsed_time as u128 / self.epoch_duration as u128;
            let rewards_per_weight = rewards_accrued * Rewarder::REWARDS_PER_WEIGHT_PRECISION / self.total_weights;

            self.rewards_per_weight += rewards_per_weight;
            self.last_updated_at = last_updated_at;
        }

        Ok(())
    }
}

pub trait RewarderAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> RewarderAuthority for T
where
    T: Located<Rewarder>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Rewarder::AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().authority_bump],
        ])
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RewarderUpdatedData {
    pub cumulative_rewards: u64,
    pub total_rewards: u64,
    pub rewards_per_weight: u128,
    pub epoch_index: u32,
    pub epoch_starts_at: i64,
    pub epoch_ends_at: i64,
    pub epoch_duration: i64,
    pub last_updated_at: i64,
}

#[event]
pub struct RewarderUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: RewarderUpdatedData,
}

pub trait EmitRewarderUpdated {
    fn emit_rewarder_updated(&self);
}

impl<T> EmitRewarderUpdated for T
where
    T: Located<Rewarder>,
{
    fn emit_rewarder_updated(&self) {
        emit!(RewarderUpdatedEvent {
            pubkey: self.key(),
            data: RewarderUpdatedData {
                cumulative_rewards: self.as_ref().cumulative_rewards,
                total_rewards: self.as_ref().total_rewards,
                rewards_per_weight: self.as_ref().rewards_per_weight,
                epoch_index: self.as_ref().epoch_index,
                epoch_starts_at: self.as_ref().epoch_starts_at,
                epoch_ends_at: self.as_ref().epoch_ends_at,
                epoch_duration: self.as_ref().epoch_duration,
                last_updated_at: self.as_ref().last_updated_at,
            },
        });
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct RewardsPerWeightUpdatedData {
    pub total_rewards_claimed: u64,
    pub total_weights: u128,
    pub rewards_per_weight: u128,
    pub last_updated_at: i64,
}

#[event]
pub struct RewardsPerWeightUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: RewardsPerWeightUpdatedData,
}

pub trait EmitRewardsPerWeightUpdatedEvent {
    fn emit_rewards_per_weight_updated(&self);
}

impl<T> EmitRewardsPerWeightUpdatedEvent for T
where
    T: Located<Rewarder>,
{
    fn emit_rewards_per_weight_updated(&self) {
        emit!(RewardsPerWeightUpdatedEvent {
            pubkey: self.key(),
            data: RewardsPerWeightUpdatedData {
                total_rewards_claimed: self.as_ref().total_rewards_claimed,
                total_weights: self.as_ref().total_weights,
                rewards_per_weight: self.as_ref().rewards_per_weight,
                last_updated_at: self.as_ref().last_updated_at,
            },
        });
    }
}
