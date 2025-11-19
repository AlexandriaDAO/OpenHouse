use candid::{CandidType, Deserialize, Principal, Nat};
use ic_cdk::{query, update};
use ic_cdk::api::call::RejectionCode;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{StableBTreeMap, StableVec, Storable, DefaultMemoryImpl};
use ic_stable_structures::storable::Bound;
use std::cell::RefCell;
use std::borrow::Cow;
use ic_ledger_types::{
    AccountIdentifier, TransferArgs, Tokens, DEFAULT_SUBACCOUNT,
    MAINNET_LEDGER_CANISTER_ID, Memo, AccountBalanceArgs,
};
use num_traits::ToPrimitive;

// Define ICRC-2 types manually to avoid dependency issues
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

impl From<Principal> for Account {
    fn from(owner: Principal) -> Self {
        Self {
            owner,
            subaccount: None,
        }
    }
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct TransferFromArgs {
    pub spender_subaccount: Option<[u8; 32]>,
    pub from: Account,
    pub to: Account,
    pub amount: candid::Nat,
    pub fee: Option<candid::Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum TransferFromError {
    BadFee { expected_fee: candid::Nat },
    BadBurn { min_burn_amount: candid::Nat },
    InsufficientFunds { balance: candid::Nat },
    InsufficientAllowance { allowance: candid::Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: candid::Nat },
    TemporarilyUnavailable,
    GenericError { error_code: candid::Nat, message: String },
}

use crate::{MEMORY_MANAGER, Memory};
use super::liquidity_pool;

// Constants
const ICP_TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP in e8s
const MIN_DEPOSIT: u64 = 10_000_000; // 0.1 ICP
const MIN_WITHDRAW: u64 = 10_000_000; // 0.1 ICP
const USER_BALANCES_MEMORY_ID: u8 = 10; // Memory ID for user balances
const PENDING_WITHDRAWALS_MEMORY_ID: u8 = 20;
const AUDIT_LOG_MEMORY_ID: u8 = 21;
const MAX_PAYOUT_PERCENTAGE: f64 = 0.10; // 10% of house balance

// =============================================================================
// DATA STRUCTURES
// =============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum WithdrawalType {
    User {
        amount: u64
    },
    LP {
        shares: Nat,
        reserve: Nat,
        amount: u64,
    },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PendingWithdrawal {
    pub withdrawal_type: WithdrawalType,
    pub created_at: u64,        // Idempotency Key
    pub retries: u8,
    pub last_error: Option<String>,
}

impl Storable for PendingWithdrawal {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024, // Should be enough for Nat and error strings
        is_fixed_size: false,
    };
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum AuditEventType {
    WithdrawalInitiated,
    WithdrawalCompleted,
    WithdrawalFailed,
    WithdrawalExpired,
    BalanceRestored,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AuditEntry {
    pub timestamp: u64,
    pub event_type: AuditEventType,
    pub user: Principal,
    pub amount: u64,
    pub details: String,
}

impl Storable for AuditEntry {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 2048,
        is_fixed_size: false,
    };
}

pub enum TransferError {
    Uncertain(RejectionCode, String),  // Retry
    Definite(String),                   // Rollback
}

// =============================================================================
// STORAGE
// =============================================================================

thread_local! {
    // Stable storage for persistence across upgrades
    static USER_BALANCES_STABLE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(USER_BALANCES_MEMORY_ID))),
        )
    );

    // Pending withdrawals: One per user (Principal key)
    static PENDING_WITHDRAWALS: RefCell<StableBTreeMap<Principal, PendingWithdrawal, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(PENDING_WITHDRAWALS_MEMORY_ID)))
        ));

    // Audit trail for critical events
    static WITHDRAWAL_AUDIT_LOG: RefCell<StableVec<AuditEntry, Memory>> =
        RefCell::new(StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(AUDIT_LOG_MEMORY_ID)))
        ).unwrap());

    // Cached canister balance (refreshed hourly via heartbeat)
    // This avoids 500ms ledger query on every balance check
    static CACHED_CANISTER_BALANCE: RefCell<u64> = RefCell::new(0);

    // Reentrancy guard for background processing
    static PROCESSING: RefCell<bool> = RefCell::new(false);
}

