use anchor_lang::prelude::*;

#[error_code]
pub enum VestoError {
    #[msg("The locker has expired and is no longer valid for use")]
    LockerExpired,
}
