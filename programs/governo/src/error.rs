use anchor_lang::prelude::*;

#[error_code]
pub enum GovernoError {
    #[msg("The minimum required lock duration has not been reached")]
    MinLockDuration,

    #[msg("The specified lock duration exceeds the maximum allowed limit")]
    MaxLockDuration,

    #[msg("The locker is currently active and cannot be closed at this time")]
    LockerActive,

    #[msg("The locker has expired and is no longer valid for use")]
    LockerExpired,

    #[msg("You do not have enough vote-escrowed tokens to unlock")]
    VotingWeightInsufficient,

    #[msg("Your voting weight has already been refunded")]
    VotingWeightAlreadyRefunded,

    #[msg("Your voting weight has already been used")]
    VotingWeightAlreadyUsed,

    #[msg("Realm is not valid")]
    InvalidRealm,
}
