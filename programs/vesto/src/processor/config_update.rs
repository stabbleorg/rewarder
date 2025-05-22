use crate::state::*;
use anchor_lang::prelude::*;
use governo::state::Governo;

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,

    #[account(has_one = admin)]
    pub governo: Account<'info, Governo>,

    #[account(mut, has_one = governo)]
    pub config: Account<'info, VestingConfig>,
}
