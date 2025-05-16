use anchor_lang::prelude::*;

#[derive(InitSpace)]
#[account]
pub struct VestingPool {
    pub config: Pubkey,
    pub iou_mint: Pubkey,

    pub total_amount: u64,
    pub total_redeemed: u64,

    pub active_positions: u32,
}