#[derive(CandidType, Deserialize, Clone)]
pub struct AccountingStats {
    pub total_user_deposits: u64,
    pub house_balance: u64,
    pub canister_balance: u64,
    pub unique_depositors: u64,
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Calculate total user deposits on-demand from stable storage
fn calculate_total_deposits() -> u64 {
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow()
            .iter()
            .map(|(_, balance)| balance)
            .sum()
    })
}

fn log_audit(event_type: AuditEventType, user: Principal, amount: u64, details: String) {
    WITHDRAWAL_AUDIT_LOG.with(|log| {
        let entry = AuditEntry {
            timestamp: ic_cdk::api::time(),
            event_type,
            user,
            amount,
            details,
        };
        log.borrow_mut().push(&entry).expect("Failed to write audit log");
    });
}

async fn attempt_transfer(user: Principal, amount: u64, created_at: u64) -> Result<u64, TransferError> {
    let transfer_args = TransferArgs {
        memo: Memo(0),
        amount: Tokens::from_e8s(amount - ICP_TRANSFER_FEE),
        fee: Tokens::from_e8s(ICP_TRANSFER_FEE),
        from_subaccount: None,
        to: AccountIdentifier::new(&user, &DEFAULT_SUBACCOUNT),
        created_at_time: Some(ic_ledger_types::Timestamp { timestamp_nanos: created_at }),
    };

    match ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, transfer_args).await {
        Ok(Ok(block_index)) => Ok(block_index),
        Ok(Err(e)) => Err(TransferError::Definite(format!("{:?}", e))),
        Err((code, msg)) => {
            match code {
                // Uncertain - might have succeeded
                RejectionCode::SysTransient | RejectionCode::Unknown => {
                    Err(TransferError::Uncertain(code, msg))
                }
                // Definite failures - safe to rollback
                RejectionCode::SysFatal
                | RejectionCode::DestinationInvalid
                | RejectionCode::CanisterReject
                | RejectionCode::CanisterError => {
                    Err(TransferError::Definite(format!("{:?}: {}", code, msg)))
                }
                RejectionCode::NoError => unreachable!(),
            }
        }
    }
}

fn rollback_withdrawal(user: Principal) -> Result<(), String> {
    let pending = PENDING_WITHDRAWALS.with(|p| p.borrow().get(&user))
        .ok_or("No pending withdrawal to rollback")?;

    match pending.withdrawal_type {
        WithdrawalType::User { amount } => {
            // Restore user balance
            USER_BALANCES_STABLE.with(|balances| {
                let mut balances = balances.borrow_mut();
                let current = balances.get(&user).unwrap_or(0);
                balances.insert(user, current + amount);
            });
            log_audit(AuditEventType::BalanceRestored, user, amount, "User withdrawal failed".to_string());
        }
        WithdrawalType::LP { shares, reserve, amount } => {
            // Restore LP shares and pool reserve
            liquidity_pool::rollback_lp_withdrawal(user, shares, reserve);
            log_audit(AuditEventType::BalanceRestored, user, amount, "LP withdrawal failed".to_string());
        }
    }

    PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&user));
    Ok(())
}

async fn execute_withdrawal(user: Principal, amount: u64, created_at: u64) -> Result<u64, String> {
    match attempt_transfer(user, amount, created_at).await {
        Ok(block_index) => {
            // Success - remove pending
            PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&user));
            log_audit(AuditEventType::WithdrawalCompleted, user, amount, format!("Block: {}", block_index));
            Ok(amount)
        }
        Err(TransferError::Definite(err)) => {
            // Definite failure - safe to rollback
            let _ = rollback_withdrawal(user);
            log_audit(AuditEventType::WithdrawalFailed, user, amount, err.clone());
            Err(format!("Withdrawal failed: {}", err))
        }
        Err(TransferError::Uncertain(code, msg)) => {
            // Uncertain - keep pending for retry
            PENDING_WITHDRAWALS.with(|p| {
                if let Some(mut pending) = p.borrow_mut().get(&user) {
                    pending.last_error = Some(format!("{:?}: {}", code, msg));
                    p.borrow_mut().insert(user, pending);
                }
            });
            Err(format!("Processing withdrawal. Check status later. Error: {:?}", code))
        }
    }
}

