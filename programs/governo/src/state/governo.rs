use anchor_common::located::Located;
use anchor_lang::prelude::*;

#[account]
pub struct Governo {
    /// The administrator who has the authority to manage governance settings.
    /// This account can modify parameters such as voting rules, quorum, and proposals.
    pub admin: Pubkey,

    /// The mint address of the governance token.
    /// This token is used for staking or locking in governance decisions.
    pub gov_mint: Pubkey,

    /// The mint address of the voting power token.
    /// This token represents voting weight and is typically derived from staked governance tokens.
    pub ve_mint: Pubkey,

    pub decimals: u8,

    pub authority_bump: u8,

    pub min_lock_duration: u32,

    pub max_lock_duration: u32,

    pub total_locked_amount: u64,

    pub total_voting_weight: u64,

    pub rewarder: Option<Pubkey>,

    pub padding: [u8; 87],
}

impl Governo {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"governo_authority";
}

pub trait GovernoAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> GovernoAuthority for T
where
    T: Located<Governo>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Governo::AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().authority_bump],
        ])
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MinerUpdatedData {
    pub total_locked_amount: u64,
}

#[event]
pub struct GovernoUpdatedEvent {
    pub pubkey: Pubkey,
    pub data: MinerUpdatedData,
}

pub trait EmitMinerUpdated {
    fn emit_governo_updated(&self);
}

impl<T> EmitMinerUpdated for T
where
    T: Located<Governo>,
{
    fn emit_governo_updated(&self) {
        emit!(GovernoUpdatedEvent {
            pubkey: self.key(),
            data: MinerUpdatedData {
                total_locked_amount: self.as_ref().total_locked_amount,
            },
        });
    }
}
