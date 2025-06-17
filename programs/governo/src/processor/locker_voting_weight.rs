use crate::{error::GovernoError, state::*};
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use spl_governance::{
    cpi::{
        accounts::{DepositGoverningTokens, WithdrawGoverningTokens},
        deposit_governing_tokens, withdraw_governing_tokens,
    },
    program::SplGovernance,
};

// Deposit governing token into SPL Governance
pub fn process_deposit_voting_weight(ctx: Context<UpdateVotingWeight>) -> Result<()> {
    require_gt!(
        ctx.accounts.locker.unlocks_at,
        Clock::get()?.unix_timestamp,
        GovernoError::LockerExpired
    );
    require_eq!(
        ctx.accounts.locker.voting_weight_used,
        0,
        GovernoError::VotingWeightAlreadyUsed,
    );

    ctx.accounts.locker.voting_weight_used = ctx.accounts.locker.voting_weight;

    ctx.accounts.governo.total_voting_weight -= ctx.accounts.locker.voting_weight;
    ctx.accounts.governo.emit_governo_updated();

    ctx.accounts.locker.authority_seeds(|signer_seed| {
        deposit_governing_tokens(
            CpiContext::new(
                ctx.accounts.governance_program.to_account_info(),
                DepositGoverningTokens {
                    realm: ctx.accounts.realm.to_account_info(),
                    governing_token_holding: ctx.accounts.governing_token_holding.to_account_info(),
                    governing_token_source: ctx.accounts.locker_ve_token.to_account_info(),
                    governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                    governing_token_source_authority: ctx.accounts.delegate_authority.to_account_info(),
                    token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                    payer: ctx.accounts.authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    realm_config: ctx.accounts.realm_config.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.voting_weight,
        )
    })
}

// Withdraw governing token from SPL Governance
pub fn process_withdraw_voting_weight(ctx: Context<UpdateVotingWeight>) -> Result<()> {
    require_eq!(
        ctx.accounts.locker.voting_weight_used,
        ctx.accounts.locker.voting_weight,
        GovernoError::VotingWeightAlreadyRefunded,
    );

    ctx.accounts.locker.voting_weight_used = 0;

    ctx.accounts.governo.total_voting_weight += ctx.accounts.locker.voting_weight;
    ctx.accounts.governo.emit_governo_updated();

    ctx.accounts.locker.authority_seeds(|signer_seed| {
        withdraw_governing_tokens(
            CpiContext::new(
                ctx.accounts.governance_program.to_account_info(),
                WithdrawGoverningTokens {
                    realm: ctx.accounts.realm.to_account_info(),
                    governing_token_holding: ctx.accounts.governing_token_holding.to_account_info(),
                    governing_token_destination: ctx.accounts.locker_ve_token.to_account_info(),
                    governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                    token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    realm_config: ctx.accounts.realm_config.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
        )?;

        ctx.accounts.locker_ve_token.reload()?;

        if ctx.accounts.locker_ve_token.amount > ctx.accounts.locker.voting_weight {
            let exceeded_voting_weight = ctx.accounts.locker_ve_token.amount - ctx.accounts.locker.voting_weight;

            deposit_governing_tokens(
                CpiContext::new(
                    ctx.accounts.governance_program.to_account_info(),
                    DepositGoverningTokens {
                        realm: ctx.accounts.realm.to_account_info(),
                        governing_token_holding: ctx.accounts.governing_token_holding.to_account_info(),
                        governing_token_source: ctx.accounts.locker_ve_token.to_account_info(),
                        governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                        governing_token_source_authority: ctx.accounts.delegate_authority.to_account_info(),
                        token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                        payer: ctx.accounts.authority.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                        token_program: ctx.accounts.token_program.to_account_info(),
                        realm_config: ctx.accounts.realm_config.to_account_info(),
                    },
                )
                .with_signer(&[signer_seed]),
                // refund exceeded voting weight back to SPL Governance
                exceeded_voting_weight,
            )?;
        }

        Ok(())
    })
}

#[derive(Accounts)]
pub struct UpdateVotingWeight<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut,
        associated_token::mint = ve_mint,
        associated_token::authority = locker_authority,
    )]
    pub locker_ve_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub ve_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, has_one = authority, has_one = governo)]
    pub locker: Account<'info, Locker>,

    /// CHECK: OK
    #[account(seeds = [Locker::AUTHORITY_PREFIX, &locker.key().to_bytes()], bump = locker.authority_bump)]
    pub locker_authority: UncheckedAccount<'info>,

    #[account(mut, has_one = ve_mint)]
    pub governo: Account<'info, Governo>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,

    pub governance_program: Program<'info, SplGovernance>,

    /// CHECK: OK
    pub realm: UncheckedAccount<'info>,
    /// CHECK: OK
    pub realm_config: UncheckedAccount<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub governing_token_holding: UncheckedAccount<'info>,
    pub delegate_authority: Signer<'info>,
    /// CHECK: OK
    #[account(mut)]
    pub token_owner_record: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for UpdateVotingWeight<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.ve_mint.to_account_info().owner.key(), self.token_program.key());
        assert_ne!(self.locker.voting_weight, 0);

        Ok(())
    }
}