fn get_withdrawal_amount(pending: &PendingWithdrawal) -> u64 {
    match &pending.withdrawal_type {
        WithdrawalType::User { amount } => *amount,
        WithdrawalType::LP { amount, .. } => *amount,
    }
}

// =============================================================================
// DEPOSIT FUNCTION
// =============================================================================

#[update]
pub async fn deposit(amount: u64) -> Result<u64, String> {
    // STEP 1: Validate deposit amount
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} ICP", MIN_DEPOSIT / 100_000_000));
    }

    let caller = ic_cdk::caller();

    // STEP 2: Transfer ICP from user to canister using ICRC-2 transfer_from
    let transfer_args = TransferFromArgs {
        spender_subaccount: None,
        from: Account::from(caller),
        to: Account::from(ic_cdk::id()),
        amount: amount.into(),
        fee: None, // Use default fee
        memo: None,
        created_at_time: None,
    };

    let (result,) = ic_cdk::call::<_, (Result<candid::Nat, TransferFromError>,)>(
        MAINNET_LEDGER_CANISTER_ID,
        "icrc2_transfer_from",
        (transfer_args,),
    )
    .await
    .map_err(|(code, msg)| format!("Transfer call failed: {:?} {}", code, msg))?;

    match result {
        Ok(block_index_nat) => {
            let block_index = block_index_nat.0.to_u64().ok_or("Block index too large")?;
            
            // Credit user with amount MINUS fee
            let received_amount = amount.saturating_sub(ICP_TRANSFER_FEE);
            
            let new_balance = USER_BALANCES_STABLE.with(|balances| {
                let mut balances = balances.borrow_mut();
                let current = balances.get(&caller).unwrap_or(0);
                let new_bal = current + received_amount;
                balances.insert(caller, new_bal);
                new_bal
            });

            ic_cdk::println!("Deposit successful: {} deposited {} e8s (net {}) at block {}", 
                caller, amount, received_amount, block_index);
            Ok(new_balance)
        }
        Err(e) => Err(format!("Transfer failed: {:?}", e)),
    }
}

// =============================================================================
// LP INTEGRATION HELPERS
// =============================================================================

pub fn check_pending(user: Principal) -> Option<PendingWithdrawal> {
    PENDING_WITHDRAWALS.with(|p| p.borrow().get(&user))
}

pub async fn register_lp_withdrawal(user: Principal, shares: Nat, reserve: Nat, amount: u64) -> Result<u64, String> {
    let created_at = ic_cdk::api::time();
    let pending = PendingWithdrawal {
        withdrawal_type: WithdrawalType::LP {
            shares,
            reserve,
            amount,
        },
        created_at,
        retries: 0,
        last_error: None,
    };
    PENDING_WITHDRAWALS.with(|p| p.borrow_mut().insert(user, pending));
    log_audit(AuditEventType::WithdrawalInitiated, user, amount, "LP withdraw_all".to_string());

    execute_withdrawal(user, amount, created_at).await
}

// =============================================================================
// WITHDRAW ALL FUNCTION
// =============================================================================

#[update]
pub async fn withdraw_all() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let balance = get_balance_internal(caller);

    // Check for existing pending
    if balance == 0 {
        if let Some(pending) = PENDING_WITHDRAWALS.with(|p| p.borrow().get(&caller)) {
            return Err(format!("Withdrawal pending (retries: {})", pending.retries));
        }
        return Err("No balance to withdraw".to_string());
    }

    // Validate minimum
    if balance < MIN_WITHDRAW {
        return Err(format!("Minimum withdrawal: {} e8s", MIN_WITHDRAW));
    }

    // ATOMIC: Deduct balance + create pending
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow_mut().insert(caller, 0);
    });
    
    let created_at = ic_cdk::api::time();
    let pending = PendingWithdrawal {
        withdrawal_type: WithdrawalType::User { amount: balance },
        created_at,
        retries: 0,
        last_error: None,
    };
    PENDING_WITHDRAWALS.with(|p| p.borrow_mut().insert(caller, pending));
    log_audit(AuditEventType::WithdrawalInitiated, caller, balance, "User withdraw_all".to_string());

    // Attempt transfer
    execute_withdrawal(caller, balance, created_at).await
}

