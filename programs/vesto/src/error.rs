use anchor_lang::prelude::*;

#[error_code]
pub enum VestoError {
    #[msg("The vesting contract has not unlocked yet")]
    Locked,
}
