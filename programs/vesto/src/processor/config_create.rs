use crate::{constant::*, state::*};
use anchor_lang::prelude::*;
use governo::state::Governo;

pub fn process_create_config(
    ctx: Context<CreateConfig>,
    initial_unlock_time: i64,
    vesting_start_time: i64,
    vesting_end_time: i64,
    release_interval: i64,
    initial_unlock_bps: u16,
    total_capacity: u64,
) -> Result<()> {
    require_gte!(vesting_start_time, initial_unlock_time);
    require_gte!(vesting_end_time, vesting_start_time);
    require_gte!(release_interval, 1);
    require_gte!(MAX_UNLOCK_BASIS_POINTS, initial_unlock_bps);

    ctx.accounts.config.set_inner(VestingConfig {
        governo: ctx.accounts.governo.key(),
        authority_bump: ctx.bumps.vault_authority,
        initial_unlock_time,
        vesting_start_time,
        vesting_end_time,
        vesting_duration: vesting_end_time - vesting_start_time,
        release_interval,
        initial_unlock_bps,
        total_capacity,
        total_amount: 0,
        total_claimed: 0,
        active_pools: 0,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(has_one = admin)]
    pub governo: Account<'info, Governo>,

    #[account(zero)]
    pub config: Account<'info, VestingConfig>,

    /// CHECK: OK
    #[account(seeds = [VAULT_AUTHORITY_PREFIX, &config.key().to_bytes()], bump)]
    pub vault_authority: UncheckedAccount<'info>,
}
