use crate::{error::*, state::*};
use anchor_common::{
    token::{get_transfer_fee, try_deserialize_mint, try_deserialize_token_account},
    validate::Validate,
};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    burn_checked, close_account, transfer_checked, BurnChecked, CloseAccount, Mint, TokenAccount, TransferChecked,
};

pub fn process_deposit_miner(ctx: Context<UpdateMiner>, amount: u64) -> Result<()> {
    let transfer_fee = get_transfer_fee(&ctx.accounts.mint.to_account_info(), amount, Clock::get()?.epoch)?;
    let post_fee_amount = amount.saturating_sub(transfer_fee);

    ctx.accounts.with.deposit(post_fee_amount)?;

    ctx.accounts.with.emit_updated();

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.user_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.miner_token.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )
}

pub fn process_withdraw_miner(ctx: Context<UpdateMiner>, amount: u64) -> Result<()> {
    ctx.accounts.with.withdraw(amount)?;

    ctx.accounts.with.emit_updated();

    ctx.accounts.with.miner.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.miner_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.with.miner.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

pub fn process_deposit_derived_miner(ctx: Context<UpdateDerivedMiner>) -> Result<()> {
    let amount = ctx.accounts.with.miner.amount - ctx.accounts.with_derived.miner.amount;

    let transfer_fee = get_transfer_fee(&ctx.accounts.mint.to_account_info(), amount, Clock::get()?.epoch)?;
    if transfer_fee > 0 {
        ctx.accounts.with.withdraw(transfer_fee)?;
        ctx.accounts.with.emit_updated();
    }

    let post_fee_amount = amount.saturating_sub(transfer_fee);
    ctx.accounts.with_derived.deposit(post_fee_amount)?;
    ctx.accounts.with_derived.emit_updated();

    ctx.accounts.with.miner.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.authority_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.miner_token.to_account_info(),
                    authority: ctx.accounts.with.miner.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

pub fn process_withdraw_derived_miner(ctx: Context<UpdateDerivedMiner>, amount: u64) -> Result<()> {
    let transfer_fee = get_transfer_fee(&ctx.accounts.mint.to_account_info(), amount, Clock::get()?.epoch)?;
    if transfer_fee > 0 {
        ctx.accounts.with.withdraw(transfer_fee)?;
        ctx.accounts.with.emit_updated();
    }

    ctx.accounts.with_derived.withdraw(amount)?;
    ctx.accounts.with_derived.emit_updated();

    ctx.accounts.with_derived.miner.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.miner_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.authority_token.to_account_info(),
                    authority: ctx.accounts.with_derived.miner.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

pub fn process_claim_miner<'a, 'b, 'c, 'info>(ctx: Context<'_, '_, '_, 'info, ClaimMiner<'info>>) -> Result<()> {
    let rewards_claimed = ctx.accounts.with.miner.rewards_claimed;

    ctx.accounts.with.claim()?;

    let amount = ctx.accounts.with.miner.rewards_claimed.saturating_sub(rewards_claimed);
    require_gte!(
        ctx.accounts.rewarder_token.amount,
        amount,
        RewarderError::InsufficientFaucet
    );

    ctx.accounts.with.rewarder.total_rewards_claimed += amount;

    ctx.accounts.with.emit_updated();

    if ctx.accounts.with.miner.amount == 0 && ctx.remaining_accounts.len() > 0 {
        if ctx.remaining_accounts.len() > 2 {
            let rent_collector = &ctx.remaining_accounts[0];
            let token_account_account = &ctx.remaining_accounts[1];
            let mint_account = &ctx.remaining_accounts[2];
            let token_program = &ctx.remaining_accounts[3];

            assert_eq!(mint_account.key(), ctx.accounts.with.pool.mint);

            ctx.accounts.with.miner.authority_seeds(|signer_seed| {
                let token_account = try_deserialize_token_account(token_account_account)?;
                let mint = try_deserialize_mint(mint_account)?;

                if token_account.amount > 0 {
                    burn_checked(
                        CpiContext::new(
                            token_program.to_account_info(),
                            BurnChecked {
                                mint: mint_account.to_account_info(),
                                from: token_account_account.to_account_info(),
                                authority: ctx.accounts.with.miner.to_account_info(),
                            },
                        ),
                        token_account.amount,
                        mint.decimals,
                    )?;
                }

                close_account(
                    CpiContext::new(
                        token_program.to_account_info(),
                        CloseAccount {
                            account: token_account_account.to_account_info(),
                            authority: ctx.accounts.with.miner.to_account_info(),
                            destination: rent_collector.to_account_info(),
                        },
                    )
                    .with_signer(&[signer_seed]),
                )
            })?;
        }

        ctx.accounts
            .with
            .miner
            .close(ctx.remaining_accounts[0].to_account_info())?;
        ctx.accounts.with.pool.num_miners -= 1;

        if amount == 0 {
            return Ok(());
        }
    } else {
        require_gt!(amount, 0, RewarderError::NoClaimableRewards);
    }

    ctx.accounts.with.rewarder.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.rewarder_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.rewarder_authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

#[derive(Accounts)]
pub struct UpdateMiner<'info> {
    pub with: WithMiner<'info>,

    pub authority: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub user_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = with.miner,
    )]
    pub miner_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for UpdateMiner<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.user_token.to_account_info().owner.key(), self.token_program.key());
        assert_eq!(self.authority.key(), self.with.miner.authority);
        assert_eq!(self.mint.key(), self.with.pool.mint);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateDerivedMiner<'info> {
    pub with: WithMiner<'info>,
    pub with_derived: WithMiner<'info>,

    pub beneficiary: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = with.miner,
    )]
    pub authority_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = with_derived.miner,
    )]
    pub miner_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for UpdateDerivedMiner<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(
            self.authority_token.to_account_info().owner.key(),
            self.token_program.key()
        );
        assert_eq!(self.with.miner.key(), self.with_derived.miner.authority);
        assert_eq!(self.beneficiary.key(), self.with_derived.miner.beneficiary);
        assert_eq!(self.mint.key(), self.with_derived.pool.mint);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct ClaimMiner<'info> {
    pub with: WithMiner<'info>,

    pub beneficiary: Signer<'info>,

    /// CHECK: OK
    #[account(seeds = [Rewarder::AUTHORITY_PREFIX, &with.rewarder.key().to_bytes()], bump = with.rewarder.authority_bump)]
    pub rewarder_authority: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: OK
    #[account(mut)]
    pub user_token: UncheckedAccount<'info>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = rewarder_authority,
    )]
    pub rewarder_token: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: OK
    pub token_program: UncheckedAccount<'info>,
}

