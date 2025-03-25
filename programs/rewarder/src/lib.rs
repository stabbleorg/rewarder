pub mod error;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

declare_id!("rev31KMq4qzt1y1iw926p694MHVVWT57caQrsHLFA4x");

#[program]
pub mod rewarder {
    use super::*;

    #[access_control(ctx.accounts.validate())]
    pub fn create_rewarder(
        ctx: Context<CreateRewarder>,
        total_rewards: u64,
        epoch_starts_at: i64,
        epoch_ends_at: i64,
    ) -> Result<()> {
        process_create_rewarder(ctx, total_rewards, epoch_starts_at, epoch_ends_at)
    }

    pub fn update_rewarder(
        ctx: Context<UpdateRewarder>,
        total_rewards: u64,
        epoch_starts_at: i64,
        epoch_ends_at: i64,
    ) -> Result<()> {
        process_update_rewarder(ctx, total_rewards, epoch_starts_at, epoch_ends_at)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn derive_rewarder(ctx: Context<DeriveRewarder>) -> Result<()> {
        process_derive_rewarder(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn create_pool(ctx: Context<CreatePool>, weight: u32) -> Result<()> {
        process_create_pool(ctx, weight)
    }

    pub fn update_pool(ctx: Context<UpdatePool>, weight: u32) -> Result<()> {
        process_update_pool(ctx, weight)
    }

    pub fn create_miner(ctx: Context<CreateMiner>, user: Pubkey) -> Result<()> {
        process_create_miner(ctx, user)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn deposit_miner(ctx: Context<UpdateMiner>, amount: u64) -> Result<()> {
        process_deposit_miner(ctx, amount)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn withdraw_miner(ctx: Context<UpdateMiner>, amount: u64) -> Result<()> {
        process_withdraw_miner(ctx, amount)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn derive_miner(ctx: Context<DeriveMiner>) -> Result<()> {
        process_derive_miner(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn deposit_derived_miner(ctx: Context<UpdateDerivedMiner>) -> Result<()> {
        process_deposit_derived_miner(ctx)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn withdraw_derived_miner(ctx: Context<UpdateDerivedMiner>, amount: u64) -> Result<()> {
        process_withdraw_derived_miner(ctx, amount)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn claim_miner(ctx: Context<ClaimMiner>) -> Result<()> {
        process_claim_miner(ctx)
    }
}
