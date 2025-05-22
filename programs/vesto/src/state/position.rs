use crate::constant::VESTING_POSITION_PREFIX;
use anchor_common::located::Located;
use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account]
pub struct VestingPosition {
    pub pool: Pubkey,
    pub user: Pubkey,

    pub amount: u64,
    pub claimed: u64,

    pub bump: u8,
}

pub trait StakingAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> StakingAuthority for T
where
    T: Located<VestingPosition>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            VESTING_POSITION_PREFIX,
            &self.as_ref().pool.to_bytes(),
            &self.as_ref().user.to_bytes(),
            &[self.as_ref().bump],
        ])
    }
}