impl<'info> Validate<'info> for ClaimMiner<'info> {
    fn validate(&self) -> Result<()> {
        assert_eq!(self.user_token.to_account_info().owner.key(), self.token_program.key());
        assert_eq!(self.mint.key(), self.with.rewarder.mint);
        assert_eq!(self.beneficiary.key(), self.with.miner.beneficiary);

        Ok(())
    }
}

#[derive(Accounts)]
pub struct WithMiner<'info> {
    #[account(mut, has_one = pool)]
    pub miner: Account<'info, Miner>,

    #[account(mut, has_one = rewarder)]
    pub pool: Account<'info, Pool>,

    #[account(mut)]
    pub rewarder: Account<'info, Rewarder>,
}

impl<'info> WithMiner<'info> {
    fn refresh(&mut self) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;

        if current_time > self.rewarder.last_updated_at {
            self.rewarder.refresh_rewards_per_weight(current_time)?;

            self.pool.refresh_rewards_per_amount(self.rewarder.rewards_per_weight)?;
        }

        Ok(())
    }

    pub fn deposit(&mut self, amount: u64) -> Result<()> {
        require_gt!(amount, 0, RewarderError::DepositAmountZero);
        require_gt!(self.pool.weight, 0, RewarderError::RewardPoolEmpty);

        self.refresh()?;

        let weights = self.pool.weight as u128 * amount as u128;

        if self.rewarder.rewards_per_weight > 0 {
            self.pool.total_rewards_debt +=
                u64::try_from(self.rewarder.rewards_per_weight * weights / Rewarder::REWARDS_PER_WEIGHT_PRECISION + 1)
                    .unwrap();
        }

        if self.pool.rewards_per_amount > 0 {
            self.miner.rewards_debt +=
                u64::try_from(self.pool.rewards_per_amount * amount as u128 / Pool::REWARDS_PER_AMOUNT_PRECISION + 1)
                    .unwrap();
        }

        self.rewarder.total_weights += weights;
        self.pool.total_weights += weights;
        self.pool.total_amount += amount;
        self.miner.amount += amount;

        Ok(())
    }

    pub fn withdraw(&mut self, amount: u64) -> Result<()> {
        self.refresh()?;

        let weights = self.pool.weight as u128 * amount as u128;

        if self.rewarder.rewards_per_weight > 0 {
            self.pool.total_rewards_credit +=
                u64::try_from(self.rewarder.rewards_per_weight * weights / Rewarder::REWARDS_PER_WEIGHT_PRECISION)
                    .unwrap();
        }

        if self.pool.rewards_per_amount > 0 {
            self.miner.rewards_credit +=
                u64::try_from(self.pool.rewards_per_amount * amount as u128 / Pool::REWARDS_PER_AMOUNT_PRECISION)
                    .unwrap();
        }

        self.rewarder.total_weights -= weights;
        self.pool.total_weights -= weights;
        self.pool.total_amount -= amount;
        self.miner.amount -= amount;

        Ok(())
    }

    pub fn claim(&mut self) -> Result<()> {
        self.refresh()?;

        let rewards_before_debt = u64::try_from(
            self.pool.rewards_per_amount * self.miner.amount as u128 / Pool::REWARDS_PER_AMOUNT_PRECISION,
        )
        .unwrap()
            + self.miner.rewards_credit;

        if rewards_before_debt > self.miner.rewards_debt {
            self.miner.rewards_claimed = rewards_before_debt.saturating_sub(self.miner.rewards_debt);
        }

        Ok(())
    }

    pub fn emit_updated(&self) {
        self.rewarder.emit_rewards_per_weight_updated();
        self.pool.emit_rewards_per_amount_updated();
        self.miner.emit_miner_updated();
    }
}
