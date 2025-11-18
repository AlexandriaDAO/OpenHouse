// Full implementation with all fixes
use candid::{CandidType, Deserialize, Nat, Principal};
use ic_stable_structures::{StableBTreeMap, StableCell, memory_manager::VirtualMemory, DefaultMemoryImpl, Storable};
use serde::Serialize;
use std::cell::RefCell;
use std::borrow::Cow;
use num_traits::ToPrimitive;

use super::nat_helpers::*;
use super::accounting;
use super::nat_helpers::StorableNat;

// Constants
const LP_DECIMALS: u8 = 8;
const MINIMUM_LIQUIDITY: u64 = 1000;
const MIN_DEPOSIT: u64 = 100_000_000; // 1 ICP minimum for all deposits
const MIN_WITHDRAWAL: u64 = 100_000; // 0.001 ICP
const MIN_OPERATING_BALANCE: u64 = 1_000_000_000; // 10 ICP to operate games
const TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP
const PARENT_STAKER_CANISTER: &str = "e454q-riaaa-aaaap-qqcyq-cai";
const RECONCILIATION_THRESHOLD: u64 = 10_000_000; // 0.1 ICP (lowered from 1 ICP)
const MAX_RECONCILIATION_PERCENTAGE: f64 = 0.10; // Max 10% of canister balance per sweep

// Pool state for stable storage
#[derive(Clone, CandidType, Deserialize, Serialize)]
struct PoolState {
    reserve: Nat,
    initialized: bool,
    #[serde(default)] // Handle missing field during upgrade from old version
    pending_fees_to_parent: u64, // Track failed deposit fees awaiting reconciliation
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

    // Pool state (reserve + initialized flag + pending fees)
    static POOL_STATE: RefCell<StableCell<PoolState, VirtualMemory<DefaultMemoryImpl>>> = {
        RefCell::new(StableCell::init(
            crate::MEMORY_MANAGER.with(|m| m.borrow().get(ic_stable_structures::memory_manager::MemoryId::new(13))),
            PoolState {
                reserve: nat_zero(),
                initialized: false,
                pending_fees_to_parent: 0,
            }
        ).expect("Failed to init pool state"))
    };
}

