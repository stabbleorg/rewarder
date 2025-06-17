pub mod error;
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

    pub fn update_rewarder<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, 'info, 'info, UpdateGoverno<'info>>) -> Result<()> {
        process_update_rewarder(ctx)
    }

    pub fn update_realm<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, 'info, 'info, UpdateGoverno<'info>>) -> Result<()> {
        process_update_realm(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_governo(ctx: Context<CloseGoverno>) -> Result<()> {
        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn create_locker(ctx: Context<CreateLocker>, amount: u64, duration: u32) -> Result<()> {
        process_create_locker(ctx, amount, duration)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn close_locker(ctx: Context<CloseLocker>) -> Result<()> {
        process_close_locker(ctx)
    }

    // #[access_control(ctx.accounts.validate())]
    // pub fn force_close_locker(ctx: Context<ForceCloseLocker>) -> Result<()> {
    //     process_force_close_locker(ctx)
    // }

    pub fn stake_locker(ctx: Context<UpdateLocker>) -> Result<()> {
        process_stake_locker(ctx)
    }

    pub fn unstake_locker(ctx: Context<UpdateLocker>) -> Result<()> {
        process_unstake_locker(ctx)
    }

    pub fn claim_locker<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, ClaimLocker<'info>>) -> Result<()> {
        process_claim_locker(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn deposit_voting_weight(ctx: Context<UpdateVotingWeight>) -> Result<()> {
        process_deposit_voting_weight(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn withdraw_voting_weight(ctx: Context<UpdateVotingWeight>) -> Result<()> {
        process_withdraw_voting_weight(ctx)
    }
}
