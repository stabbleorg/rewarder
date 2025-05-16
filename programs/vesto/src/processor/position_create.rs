use crate::{constant::VESTING_POSITION_PREFIX, state::*};
use anchor_lang::prelude::*;

pub fn process_create_position(ctx: Context<CreatePosition>) -> Result<()> {
    ctx.accounts.pool.active_positions += 1;

    ctx.accounts.position.set_inner(VestingPosition {
        pool: ctx.accounts.pool.key(),
        user: ctx.accounts.user.key(),
        amount: 0,
        claimed: 0,
        bump: ctx.bumps.position,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct CreatePosition<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub pool: Account<'info, VestingPool>,

    #[account(init,
        seeds = [VESTING_POSITION_PREFIX, &pool.key().to_bytes(), &user.key().to_bytes()],
        bump,
        space = 8 + VestingPosition::INIT_SPACE,
        payer = user,
    )]
    pub position: Account<'info, VestingPosition>,

    pub system_program: Program<'info, System>,
}
