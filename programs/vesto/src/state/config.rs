use crate::constant::VAULT_AUTHORITY_PREFIX;
use anchor_common::located::Located;
use anchor_lang::prelude::*;

#[account]
pub struct VestingConfig {
    pub governo: Pubkey,
    pub authority_bump: u8,

    pub initial_unlock_time: i64,
    pub vesting_start_time: i64,
    pub vesting_end_time: i64,
    pub vesting_duration: i64,
    pub release_interval: i64,

    pub initial_unlock_bps: u16,
    pub total_capacity: u64,
    pub total_amount: u64,
    pub total_claimed: u64,

    pub active_pools: u32,
}

pub trait VaultAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> VaultAuthority for T
where
    T: Located<VestingConfig>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            VAULT_AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().authority_bump],
        ])
    }
}