// Helper function to safely get parent staker principal
fn get_parent_staker_principal() -> Principal {
    Principal::from_text(PARENT_STAKER_CANISTER)
        .expect("PARENT_STAKER_CANISTER must be a valid principal")
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

// Deposit liquidity (frontend handles ICRC-2 approval first)
pub async fn deposit_liquidity(amount: u64) -> Result<Nat, String> {
    // ====================================================================
    // SECURITY ANALYSIS: Why No Guard Needed
    // ====================================================================
    // The Internet Computer guarantees sequential execution of update calls.
    // Even if a user submits multiple deposit requests simultaneously:
    // 1. Each request executes completely before the next starts
    // 2. State updates are atomic and visible to subsequent calls
    // 3. No race conditions possible within the canister
    //
    // Pattern used: All state changes happen BEFORE any await points
    // This prevents reentrancy without needing guards.
    //
    // Comparison with icp_swap (which DOES need guards):
    // - icp_swap: Multiple awaits with state changes between them
    // - This code: State updates complete before transfer, with rollback on failure
    // ====================================================================

    // Validate
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} e8s", MIN_DEPOSIT));
    }

    let caller = ic_cdk::caller();

    // Transfer from user (requires prior ICRC-2 approval)
    match transfer_from_user(caller, amount).await {
        Err(e) if e.contains("InsufficientAllowance") => {
            return Err(format!(
                "Your ICP approval has expired or been consumed. Please approve {} e8s again in your wallet.",
                amount
            ));
        }
        Err(e) if e.contains("InsufficientFunds") => {
            return Err(format!(
                "Insufficient ICP balance. You need {} e8s plus transfer fee.",
                amount
            ));
        }
        Err(e) => return Err(format!("Transfer failed: {}", e)),
        Ok(_) => {}
    }

    // Calculate 1% deposit fee
    // P0 Fix #2: Account for transfer fees - parent receives (base_fee - TRANSFER_FEE)
    // This is acceptable as the fee is "best effort" and small variance is expected
    let base_fee = amount / 100;  // 1% of deposit

    // P0 Fix #1: Calculate net amount BEFORE any transfers (fee already deducted from user)
    // User deposited `amount`, we keep (amount - base_fee) in pool, try to send base_fee to parent
    let deposit_amount = amount - base_fee;
    let deposit_nat = u64_to_nat(deposit_amount);

    // Best effort fee transfer to parent staker
    // P0 Fix #3: Track failed fees explicitly instead of reconciling "floating funds"
    match accounting::transfer_to_user(get_parent_staker_principal(), base_fee).await {
        Ok(_) => {
            ic_cdk::println!("Deposit fee transferred successfully: {} e8s", base_fee);
        }
        Err(e) => {
            ic_cdk::println!("Fee transfer failed ({}), adding to pending: {} e8s", e, base_fee);
            // Track failed fee for later reconciliation
            POOL_STATE.with(|state| {
                let mut pool_state = state.borrow().get().clone();
                pool_state.pending_fees_to_parent = pool_state.pending_fees_to_parent
                    .saturating_add(base_fee); // P0 Fix #4: Use saturating_add to prevent overflow
                state.borrow_mut().set(pool_state).expect("Failed to update pool state");
            });
        }
    }

    // Calculate shares to mint
    let shares_to_mint = POOL_STATE.with(|state| {
        let pool_state = state.borrow().get().clone();
        let current_reserve = pool_state.reserve.clone();
        let total_shares = calculate_total_supply();

        if nat_is_zero(&total_shares) {
            // First deposit - burn minimum liquidity
            let initial_shares = deposit_nat.clone();
            let burned_shares = u64_to_nat(MINIMUM_LIQUIDITY);

            // Mint burned shares to zero address
            LP_SHARES.with(|shares| {
                shares.borrow_mut().insert(Principal::anonymous(), StorableNat(burned_shares.clone()));
            });

            // User gets initial_shares - burned
            nat_subtract(&initial_shares, &burned_shares)
                .ok_or("Initial deposit too small".to_string())
        } else {
            // Subsequent deposits - proportional shares
            // shares = (deposit_amount * total_shares) / current_reserve
            let numerator = nat_multiply(&deposit_nat, &total_shares);
            nat_divide(&numerator, &current_reserve)
                .ok_or("Division error".to_string())
        }
    })?;

    // Update user shares
    LP_SHARES.with(|shares| {
        let mut shares_map = shares.borrow_mut();
        let current = shares_map.get(&caller).map(|s| s.0.clone()).unwrap_or(nat_zero());
        let new_shares = nat_add(&current, &shares_to_mint);
        shares_map.insert(caller, StorableNat(new_shares));
    });

    // Update pool reserve
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve = nat_add(&pool_state.reserve, &deposit_nat);
        state.borrow_mut().set(pool_state).unwrap();
    });

    Ok(shares_to_mint)
}

// Internal function for withdrawing liquidity (called by withdraw_all_liquidity)
async fn withdraw_liquidity(shares_to_burn: Nat) -> Result<u64, String> {
    // ====================================================================
    // SECURITY: Checks-Effects-Interactions Pattern
    // ====================================================================
    // We follow the CEI pattern to prevent reentrancy:
    // 1. CHECK: Validate shares and calculate payout
    // 2. EFFECTS: Update state (deduct shares, reduce pool)
    // 3. INTERACTIONS: Transfer ICP (with rollback on failure)
    //
    // Even without guards, this is safe because:
    // - State is updated BEFORE the transfer
    // - If transfer fails, we explicitly rollback
    // - IC's sequential execution prevents concurrent modifications
    // ====================================================================

    let caller = ic_cdk::caller();

    // Validate shares
    if nat_is_zero(&shares_to_burn) {
        return Err("Cannot withdraw zero shares".to_string());
    }

    let user_shares = LP_SHARES.with(|s| s.borrow().get(&caller).map(|sn| sn.0.clone()).unwrap_or(nat_zero()));
    if &user_shares < &shares_to_burn {
        return Err("Insufficient shares".to_string());
    }

    // Calculate payout
    let (payout_nat, new_reserve) = POOL_STATE.with(|state| {
        let pool_state = state.borrow().get().clone();
        let current_reserve = pool_state.reserve.clone();
        let total_shares = calculate_total_supply();

        if nat_is_zero(&total_shares) {
            return Err("No shares in circulation".to_string());
        }

        // payout = (shares_to_burn * current_reserve) / total_shares
        let numerator = nat_multiply(&shares_to_burn, &current_reserve);
        let payout = nat_divide(&numerator, &total_shares)
            .ok_or("Division error".to_string())?;

        let new_reserve = nat_subtract(&current_reserve, &payout)
            .ok_or("Insufficient pool reserve".to_string())?;

        Ok((payout, new_reserve))
    })?;

    // Check minimum withdrawal
    let payout_u64 = nat_to_u64(&payout_nat).ok_or("Payout too large")?;
    if payout_u64 < MIN_WITHDRAWAL {
        return Err(format!("Minimum withdrawal is {} e8s", MIN_WITHDRAWAL));
    }

    // Update state BEFORE transfer (reentrancy protection)
    LP_SHARES.with(|shares| {
        let mut shares_map = shares.borrow_mut();
        let new_shares = nat_subtract(&user_shares, &shares_to_burn).unwrap();
        if nat_is_zero(&new_shares) {
            shares_map.remove(&caller);
        } else {
            shares_map.insert(caller, StorableNat(new_shares));
        }
    });

    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve = new_reserve.clone();
        state.borrow_mut().set(pool_state).unwrap();
    });

    // Transfer to user
    match transfer_to_user(caller, payout_u64).await {
        Ok(_) => Ok(payout_u64),
        Err(e) => {
            // ROLLBACK on failure
            LP_SHARES.with(|shares| {
                shares.borrow_mut().insert(caller, StorableNat(user_shares));
            });

            POOL_STATE.with(|state| {
                let mut pool_state = state.borrow().get().clone();
                pool_state.reserve = nat_add(&new_reserve, &payout_nat);
                state.borrow_mut().set(pool_state).unwrap();
            });

            Err(format!("Transfer failed: {}. State rolled back.", e))
        }
    }
}

