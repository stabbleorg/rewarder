use anchor_lang::prelude::*;

#[error_code]
pub enum RewarderError {
    #[msg("The specified mint is not supported")]
    UnsupportedMint,

    #[msg("No rewards are currently available for claiming")]
    NoClaimableRewards,

    #[msg("Insufficient rewards in the faucet")]
    InsufficientFaucet,

    #[msg("The reward pool is currently empty")]
    RewardPoolEmpty,

    #[msg("Deposit amount cannot be zero")]
    DepositAmountZero,
}
