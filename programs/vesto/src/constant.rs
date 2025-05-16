pub const MAX_UNLOCK_BASIS_POINTS: u16 = 10_000;
pub const ONE_IN_BASIS_POINTS: u128 = MAX_UNLOCK_BASIS_POINTS as u128;

pub const VAULT_AUTHORITY_PREFIX: &'static [u8] = b"vault_authority";
pub const VESTING_POOL_PREFIX: &'static [u8] = b"vesting_pool";
pub const VESTING_POSITION_PREFIX: &'static [u8] = b"vesting_position";
