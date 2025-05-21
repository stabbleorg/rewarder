pub mod constant;
pub mod error;
pub mod processor;
pub mod state;

use crate::processor::*;
use anchor_common::validate::*;
use anchor_lang::prelude::*;

declare_id!("1ok3Ge8vXYPeQgwJd5GBQZkXqW34TbpkvP1APiDVtUF");

#[program]
pub mod vesto {
    use super::*;

    pub fn create_config(
        ctx: Context<CreateConfig>,
        initial_unlock_time: i64,
        vesting_start_time: i64,
        vesting_end_time: i64,
        release_interval: i64,
        initial_unlock_bps: u16,
        total_capacity: u64,
    ) -> Result<()> {
        process_create_config(
            ctx,
            initial_unlock_time,
            vesting_start_time,
            vesting_end_time,
            release_interval,
            initial_unlock_bps,
            total_capacity,
        )
    }

    // pub fn update_vesting_period(
    //     ctx: Context<UpdateConfig>,
    //     initial_unlock_time: i64,
    //     vesting_start_time: i64,
    //     vesting_end_time: i64,
    // ) -> Result<()> {
    //     process_update_vesting_period(ctx, initial_unlock_time, vesting_start_time, vesting_end_time)
    // }

    #[access_control(ctx.accounts.validate())]
    pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
        process_create_pool(ctx)
    }

    pub fn create_position(ctx: Context<CreatePosition>) -> Result<()> {
        process_create_position(ctx)
    }

    pub fn redeem_position(ctx: Context<RedeemPosition>) -> Result<()> {
        process_redeem_position(ctx)
    }

    pub fn stake_position(ctx: Context<UpdatePosition>) -> Result<()> {
        process_stake_position(ctx)
    }

    pub fn unstake_position(ctx: Context<UpdatePosition>) -> Result<()> {
        process_unstake_position(ctx)
    }

    pub fn claim_position<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, ClaimPosition<'info>>) -> Result<()> {
        process_claim_position(ctx)
    }
}
