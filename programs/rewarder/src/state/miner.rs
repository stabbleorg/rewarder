use anchor_common::located::Located;
use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Miner {
    /// Reference to the [Pool] where this miner is staking tokens.
    pub pool: Pubkey,

    /// The authority (owner) address that controls this miner account and its staked tokens.
    pub authority: Pubkey,

    pub beneficiary: Pubkey,

    /// Bump seed
    pub bump: u8,

    /// The amount of tokens the miner has staked.
    pub amount: u64,

    /// The accumulated rewards debt. This value is used in the rewards calculation formula to avoid double counting.
    pub rewards_debt: u64,

    /// The total rewards credit. This value is used in the rewards calculation formula to account rewards for withdrawn amounts.
    pub rewards_credit: u64,

    /// The total rewards that the miner has claimed so far.
    pub rewards_claimed: u64,
}

impl Miner {
    pub const PREFIX: &'static [u8] = b"miner";
}

pub trait MinerAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> MinerAuthority for T
where
    T: Located<Miner>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Miner::PREFIX,
            &self.as_ref().authority.to_bytes(),
            &self.as_ref().pool.to_bytes(),
            &[self.as_ref().bump],
        ])
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MinerUpdatedData {
    pub amount: u64,
    pub rewards_debt: u64,
    pub rewards_credit: u64,
    pub rewards_claimed: u64,
}

#[event]
pub struct MinerUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: MinerUpdatedData,
}

pub trait EmitMinerUpdated {
    fn emit_miner_updated(&self);
}

impl<T> EmitMinerUpdated for T
where
    T: Located<Miner>,
{
    fn emit_miner_updated(&self) {
        emit!(MinerUpdatedEvent {
            pubkey: self.key(),
            data: MinerUpdatedData {
                amount: self.as_ref().amount,
                rewards_debt: self.as_ref().rewards_debt,
                rewards_credit: self.as_ref().rewards_credit,
                rewards_claimed: self.as_ref().rewards_claimed,
            },
        });
    }
}
