use crate::state::*;
use anchor_common::{token::get_transfer_fee, validate::Validate};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked};

pub fn process_deposit_miner(ctx: Context<UpdateMiner>, amount: u64) -> Result<()> {
    let transfer_fee = get_transfer_fee(&ctx.accounts.mint.to_account_info(), amount, Clock::get()?.epoch)?;
    let post_fee_amount = amount.saturating_sub(transfer_fee);

    ctx.accounts.with.deposit(post_fee_amount)?;

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
    let amount = ctx.accounts.authority.amount - ctx.accounts.with.miner.amount;

    let transfer_fee = get_transfer_fee(&ctx.accounts.mint.to_account_info(), amount, Clock::get()?.epoch)?;
    let post_fee_amount = amount.saturating_sub(transfer_fee);

    ctx.accounts.with.deposit(post_fee_amount)?;

    ctx.accounts.authority.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.authority_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.miner_token.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

pub fn process_withdraw_derived_miner(ctx: Context<UpdateDerivedMiner>, amount: u64) -> Result<()> {
    ctx.accounts.with.withdraw(amount)?;

    ctx.accounts.with.miner.authority_seeds(|signer_seed| {
        transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.miner_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.authority_token.to_account_info(),
                    authority: ctx.accounts.with.miner.to_account_info(),
                },
            )
            .with_signer(&[signer_seed]),
            amount,
            ctx.accounts.mint.decimals,
        )
    })
}

pub fn process_claim_miner(ctx: Context<ClaimMiner>) -> Result<()> {
    let rewards_claimed = ctx.accounts.with.miner.rewards_claimed;

    ctx.accounts.with.claim()?;

    let amount = ctx.accounts.with.miner.rewards_claimed - rewards_claimed;

    ctx.accounts.with.rewarder.total_rewards_claimed += amount;

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

    pub beneficiary: Signer<'info>,

    pub authority: Account<'info, Miner>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = authority,
    )]
    pub authority_token: InterfaceAccount<'info, TokenAccount>,

    #[account(mut,
        associated_token::mint = mint,
        associated_token::authority = with.miner,
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
        assert_eq!(self.authority.key(), self.with.miner.authority);
        assert_eq!(self.beneficiary.key(), self.with.miner.beneficiary);
        assert_eq!(self.mint.key(), self.with.pool.mint);

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

        self.miner.rewards_claimed = u64::try_from(
            self.pool.rewards_per_amount * self.miner.amount as u128 / Pool::REWARDS_PER_AMOUNT_PRECISION,
        )
        .unwrap()
            + self.miner.rewards_credit
            - self.miner.rewards_debt;

        Ok(())
    }
}