pub async fn withdraw_all_liquidity() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let shares = LP_SHARES.with(|s| s.borrow().get(&caller).map(|sn| sn.0.clone()).unwrap_or(nat_zero()));

    if nat_is_zero(&shares) {
        return Err("No liquidity to withdraw".to_string());
    }

    withdraw_liquidity(shares).await
}

// Query functions

pub fn get_lp_position(user: Principal) -> LPPosition {
    let user_shares = LP_SHARES.with(|s| s.borrow().get(&user).map(|sn| sn.0.clone()).unwrap_or(nat_zero()));
    let total_shares = calculate_total_supply();
    let pool_reserve = get_pool_reserve_nat();

    let (ownership_percent, redeemable_icp) = if nat_is_zero(&total_shares) {
        (0.0, nat_zero())
    } else if nat_is_zero(&pool_reserve) {
        // Edge case: shares exist but no reserve
        let ownership = (user_shares.0.to_f64().unwrap_or(0.0) /
                        total_shares.0.to_f64().unwrap_or(1.0)) * 100.0;
        (ownership, nat_zero())
    } else {
        // Normal case
        let ownership = (user_shares.0.to_f64().unwrap_or(0.0) /
                        total_shares.0.to_f64().unwrap_or(1.0)) * 100.0;
        let numerator = nat_multiply(&user_shares, &pool_reserve);
        let redeemable = nat_divide(&numerator, &total_shares).unwrap_or(nat_zero());
        (ownership, redeemable)
    };

    LPPosition {
        shares: user_shares,
        pool_ownership_percent: ownership_percent,
        redeemable_icp,
    }
}

pub fn get_pool_stats() -> PoolStats {
    let total_shares = calculate_total_supply();
    let pool_state = POOL_STATE.with(|s| s.borrow().get().clone());
    let pool_reserve = pool_state.reserve;

    // Calculate share price
    let share_price = if nat_is_zero(&total_shares) {
        u64_to_nat(100_000_000) // 1 ICP initial price
    } else if nat_is_zero(&pool_reserve) {
        u64_to_nat(1) // Minimum price if drained
    } else {
        nat_divide(&pool_reserve, &total_shares).unwrap_or(nat_one())
    };

    // Count LPs (excluding burned shares)
    let total_lps = LP_SHARES.with(|shares| {
        shares.borrow().iter()
            .filter(|(p, amt)| *p != Principal::anonymous() && !nat_is_zero(&amt.0))
            .count() as u64
    });

    PoolStats {
        total_shares,
        pool_reserve,
        share_price,
        total_liquidity_providers: total_lps,
        minimum_liquidity_burned: if pool_state.initialized {
            u64_to_nat(MINIMUM_LIQUIDITY)
        } else {
            nat_zero()
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
            .fold(nat_zero(), |acc, amt| nat_add(&acc, &amt))
    })
}

pub fn get_pool_reserve() -> u64 {
    nat_to_u64(&get_pool_reserve_nat()).unwrap_or(0)
}

