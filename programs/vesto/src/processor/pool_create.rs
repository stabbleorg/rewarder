use crate::{constant::VESTING_POOL_PREFIX, state::*};
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use governo::state::Governo;

pub fn process_create_pool(ctx: Context<CreatePool>) -> Result<()> {
    ctx.accounts.config.active_pools += 1;

    ctx.accounts.pool.set_inner(VestingPool {
        config: ctx.accounts.config.key(),
        iou_mint: ctx.accounts.iou_mint.key(),
        total_amount: 0,
        total_redeemed: 0,
        active_positions: 0,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(has_one = admin)]
    pub governo: Account<'info, Governo>,

    #[account(mut, has_one = governo)]
    pub config: Account<'info, VestingConfig>,

    #[account(init,
        seeds = [VESTING_POOL_PREFIX, &config.key().to_bytes(), &iou_mint.key().to_bytes()],
        bump,
        space = 8 + VestingPool::INIT_SPACE,
        payer = admin,
    )]
    pub pool: Account<'info, VestingPool>,

    pub iou_mint: Account<'info, Mint>,

    pub system_program: Program<'info, System>,
}

impl<'info> Validate<'info> for CreatePool<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.iou_mint.decimals, self.governo.decimals);

        Ok(())
    }
}
