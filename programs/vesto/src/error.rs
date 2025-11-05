use anchor_lang::prelude::*;

#[error_code]
pub enum VestoError {
    #[msg("The vesting contract has not unlocked yet")]
    Locked,
    #[msg("Invalid freeze authority")]
    InvalidFreezeAuthority,
    #[msg("Token account is not frozen")]
    TokenAccountNotFrozen,
    #[msg("Invalid IOU mint")]
    InvalidIouMint,
    #[msg("Invalid config")]
    InvalidConfig,
    #[msg("Invalid governance mint")]
    InvalidGovMint,
    #[msg("Invalid vault authority")]
    InvalidVaultAuthority,
}
