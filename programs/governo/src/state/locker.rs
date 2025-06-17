use anchor_common::located::Located;
use anchor_lang::prelude::*;

#[account]
pub struct Locker {
    /// The `Governo` this locker is associated with.
    pub governo: Pubkey,

    /// The voter's authority (wallet that locked tokens).
    pub user: Pubkey,

    /// Bump seed for the PDA that holds the voter's locked tokens.
    pub authority_bump: u8,

    /// The total amount of tokens locked by the voter.
    pub locked_amount: u64,

    /// The voter's effective voting power, calculated based on lock duration and amount.
    pub voting_weight: u64,

    /// The amount of voting power already used in proposals.
    pub voting_weight_used: u64,

    /// UNIX timestamp (UTC) when the tokens are locked.
    pub locked_at: i64,

    /// UNIX timestamp (UTC) when the locked tokens become withdrawable.
    pub unlocks_at: i64,
}

impl Locker {
    pub const AUTHORITY_PREFIX: &'static [u8] = b"locker_authority";
}

pub trait LockerAuthority {
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R;
}

impl<T> LockerAuthority for T
where
    T: Located<Locker>,
{
    fn authority_seeds<R, F: FnOnce(&[&[u8]]) -> R>(&self, f: F) -> R {
        f(&[
            Locker::AUTHORITY_PREFIX,
            &self.key().to_bytes(),
            &[self.as_ref().authority_bump],
        ])
    }
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct LockerCreatedData {
    pub governo: Pubkey,
    pub user: Pubkey,
    pub locked_amount: u64,
    pub voting_weight: u64,
    pub voting_weight_used: u64,
    pub locked_at: i64,
    pub unlocks_at: i64,
}

#[event]
pub struct LockerCreatedEvent {
    pub pubkey: Pubkey,
    pub data: LockerCreatedData,
}

pub trait EmitLockerCreated {
    fn emit_locker_created(&self);
}

impl<T> EmitLockerCreated for T
where
    T: Located<Locker>,
{
    fn emit_locker_created(&self) {
        emit!(LockerCreatedEvent {
            pubkey: self.key(),
            data: LockerCreatedData {
                governo: self.as_ref().governo,
                user: self.as_ref().user,
                locked_amount: self.as_ref().locked_amount,
                voting_weight: self.as_ref().voting_weight,
                voting_weight_used: self.as_ref().voting_weight_used,
                locked_at: self.as_ref().locked_at,
                unlocks_at: self.as_ref().unlocks_at,
            },
        });
    }
}
