pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

declare_id!("gov3LSmekCKmzLnKJ87csYdef5QNYM2G3kNDbhZekkA");

#[program]
pub mod governo {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn create_governo(ctx: Context<CreateGoverno>, min_lock_duration: u32, max_lock_duration: u32) -> Result<()> {
        process_create_governo(ctx, min_lock_duration, max_lock_duration)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn create_locker(ctx: Context<CreateLocker>, amount: u64, duration: u32) -> Result<()> {
        process_create_locker(ctx, amount, duration)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_locker(ctx: Context<CloseLocker>) -> Result<()> {
        process_close_locker(ctx)
    }

    pub fn stake_locker(ctx: Context<UpdateLocker>) -> Result<()> {
        process_stake_locker(ctx)
    }

    pub fn unstake_locker(ctx: Context<UpdateLocker>) -> Result<()> {
        process_unstake_locker(ctx)
    }

    pub fn claim_locker(ctx: Context<ClaimLocker>) -> Result<()> {
        process_claim_locker(ctx)
    }
}
