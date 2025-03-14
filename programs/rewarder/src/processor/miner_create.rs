use crate::state::*;
use anchor_lang::prelude::*;

pub fn process_create_miner(ctx: Context<CreateMiner>, user: Pubkey) -> Result<()> {
    ctx.accounts.miner.set_inner(Miner {
        pool: ctx.accounts.pool.key(),
        authority: user,
        beneficiary: user,
        bump: ctx.bumps.miner,
        amount: 0,
        rewards_debt: 0,
        rewards_credit: 0,
        rewards_claimed: 0,
        last_updated_at: 0,
    });

    ctx.accounts.pool.num_miners += 1;

    Ok(())
}

#[derive(Accounts)]
#[instruction(user: Pubkey)]
pub struct CreateMiner<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        seeds = [Miner::PREFIX, &user.to_bytes(), &pool.key().to_bytes()],
        bump,
        payer = payer,
        space = 8 + Miner::INIT_SPACE,
    )]
    pub miner: Account<'info, Miner>,

    #[account(mut, has_one = rewarder)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub rewarder: Account<'info, Rewarder>,

    pub system_program: Program<'info, System>,
}