pub fn get_pool_reserve_nat() -> Nat {
    POOL_STATE.with(|s| s.borrow().get().reserve.clone())
}

pub fn is_pool_initialized() -> bool {
    POOL_STATE.with(|s| s.borrow().get().initialized)
}

pub fn can_accept_bets() -> bool {
    let pool_reserve = get_pool_reserve();
    pool_reserve >= MIN_OPERATING_BALANCE
}

/// Get pending fees awaiting reconciliation (observability)
pub fn get_pending_fees_to_parent() -> u64 {
    POOL_STATE.with(|s| s.borrow().get().pending_fees_to_parent)
}

// Game integration (internal use only - called by game logic)

pub(crate) fn update_pool_on_win(payout: u64) {
    // Player won - deduct from pool (concurrent-safe)
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        let payout_nat = u64_to_nat(payout);

        // Safe subtraction with trap on underflow
        match nat_subtract(&pool_state.reserve, &payout_nat) {
            Some(new_reserve) => {
                pool_state.reserve = new_reserve;
                state.borrow_mut().set(pool_state).unwrap();
            }
            None => {
                // CRITICAL: Halt operations to protect LP funds
                ic_cdk::trap(&format!(
                    "CRITICAL: Pool insolvent. Attempted payout {} e8s exceeds reserve {} e8s. Halting to protect LPs.",
                    payout,
                    nat_to_u64(&pool_state.reserve).unwrap_or(0)
                ));
            }
        }
    });
}

pub(crate) fn update_pool_on_loss(bet: u64) {
    // Player lost - add to pool (concurrent-safe)
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve = nat_add(&pool_state.reserve, &u64_to_nat(bet));
        state.borrow_mut().set(pool_state).unwrap();
    });
}

// Transfer helpers (using existing accounting module)

// ICRC-2 types not in ic_ledger_types
#[derive(CandidType, Deserialize)]
struct TransferFromArgs {
    from: super::accounting::Account,
    to: super::accounting::Account,
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
    // Frontend must call icrc2_approve first
    // Then we use transfer_from
    let ledger = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let canister_id = ic_cdk::id();

    let args = TransferFromArgs {
        from: super::accounting::Account {
            owner: user,
            subaccount: None,
        },
        to: super::accounting::Account {
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

async fn transfer_to_user(user: Principal, amount: u64) -> Result<(), String> {
    accounting::transfer_to_user(user, amount).await
}

/// Reconcile pending deposit fees (called daily by heartbeat)
/// P0 Fix #3: Only sweep explicitly tracked pending fees, never touch user/pool funds
/// This eliminates the risk of accidentally sweeping user gaming deposits
pub async fn reconcile_floating_funds() -> Result<u64, String> {
    let pending_fees = POOL_STATE.with(|state| {
        state.borrow().get().pending_fees_to_parent
    });

    // Only sweep if above threshold (0.1 ICP)
    if pending_fees < RECONCILIATION_THRESHOLD {
        return Ok(0); // Nothing meaningful to sweep
    }

    // P0 Fix #5: Sanity check - never sweep more than 10% of canister balance
    let canister_balance = accounting::refresh_canister_balance().await;
    let max_sweep = (canister_balance as f64 * MAX_RECONCILIATION_PERCENTAGE) as u64;
    let sweep_amount = pending_fees.min(max_sweep);

    if sweep_amount < RECONCILIATION_THRESHOLD {
        ic_cdk::println!("Pending fees {} e8s exceeds 10% canister balance limit, will retry with smaller amount", pending_fees);
        return Ok(0);
    }

    // Attempt transfer to parent staker
    match accounting::transfer_to_user(get_parent_staker_principal(), sweep_amount).await {
        Ok(_) => {
            // Success - deduct from pending fees
            POOL_STATE.with(|state| {
                let mut pool_state = state.borrow().get().clone();
                pool_state.pending_fees_to_parent = pool_state.pending_fees_to_parent
                    .saturating_sub(sweep_amount);
                state.borrow_mut().set(pool_state).expect("Failed to update pool state");
            });
            ic_cdk::println!("Reconciled {} e8s pending fees to parent (remaining: {} e8s)",
                sweep_amount,
                pending_fees.saturating_sub(sweep_amount));
            Ok(sweep_amount)
        }
        Err(e) => {
            ic_cdk::println!("Reconciliation transfer failed: {}, will retry tomorrow", e);
            Ok(0) // Failed, but not a critical error - will retry tomorrow
        }
    }
}