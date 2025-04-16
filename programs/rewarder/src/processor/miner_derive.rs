use crate::state::*;
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;

pub fn process_derive_miner(ctx: Context<DeriveMiner>) -> Result<()> {
    ctx.accounts.pool.num_miners += 1;

    ctx.accounts.miner.set_inner(Miner {
        pool: ctx.accounts.pool.key(),
        authority: ctx.accounts.authority.key(),
        beneficiary: ctx.accounts.authority.beneficiary,
        bump: ctx.bumps.miner,
        amount: 0,
        rewards_debt: 0,
        rewards_credit: 0,
        rewards_claimed: 0,
    });
    ctx.accounts.miner.emit_miner_created();

    Ok(())
}

#[derive(Accounts)]
pub struct DeriveMiner<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: Account<'info, Miner>,

    pub authority_pool: Account<'info, Pool>,

    #[account(
        init,
        seeds = [Miner::PREFIX, &authority.key().to_bytes(), &pool.key().to_bytes()],
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

impl<'info> Validate<'info> for DeriveMiner<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.authority_pool.key(), self.authority.pool);
        assert_eq!(self.authority_pool.rewarder, self.rewarder.parent_rewarder.unwrap());
        assert_eq!(self.authority_pool.mint, self.pool.mint);

        Ok(())
    }
}
