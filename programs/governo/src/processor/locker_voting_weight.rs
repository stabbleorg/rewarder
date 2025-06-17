use crate::{error::GovernoError, state::*};
use anchor_common::validate::Validate;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{approve_checked, ApproveChecked, Mint, TokenAccount, TokenInterface};
use spl_governance::{
    deposit_governing_tokens, set_governance_delegate, withdraw_governing_tokens, DepositGoverningTokens,
    SetGovernanceDelegate, SplGovernance, WithdrawGoverningTokens,
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
    require_keys_eq!(
        ctx.accounts.realm.key(),
        ctx.accounts.governo.realm.unwrap(),
        GovernoError::InvalidRealm,
    );

    ctx.accounts.locker.voting_weight_used = ctx.accounts.locker.voting_weight;

    ctx.accounts.governo.total_voting_weight -= ctx.accounts.locker.voting_weight;
    ctx.accounts.governo.emit_governo_updated();

    ctx.accounts.locker.authority_seeds(|signer_seed| {
        approve_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                ApproveChecked {
                    to: ctx.accounts.locker_ve_token.to_account_info(),
                    mint: ctx.accounts.ve_mint.to_account_info(),
                    delegate: ctx.accounts.user.to_account_info(),
                    authority: ctx.accounts.locker_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.voting_weight,
            ctx.accounts.ve_mint.decimals,
        )?;

        deposit_governing_tokens(
            CpiContext::new(
                ctx.accounts.governance_program.to_account_info(),
                DepositGoverningTokens {
                    realm: ctx.accounts.realm.to_account_info(),
                    governing_token_holding: ctx.accounts.realm_ve_token.to_account_info(),
                    governing_token_source: ctx.accounts.locker_ve_token.to_account_info(),
                    governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                    governing_token_source_authority: ctx.accounts.user.to_account_info(),
                    token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                    payer: ctx.accounts.user.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    realm_config: ctx.accounts.realm_config.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.locker.voting_weight,
            ctx.accounts.ve_mint.key(),
        )?;

        set_governance_delegate(
            CpiContext::new(
                ctx.accounts.governance_program.to_account_info(),
                SetGovernanceDelegate {
                    governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                    token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.realm.key(),
            ctx.accounts.ve_mint.key(),
            Some(ctx.accounts.user.key()),
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
        let prev_voting_weight = ctx.accounts.locker_ve_token.amount;

        withdraw_governing_tokens(
            CpiContext::new(
                ctx.accounts.governance_program.to_account_info(),
                WithdrawGoverningTokens {
                    realm: ctx.accounts.realm.to_account_info(),
                    governing_token_holding: ctx.accounts.realm_ve_token.to_account_info(),
                    governing_token_destination: ctx.accounts.locker_ve_token.to_account_info(),
                    governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                    token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    realm_config: ctx.accounts.realm_config.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.ve_mint.key(),
        )?;

        ctx.accounts.locker_ve_token.reload()?;

        let post_voting_weight = ctx.accounts.locker_ve_token.amount;
        let voting_weight = post_voting_weight - prev_voting_weight;
        assert_eq!(voting_weight, ctx.accounts.locker.voting_weight);

        set_governance_delegate(
            CpiContext::new(
                ctx.accounts.governance_program.to_account_info(),
                SetGovernanceDelegate {
                    governing_token_owner: ctx.accounts.locker_authority.to_account_info(),
                    token_owner_record: ctx.accounts.token_owner_record.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            ctx.accounts.realm.key(),
            ctx.accounts.ve_mint.key(),
            None,
        )
    })
}

#[derive(Accounts)]
pub struct UpdateVotingWeight<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut,
        associated_token::mint = ve_mint,
        associated_token::authority = locker_authority,
    )]
    pub locker_ve_token: InterfaceAccount<'info, TokenAccount>,

    pub ve_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, has_one = user, has_one = governo)]
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
    pub realm_ve_token: UncheckedAccount<'info>,
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
