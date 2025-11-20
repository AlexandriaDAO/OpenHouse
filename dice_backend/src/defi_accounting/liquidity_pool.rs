use candid::{CandidType, Deserialize, Nat, Principal};
use ic_stable_structures::{StableBTreeMap, StableCell, memory_manager::VirtualMemory, DefaultMemoryImpl, Storable};
use serde::Serialize;
use std::cell::RefCell;
use std::borrow::Cow;
use num_traits::ToPrimitive;
use ic_ledger_types::MAINNET_LEDGER_CANISTER_ID;

use super::accounting;

// Constants

const MINIMUM_LIQUIDITY: u64 = 1000;
const MIN_DEPOSIT: u64 = 100_000_000; // 1 ICP minimum for all deposits
const MIN_WITHDRAWAL: u64 = 100_000; // 0.001 ICP
const MIN_OPERATING_BALANCE: u64 = 1_000_000_000; // 10 ICP to operate games
const TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP
const LP_WITHDRAWAL_FEE_BPS: u64 = 100; // 1%

// Storable wrapper for Nat
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct StorableNat(pub Nat);

impl Storable for StorableNat {
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = self.0.0.to_bytes_be();
        let len = bytes.len() as u32;
        let mut result = len.to_be_bytes().to_vec();
        result.extend_from_slice(&bytes);
        Cow::Owned(result)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        if bytes.len() < 4 { 
            panic!("StorableNat: Invalid byte length < 4");
        }
        let len = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
        if bytes.len() < 4 + len { 
            panic!("StorableNat: Invalid byte length, expected {} but got {}", 4 + len, bytes.len());
        }
        let bigint_bytes = &bytes[4..4+len];
        let biguint = num_bigint::BigUint::from_bytes_be(bigint_bytes);
        StorableNat(Nat(biguint))
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

// Pool state for stable storage
#[derive(Clone, CandidType, Deserialize, Serialize)]
struct PoolState {
    reserve: Nat,
    initialized: bool,
}

impl Storable for PoolState {
    fn to_bytes(&self) -> Cow<[u8]> {
        let serialized = serde_json::to_vec(self).unwrap();
        Cow::Owned(serialized)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Bounded {
            max_size: 1000,
            is_fixed_size: false
        };
}

// Storage
thread_local! {
    // LP shares by user
    static LP_SHARES: RefCell<StableBTreeMap<Principal, StorableNat, VirtualMemory<DefaultMemoryImpl>>> = {
        RefCell::new(StableBTreeMap::init(
            crate::MEMORY_MANAGER.with(|m| m.borrow().get(ic_stable_structures::memory_manager::MemoryId::new(11)))
        ))
    };

    // Pool state (reserve + initialized flag)
    static POOL_STATE: RefCell<StableCell<PoolState, VirtualMemory<DefaultMemoryImpl>>> = {
        RefCell::new(StableCell::init(
            crate::MEMORY_MANAGER.with(|m| m.borrow().get(ic_stable_structures::memory_manager::MemoryId::new(13))),
            PoolState {
                reserve: Nat::from(0u64),
                initialized: false,
            }
        ).expect("Failed to init pool state"))
    };
}

// Types
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct LPPosition {
    pub shares: Nat,
    pub pool_ownership_percent: f64,
    pub redeemable_icp: Nat,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct PoolStats {
    pub total_shares: Nat,
    pub pool_reserve: Nat,
    pub share_price: Nat,
    pub total_liquidity_providers: u64,
    pub minimum_liquidity_burned: Nat,
    pub is_initialized: bool,
}

// Deposit liquidity
pub async fn deposit_liquidity(amount: u64) -> Result<Nat, String> {
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} e8s", MIN_DEPOSIT));
    }

    let caller = ic_cdk::caller();
    let amount_nat = Nat::from(amount);

    // Use accounting::deposit logic essentially, but specific to LP?
    // Wait, the original code used `transfer_from_user` (local helper).
    // We should use the helper but make sure it's safe.
    // `transfer_from_user` uses `icrc2_transfer_from`. This is safe (pull).
    
    match transfer_from_user(caller, amount).await {
        Err(e) => return Err(format!("Transfer failed: {}", e)),
        Ok(_) => {}
    }

