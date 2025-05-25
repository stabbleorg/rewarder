use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};
use governo::state::Governo;
use rewarder::{
    cpi::{
        accounts::{ClaimMiner, UpdateMiner, WithMiner},
        claim_miner, deposit_miner, withdraw_miner,
    },
    program::Rewarder,
    state::Miner,
};

pub fn process_stake_position(ctx: Context<UpdatePosition>) -> Result<()> {
    require_keys_eq!(ctx.accounts.rewarder.key(), ctx.accounts.governo.rewarder.unwrap());

    let remaining_amount = ctx.accounts.position.amount - ctx.accounts.position.claimed - ctx.accounts.miner.amount;

    ctx.accounts.position.authority_seeds(|signer_seed| {
        deposit_miner(
            CpiContext::new(
                ctx.accounts.rewarder_program.to_account_info(),
                UpdateMiner {
                    with: WithMiner {
                        miner: ctx.accounts.miner.to_account_info(),
                        pool: ctx.accounts.reward_pool.to_account_info(),
                        rewarder: ctx.accounts.rewarder.to_account_info(),
                    },
                    authority: ctx.accounts.position.to_account_info(),
                    mint: ctx.accounts.iou_mint.to_account_info(),
                    user_token: ctx.accounts.position_iou_token.to_account_info(),
                    miner_token: ctx.accounts.miner_iou_token.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            remaining_amount,
        )
    })
}

pub fn process_unstake_position(ctx: Context<UpdatePosition>) -> Result<()> {
    ctx.accounts.position.authority_seeds(|signer_seed| {
        withdraw_miner(
            CpiContext::new(
                ctx.accounts.rewarder_program.to_account_info(),
                UpdateMiner {
                    with: WithMiner {
                        miner: ctx.accounts.miner.to_account_info(),
                        pool: ctx.accounts.reward_pool.to_account_info(),
                        rewarder: ctx.accounts.rewarder.to_account_info(),
                    },
                    authority: ctx.accounts.position.to_account_info(),
                    mint: ctx.accounts.iou_mint.to_account_info(),
                    user_token: ctx.accounts.position_iou_token.to_account_info(),
                    miner_token: ctx.accounts.miner_iou_token.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.miner.amount,
        )
    })
}

pub fn process_claim_position<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, ClaimPosition<'info>>) -> Result<()> {
    ctx.accounts.position.authority_seeds(|signer_seed| {
        claim_miner(
            CpiContext::new(
                ctx.accounts.rewarder_program.to_account_info(),
                ClaimMiner {
                    with: WithMiner {
                        miner: ctx.accounts.miner.to_account_info(),
                        pool: ctx.accounts.reward_pool.to_account_info(),
                        rewarder: ctx.accounts.rewarder.to_account_info(),
                    },
                    beneficiary: ctx.accounts.position.to_account_info(),
                    rewarder_authority: ctx.accounts.rewarder_authority.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    user_token: ctx.accounts.user_token.to_account_info(),
                    rewarder_token: ctx.accounts.rewarder_token.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            )
            .with_signer(&[signer_seed])
            .with_remaining_accounts(ctx.remaining_accounts.to_vec()),
        )
    })
}

#[derive(Accounts)]
pub struct UpdatePosition<'info> {
    pub governo: Account<'info, Governo>,
    #[account(has_one = governo)]
    pub config: Account<'info, VestingConfig>,
    #[account(has_one = config, has_one = iou_mint)]
    pub pool: Account<'info, VestingPool>,

    #[account(has_one = pool)]
    pub position: Account<'info, VestingPosition>,
    #[account(mut,
        associated_token::mint = iou_mint,
        associated_token::authority = position,
    )]
    pub position_iou_token: Account<'info, TokenAccount>,

    /// CHECK: OK
    #[account(mut)]
    pub miner: Account<'info, Miner>,
    /// CHECK: OK
    #[account(mut)]
    pub miner_iou_token: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub reward_pool: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub iou_mint: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,

    pub rewarder_program: Program<'info, Rewarder>,
}

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    pub position: Account<'info, VestingPosition>,

    /// CHECK: OK
    #[account(mut)]
    pub miner: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub reward_pool: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder: UncheckedAccount<'info>,

    /// CHECK: OK
    #[account(mut)]
    pub rewarder_authority: UncheckedAccount<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub rewarder_token: UncheckedAccount<'info>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = position.user,
    )]
    pub user_token: Account<'info, TokenAccount>,

    /// CHECK: OK
    pub mint: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,

    pub rewarder_program: Program<'info, Rewarder>,
}
