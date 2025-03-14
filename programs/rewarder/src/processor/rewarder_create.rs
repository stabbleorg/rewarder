use crate::state::*;
use anchor_common::{token::is_supported_mint, validate::Validate};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

pub fn process_create_rewarder(
    ctx: Context<CreateRewarder>,
    total_rewards: u64,
    epoch_starts_at: i64,
    epoch_ends_at: i64,
) -> Result<()> {
    let current_time = Clock::get()?.unix_timestamp;

    require_gt!(epoch_starts_at, current_time);
    require_gt!(epoch_ends_at, epoch_starts_at);

    ctx.accounts.rewarder.set_inner(Rewarder {
        admin: ctx.accounts.admin.key(),
        reward_mint: ctx.accounts.reward_mint.key(),
        authority_bump: ctx.bumps.rewarder_authority,
        cumulative_rewards: 0,
        total_rewards,
        total_weights: 0,
        rewards_per_weight: 0,
        num_pools: 0,
        epoch_index: 0,
        epoch_starts_at,
        epoch_ends_at,
        epoch_duration: epoch_ends_at - epoch_starts_at,
        last_updated_at: epoch_starts_at,
        parent_rewarder: None,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreateRewarder<'info> {
    pub admin: Signer<'info>,

    pub reward_mint: InterfaceAccount<'info, Mint>,

    #[account(zero, rent_exempt = enforce)]
    pub rewarder: Account<'info, Rewarder>,

    /// CHECK: OK
    #[account(seeds = [Rewarder::AUTHORITY_PREFIX, &rewarder.key().to_bytes()], bump)]
    pub rewarder_authority: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for CreateRewarder<'info> {
    fn validate(&self) -> Result<()> {
        assert!(is_supported_mint(&self.reward_mint).unwrap());

        Ok(())
    }
}
