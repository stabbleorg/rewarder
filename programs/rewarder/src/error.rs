use anchor_lang::prelude::*;

#[error_code]
pub enum RewarderError {
    #[msg("The specified mint is not supported")]
    NotSupportedMint,
}