    // Calculate shares to mint
    let shares_to_mint = POOL_STATE.with(|state| {
        let pool_state = state.borrow().get().clone();
        let current_reserve = pool_state.reserve.clone();
        let total_shares = calculate_total_supply();

        if total_shares == Nat::from(0u64) {
            let initial_shares = amount_nat.clone();
            let burned_shares = Nat::from(MINIMUM_LIQUIDITY);

            LP_SHARES.with(|shares| {
                shares.borrow_mut().insert(Principal::anonymous(), StorableNat(burned_shares.clone()));
            });

            if initial_shares < burned_shares {
                return Err("Initial deposit too small".to_string());
            }
            Ok(initial_shares - burned_shares)
        } else {
            let numerator = amount_nat.clone() * total_shares;
            if current_reserve == Nat::from(0u64) {
                 return Err("Division by zero".to_string());
            }
            Ok(numerator / current_reserve)
        }
    })?;

    LP_SHARES.with(|shares| {
        let mut shares_map = shares.borrow_mut();
        let current = shares_map.get(&caller).map(|s| s.0.clone()).unwrap_or(Nat::from(0u64));
        let new_shares = current + shares_to_mint.clone();
        shares_map.insert(caller, StorableNat(new_shares));
    });

    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve += amount_nat;
        state.borrow_mut().set(pool_state).unwrap();
    });

    Ok(shares_to_mint)
}

// WITHDRAWAL LOGIC

pub fn restore_lp_position(user: Principal, shares: Nat, reserve_deducted: Nat) {
    LP_SHARES.with(|s| {
        let mut map = s.borrow_mut();
        let current = map.get(&user).map(|n| n.0.clone()).unwrap_or(Nat::from(0u64));
        map.insert(user, StorableNat(current + shares));
    });

    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve += reserve_deducted;
        state.borrow_mut().set(pool_state).unwrap();
    });
}

async fn withdraw_liquidity(shares_to_burn: Nat) -> Result<u64, String> {
    let caller = ic_cdk::caller();

    if shares_to_burn == Nat::from(0u64) {
        return Err("Cannot withdraw zero shares".to_string());
    }

    let user_shares = LP_SHARES.with(|s| s.borrow().get(&caller).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64)));
    if user_shares < shares_to_burn {
        return Err("Insufficient shares".to_string());
    }

    // Calculate payout
    let payout_nat = POOL_STATE.with(|state| {
        let pool_state = state.borrow().get().clone();
        let current_reserve = pool_state.reserve.clone();
        let total_shares = calculate_total_supply();

        if total_shares == Nat::from(0u64) {
            return Err("No shares in circulation".to_string());
        }

        let numerator = shares_to_burn.clone() * current_reserve.clone();
        let payout = numerator / total_shares;

        if current_reserve < payout {
             return Err("Insufficient pool reserve".to_string());
        }

        Ok(payout)
    })?;

    let payout_u64 = payout_nat.0.to_u64().ok_or("Payout too large")?;
    if payout_u64 < MIN_WITHDRAWAL {
        return Err(format!("Minimum withdrawal is {} e8s", MIN_WITHDRAWAL));
    }

    let fee_amount = (payout_u64 * LP_WITHDRAWAL_FEE_BPS) / 10_000;
    let lp_amount = payout_u64 - fee_amount;

    // ATOMIC UPDATE: Deduct shares and reserve
    LP_SHARES.with(|shares| {
        let mut shares_map = shares.borrow_mut();
        let new_shares = user_shares.clone() - shares_to_burn.clone();
        if new_shares == Nat::from(0u64) {
            shares_map.remove(&caller);
        } else {
            shares_map.insert(caller, StorableNat(new_shares));
        }
    });

    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve -= payout_nat.clone();
        state.borrow_mut().set(pool_state).unwrap();
    });

    // SCHEDULE WITHDRAWAL
    // Note: lp_amount is what we send. payout_nat (including fee) is what we deducted from reserve.
    // We pass payout_nat as 'reserve' to restore in case of failure.
    match accounting::schedule_lp_withdrawal(caller, shares_to_burn.clone(), payout_nat.clone(), lp_amount) {
        Ok(_) => Ok(lp_amount),
        Err(e) => {
             // Rollback if scheduling fails
             restore_lp_position(caller, shares_to_burn, payout_nat);
             Err(format!("Withdrawal scheduling failed: {}", e))
        }
    }
}

pub async fn withdraw_all_liquidity() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let shares = LP_SHARES.with(|s| s.borrow().get(&caller).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64)));

    if shares == Nat::from(0u64) {
        return Err("No liquidity to withdraw".to_string());
    }

    withdraw_liquidity(shares).await
}

// Query functions