// =============================================================================
// BACKGROUND PROCESSING
// =============================================================================

const MAX_RETRIES: u8 = 10;
const BATCH_SIZE: usize = 50;

pub async fn process_pending_withdrawals() {
    // Prevent reentrancy (timers can overlap)
    if PROCESSING.with(|p| *p.borrow()) {
        return; // Already processing
    }
    PROCESSING.with(|p| *p.borrow_mut() = true);

    // Process in batches
    let pending: Vec<(Principal, PendingWithdrawal)> = PENDING_WITHDRAWALS.with(|p| {
        p.borrow()
            .iter()
            .take(BATCH_SIZE)
            .collect()
    });

    for (user, mut pending_withdrawal) in pending {
        // Check max retries
        if pending_withdrawal.retries >= MAX_RETRIES {
            // Give up - rollback
            ic_cdk::println!(
                "CRITICAL: Withdrawal exceeded max retries. User: {}, Amount: {:?}",
                user,
                pending_withdrawal.withdrawal_type
            );
            log_audit(
                AuditEventType::WithdrawalExpired,
                user,
                get_withdrawal_amount(&pending_withdrawal),
                format!("Max retries ({}) exceeded", MAX_RETRIES)
            );
            let _ = rollback_withdrawal(user);
            continue;
        }

        // Retry with SAME created_at_time (idempotent)
        let amount = get_withdrawal_amount(&pending_withdrawal);
        match attempt_transfer(user, amount, pending_withdrawal.created_at).await {
            Ok(block_index) => {
                // Success
                PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&user));
                log_audit(
                    AuditEventType::WithdrawalCompleted,
                    user,
                    amount,
                    format!("Block: {} (retry {})", block_index, pending_withdrawal.retries)
                );
            }
            Err(TransferError::Definite(err)) => {
                // Definite failure - rollback
                let _ = rollback_withdrawal(user);
                log_audit(AuditEventType::WithdrawalFailed, user, amount, err);
            }
            Err(TransferError::Uncertain(code, msg)) => {
                // Still uncertain - increment retries
                pending_withdrawal.retries += 1;
                pending_withdrawal.last_error = Some(format!("{:?}: {}", code, msg));
                PENDING_WITHDRAWALS.with(|p| {
                    p.borrow_mut().insert(user, pending_withdrawal);
                });
            }
        }
    }

    PROCESSING.with(|p| *p.borrow_mut() = false);
}

// =============================================================================
// QUERIES
// =============================================================================

#[derive(CandidType)]
pub enum WithdrawalStatusResponse {
    None,
    Pending {
        amount: u64,
        retries: u8,
        last_error: Option<String>,
    },
}

#[query]
pub fn get_withdrawal_status() -> WithdrawalStatusResponse {
    let caller = ic_cdk::caller();

    if let Some(pending) = PENDING_WITHDRAWALS.with(|p| p.borrow().get(&caller)) {
        WithdrawalStatusResponse::Pending {
            amount: get_withdrawal_amount(&pending),
            retries: pending.retries,
            last_error: pending.last_error,
        }
    } else {
        WithdrawalStatusResponse::None
    }
}

#[query]
pub fn get_audit_log(start: usize, limit: usize) -> Vec<AuditEntry> {
    WITHDRAWAL_AUDIT_LOG.with(|log| {
        log.borrow()
            .iter()
            .skip(start)
            .take(limit)
            .collect()
    })
}

// =============================================================================
// BALANCE QUERIES (INTERNAL)
// =============================================================================

pub(crate) fn get_balance_internal(user: Principal) -> u64 {
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow().get(&user).unwrap_or(0)
    })
}

