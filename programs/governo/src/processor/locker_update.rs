use crate::state::*;
use anchor_lang::prelude::*;
use rewarder::{
    cpi::{
        accounts::{ClaimMiner, UpdateMiner, WithMiner},
        claim_miner, deposit_miner, withdraw_miner,
    },
    program::Rewarder,
};

pub fn process_stake_locker(ctx: Context<UpdateLocker>) -> Result<()> {
    require_gt!(ctx.accounts.locker.unlocks_at, Clock::get()?.unix_timestamp);

    ctx.accounts.locker.authority_seeds(|signer_seed| {
        deposit_miner(
            CpiContext::new(
                ctx.accounts.rewarder_program.to_account_info(),
                UpdateMiner {
                    with: WithMiner {
                        miner: ctx.accounts.miner.to_account_info(),
                        pool: ctx.accounts.pool.to_account_info(),
                        rewarder: ctx.accounts.rewarder.to_account_info(),
                    },
                    authority: ctx.accounts.locker_authority.to_account_info(),
                    mint: ctx.accounts.ve_mint.to_account_info(),
                    user_token: ctx.accounts.locker_ve_token.to_account_info(),
                    miner_token: ctx.accounts.miner_ve_token.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.voting_weight,
        )
    })
}

pub fn process_unstake_locker(ctx: Context<UpdateLocker>) -> Result<()> {
    ctx.accounts.locker.authority_seeds(|signer_seed| {
        withdraw_miner(
            CpiContext::new(
                ctx.accounts.rewarder_program.to_account_info(),
                UpdateMiner {
                    with: WithMiner {
                        miner: ctx.accounts.miner.to_account_info(),
                        pool: ctx.accounts.pool.to_account_info(),
                        rewarder: ctx.accounts.rewarder.to_account_info(),
                    },
                    authority: ctx.accounts.locker_authority.to_account_info(),
                    mint: ctx.accounts.ve_mint.to_account_info(),
                    user_token: ctx.accounts.locker_ve_token.to_account_info(),
                    miner_token: ctx.accounts.miner_ve_token.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.voting_weight,
        )
    })
}

pub fn process_claim_locker(ctx: Context<ClaimLocker>) -> Result<()> {
    ctx.accounts.locker.authority_seeds(|signer_seed| {
        claim_miner(
            CpiContext::new(
                ctx.accounts.rewarder_program.to_account_info(),
                ClaimMiner {
                    with: WithMiner {
                        miner: ctx.accounts.miner.to_account_info(),
                        pool: ctx.accounts.pool.to_account_info(),
                        rewarder: ctx.accounts.rewarder.to_account_info(),
                    },
                    beneficiary: ctx.accounts.locker_authority.to_account_info(),
                    rewarder_authority: ctx.accounts.rewarder_authority.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    user_token: ctx.accounts.user_token.to_account_info(),
                    rewarder_token: ctx.accounts.rewarder_token.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
        )
    })
}

#[derive(Accounts)]
pub struct UpdateLocker<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, has_one = authority, has_one = governo)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump = locker.authority_bump)]
    pub locker_authority: UncheckedAccount<'info>,

    #[account(mut, has_one = ve_mint)]
    pub governo: Account<'info, Governo>,

    pub rewarder_program: Program<'info, Rewarder>,

    /// CHECK: OK
    #[account(mut)]
    pub miner: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder: UncheckedAccount<'info>,

    /// CHECK: OK
    pub ve_mint: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub locker_ve_token: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub miner_ve_token: UncheckedAccount<'info>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ClaimLocker<'info> {
    pub authority: Signer<'info>,

    #[account(mut, has_one = authority)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump = locker.authority_bump)]
    pub locker_authority: UncheckedAccount<'info>,

    pub rewarder_program: Program<'info, Rewarder>,

    /// CHECK: OK
    #[account(mut)]
    pub miner: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub pool: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder_authority: UncheckedAccount<'info>,

    /// CHECK: OK
    pub mint: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub user_token: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder_token: UncheckedAccount<'info>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}