pub(crate) fn get_lp_position_internal(user: Principal) -> LPPosition {
    let user_shares = LP_SHARES.with(|s| s.borrow().get(&user).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64)));
    let total_shares = calculate_total_supply();
    let pool_reserve = get_pool_reserve_nat();

    let (ownership_percent, redeemable_icp) = if total_shares == Nat::from(0u64) {
        (0.0, Nat::from(0u64))
    } else if pool_reserve == Nat::from(0u64) {
        let ownership = (user_shares.0.to_f64().unwrap_or(0.0) /
                        total_shares.0.to_f64().unwrap_or(1.0)) * 100.0;
        (ownership, Nat::from(0u64))
    } else {
        let ownership = (user_shares.0.to_f64().unwrap_or(0.0) /
                        total_shares.0.to_f64().unwrap_or(1.0)) * 100.0;
        let numerator = user_shares.clone() * pool_reserve.clone();
        let redeemable = numerator / total_shares;
        (ownership, redeemable)
    };

    LPPosition {
        shares: user_shares,
        pool_ownership_percent: ownership_percent,
        redeemable_icp,
    }
}

pub(crate) fn get_pool_stats_internal() -> PoolStats {
    let total_shares = calculate_total_supply();
    let pool_state = POOL_STATE.with(|s| s.borrow().get().clone());
    let pool_reserve = pool_state.reserve;

    let share_price = if total_shares == Nat::from(0u64) {
        Nat::from(100_000_000u64) 
    } else if pool_reserve == Nat::from(0u64) {
        Nat::from(1u64) 
    } else {
        pool_reserve.clone() / total_shares.clone()
    };

    let total_lps = LP_SHARES.with(|shares| {
        shares.borrow().iter()
            .filter(|(p, amt)| *p != Principal::anonymous() && amt.0 != Nat::from(0u64))
            .count() as u64
    });

    PoolStats {
        total_shares,
        pool_reserve,
        share_price,
        total_liquidity_providers: total_lps,
        minimum_liquidity_burned: if pool_state.initialized {
            Nat::from(MINIMUM_LIQUIDITY)
        } else {
            Nat::from(0u64)
        },
        is_initialized: pool_state.initialized,
    }
}

// Helper functions

fn calculate_total_supply() -> Nat {
    LP_SHARES.with(|shares| {
        shares.borrow()
            .iter()
            .map(|(_, amt)| amt.0.clone())
            .fold(Nat::from(0u64), |acc, amt| acc + amt)
    })
}

pub fn get_pool_reserve() -> u64 {
    get_pool_reserve_nat().0.to_u64().expect("Pool reserve exceeds u64")
}

pub fn get_pool_reserve_nat() -> Nat {
    POOL_STATE.with(|s| s.borrow().get().reserve.clone())
}

pub fn can_accept_bets() -> bool {
    let pool_reserve = get_pool_reserve();
    pool_reserve >= MIN_OPERATING_BALANCE
}

pub(crate) fn update_pool_on_win(payout: u64) {
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        let payout_nat = Nat::from(payout);

        if pool_state.reserve < payout_nat {
             ic_cdk::trap(&format!(
                "CRITICAL: Pool insolvent. Attempted payout {} e8s exceeds reserve {} e8s.",
                payout,
                pool_state.reserve.0.to_u64().unwrap_or(u64::MAX)
            ));
        }
        pool_state.reserve -= payout_nat;
        state.borrow_mut().set(pool_state).unwrap();
    });
}

pub(crate) fn update_pool_on_loss(bet: u64) {
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve += Nat::from(bet);
        state.borrow_mut().set(pool_state).unwrap();
    });
}

// Transfer helpers

// Re-declare local types to avoid dependency issues if necessary, but simpler to use locally defined structs if not shared
// The structs for TransferFromArgs etc are already in the file.

#[derive(CandidType, Deserialize)]
struct Account {
    owner: Principal,
    subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize)]
struct TransferFromArgs {
    from: Account,
    to: Account,
    amount: Nat,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
    spender_subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize, Debug)]
enum TransferFromError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    InsufficientAllowance { allowance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

type TransferFromResult = Result<Nat, TransferFromError>;

async fn transfer_from_user(user: Principal, amount: u64) -> Result<(), String> {
    let ledger = MAINNET_LEDGER_CANISTER_ID;
    let canister_id = ic_cdk::id();

    let args = TransferFromArgs {
        from: Account {
            owner: user,
            subaccount: None,
        },
        to: Account {
            owner: canister_id,
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: Some(Nat::from(TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
        spender_subaccount: None,
    };

    let (result,): (TransferFromResult,) =
        ic_cdk::call(ledger, "icrc2_transfer_from", (args,))
        .await
        .map_err(|e| format!("Call failed: {:?}", e))?;

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Transfer failed: {:?}", e)),
    }
}

// transfer_to_user removed (logic moved to accounting::schedule_lp_withdrawal)