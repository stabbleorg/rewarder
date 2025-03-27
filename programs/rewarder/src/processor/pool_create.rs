use crate::{error::*, state::*};
use anchor_common::{token::is_supported_mint, validate::Validate};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

pub fn process_create_pool(ctx: Context<CreatePool>, weight: u32) -> Result<()> {
    ctx.accounts.pool.set_inner(Pool {
        rewarder: ctx.accounts.rewarder.key(),
        mint: ctx.accounts.mint.key(),
        decimals: ctx.accounts.mint.decimals,
        weight,
        total_amount: 0,
        total_rewards_debt: 0,
        total_rewards_credit: 0,
        total_rewards_distributed: 0,
        total_weights: 0,
        rewards_per_amount: 0,
        num_miners: 0,
    });

    ctx.accounts.rewarder.num_pools += 1;

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    pub admin: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(zero, rent_exempt = enforce)]
    pub pool: Account<'info, Pool>,

    #[account(mut, has_one = admin)]
    pub rewarder: Account<'info, Rewarder>,
}

impl<'info> Validate<'info> for CreatePool<'info> {
    fn validate(&self) -> Result<()> {
        require!(is_supported_mint(&self.mint).unwrap(), RewarderError::UnsupportedMint);

        Ok(())
    }
}