/// Get the maximum allowed payout (10% of house balance)
/// Fast query using cached balance - no ledger call needed
pub(crate) fn get_max_allowed_payout_internal() -> u64 {
    let house_balance = liquidity_pool::get_pool_reserve();
    (house_balance as f64 * MAX_PAYOUT_PERCENTAGE) as u64
}

pub(crate) fn get_accounting_stats_internal() -> AccountingStats {
    let total_deposits = calculate_total_deposits();
    let unique_depositors = USER_BALANCES_STABLE.with(|balances|
        balances.borrow().iter().count() as u64
    );

    let canister_balance = CACHED_CANISTER_BALANCE.with(|cache| *cache.borrow());
    let house_balance = liquidity_pool::get_pool_reserve();

    AccountingStats {
        total_user_deposits: total_deposits,
        house_balance,
        canister_balance,
        unique_depositors,
    }
}

// =============================================================================
// AUDIT FUNCTIONS (INTERNAL)
// =============================================================================

pub(crate) fn audit_balances_internal() -> Result<String, String> {
    let total_deposits = calculate_total_deposits();
    let canister_balance = CACHED_CANISTER_BALANCE.with(|cache| *cache.borrow());
    let pool_reserve = liquidity_pool::get_pool_reserve();

    let calculated_total = pool_reserve + total_deposits;

    if calculated_total == canister_balance {
        Ok(format!("✅ Audit passed: pool_reserve ({}) + deposits ({}) = canister ({})",
                   pool_reserve, total_deposits, canister_balance))
    } else {
        Err(format!("❌ Audit FAILED: pool_reserve ({}) + deposits ({}) = {} != canister ({})",
                    pool_reserve, total_deposits, calculated_total, canister_balance))
    }
}

// =============================================================================
// BALANCE UPDATE (Internal use only)
// =============================================================================

/// Update user balance (called by game logic)
/// Note: Total deposits are calculated on-demand, so no need to track separately
pub fn update_balance(user: Principal, new_balance: u64) -> Result<(), String> {
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow_mut().insert(user, new_balance);
    });

    Ok(())
}

// =============================================================================
// COMPATIBILITY FUNCTION
// =============================================================================

/// Refresh canister balance from ledger and update cache
/// Called by heartbeat every hour to keep cache fresh
#[update]
pub async fn refresh_canister_balance() -> u64 {
    let ledger = MAINNET_LEDGER_CANISTER_ID;
    let result: Result<(Tokens,), _> = ic_cdk::call(ledger, "account_balance", (AccountBalanceArgs {
        account: AccountIdentifier::new(&ic_cdk::id(), &DEFAULT_SUBACCOUNT)
    },)).await;

    match result {
        Ok((balance,)) => {
            let balance_u64 = balance.e8s();
            // Update the cache
            CACHED_CANISTER_BALANCE.with(|cache| {
                *cache.borrow_mut() = balance_u64;
            });
            ic_cdk::println!("Balance cache refreshed: {} e8s", balance_u64);
            balance_u64
        }
        Err(e) => {
            // Return cached value on error
            ic_cdk::println!("⚠️ Failed to refresh balance, using cache: {:?}", e);
            CACHED_CANISTER_BALANCE.with(|cache| *cache.borrow())
        }
    }
}

// Internal transfer function for withdrawals (used by liquidity_pool)
pub(crate) async fn transfer_to_user(recipient: Principal, amount: u64) -> Result<(), String> {
    let transfer_args = TransferArgs {
        memo: Memo(0),
        amount: Tokens::from_e8s(amount),
        fee: Tokens::from_e8s(10_000),
        from_subaccount: None,
        to: AccountIdentifier::new(&recipient, &DEFAULT_SUBACCOUNT),
        created_at_time: None,
    };

    match ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, transfer_args).await {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(format!("Transfer failed: {:?}", e)),
        Err((code, msg)) => Err(format!("Transfer call failed: {:?} {}", code, msg)),
    }
}

// =============================================================================
// ADMIN & DEBUG FUNCTIONS
// =============================================================================
// Removed per user request to maintain atomic ethos.
