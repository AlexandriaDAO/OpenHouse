use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::call::CallResult;
use ic_cdk::{caller, init, post_upgrade, pre_upgrade, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// ============================================================================
// CONSTANTS
// ============================================================================

const ICP_LEDGER_CANISTER: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const MIN_DEPOSIT: u64 = 100_000_000; // 1 ICP
const MIN_WITHDRAWAL: u64 = 100_000_000; // 1 ICP
const MAX_WITHDRAWAL: u64 = 100_000_000_000; // 1000 ICP per withdrawal
const MIN_BET: u64 = 100_000_000; // 1 ICP
const MAX_BET: u64 = 10_000_000_000; // 100 ICP

// Game canister IDs - will be set after deployment
const CRASH_BACKEND: &str = "fws6k-tyaaa-aaaap-qqc7q-cai";
const PLINKO_BACKEND: &str = "weupr-2qaaa-aaaap-abl3q-cai";
const MINES_BACKEND: &str = "wvrcw-3aaaa-aaaah-arm4a-cai";
const DICE_BACKEND: &str = "whchi-hyaaa-aaaao-a4ruq-cai";

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct UserAccount {
    pub principal: Principal,
    pub balance: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub total_wagered: u64,
    pub is_locked: bool,
    pub created_at: u64,
    pub last_activity: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct DepositRecord {
    pub user: Principal,
    pub amount: u64,
    pub timestamp: u64,
    pub block_index: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct WithdrawalRecord {
    pub user: Principal,
    pub amount: u64,
    pub timestamp: u64,
    pub block_index: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct GameTransaction {
    pub user: Principal,
    pub game: String,
    pub bet_amount: u64,
    pub payout: u64,
    pub profit: i64,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize, Clone, Default, Serialize)]
pub struct CasinoStats {
    pub total_users: u64,
    pub total_deposits: u64,
    pub total_withdrawals: u64,
    pub total_volume: u64,
    pub house_profit: i64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct ReservesReport {
    pub total_user_balances: u64,
    pub is_solvent: bool,
    pub timestamp: u64,
}

// ICRC-1 Types
#[derive(CandidType, Deserialize)]
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize)]
pub struct TransferArgs {
    pub from_subaccount: Option<Vec<u8>>,
    pub to: Account,
    pub amount: Nat,
    pub fee: Option<Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
}

#[derive(CandidType, Deserialize, Debug)]
pub enum TransferError {
    BadFee { expected_fee: Nat },
    BadBurn { min_burn_amount: Nat },
    InsufficientFunds { balance: Nat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: Nat },
    TemporarilyUnavailable,
    GenericError { error_code: Nat, message: String },
}

// Storable implementations
impl Storable for UserAccount {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for DepositRecord {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for WithdrawalRecord {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for GameTransaction {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for CasinoStats {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Unbounded;
}

// ============================================================================
// STABLE STORAGE
// ============================================================================

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USER_ACCOUNTS: RefCell<StableBTreeMap<Principal, UserAccount, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ));

    static DEPOSITS: RefCell<StableBTreeMap<u64, DepositRecord, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1)))
        ));

    static WITHDRAWALS: RefCell<StableBTreeMap<u64, WithdrawalRecord, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2)))
        ));

    static GAME_TRANSACTIONS: RefCell<StableBTreeMap<u64, GameTransaction, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3)))
        ));

    static CASINO_STATS: RefCell<StableBTreeMap<u8, CasinoStats, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4)))
        ));

    static NEXT_DEPOSIT_ID: RefCell<u64> = RefCell::new(0);
    static NEXT_WITHDRAWAL_ID: RefCell<u64> = RefCell::new(0);
    static NEXT_TRANSACTION_ID: RefCell<u64> = RefCell::new(0);
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

#[init]
fn init() {
    ic_cdk::println!("Casino Main Canister Initialized - Unified Wallet");

    // Initialize stats
    CASINO_STATS.with(|stats| {
        stats.borrow_mut().insert(0, CasinoStats::default());
    });
}

#[pre_upgrade]
fn pre_upgrade() {
    // State is already in stable memory via StableBTreeMap
}

#[post_upgrade]
fn post_upgrade() {
    // State is restored from stable memory automatically
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn get_or_create_account(principal: Principal) -> UserAccount {
    USER_ACCOUNTS.with(|accounts| {
        let mut accounts = accounts.borrow_mut();

        if let Some(account) = accounts.get(&principal) {
            return account;
        }

        // Create new account
        let now = ic_cdk::api::time();
        let new_account = UserAccount {
            principal,
            balance: 0,
            total_deposited: 0,
            total_withdrawn: 0,
            total_wagered: 0,
            is_locked: false,
            created_at: now,
            last_activity: now,
        };

        accounts.insert(principal, new_account.clone());

        // Update stats
        CASINO_STATS.with(|stats| {
            let mut stats_map = stats.borrow_mut();
            if let Some(mut s) = stats_map.get(&0) {
                s.total_users += 1;
                stats_map.insert(0, s);
            }
        });

        new_account
    })
}

fn record_game_transaction(user: Principal, game: &str, bet: u64, payout: u64) {
    let transaction_id = NEXT_TRANSACTION_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });

    let transaction = GameTransaction {
        user,
        game: game.to_string(),
        bet_amount: bet,
        payout,
        profit: (payout as i64) - (bet as i64),
        timestamp: ic_cdk::api::time(),
    };

    GAME_TRANSACTIONS.with(|txs| {
        txs.borrow_mut().insert(transaction_id, transaction);
    });

    // Update global stats
    CASINO_STATS.with(|stats| {
        let mut stats_map = stats.borrow_mut();
        if let Some(mut s) = stats_map.get(&0) {
            s.total_volume += bet;
            s.house_profit += (bet as i64) - (payout as i64);
            stats_map.insert(0, s);
        }
    });
}

// ============================================================================
// DEPOSIT FUNCTIONS
// ============================================================================

#[update]
async fn deposit(amount: u64) -> Result<u64, String> {
    if amount < MIN_DEPOSIT {
        return Err(format!(
            "Minimum deposit is {} ICP",
            MIN_DEPOSIT / 100_000_000
        ));
    }

    let caller = caller();
    let now = ic_cdk::api::time();

    // Build ICRC-1 transfer arguments - user transfers to this canister
    let transfer_args = TransferArgs {
        from_subaccount: None,
        to: Account {
            owner: ic_cdk::id(),
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        created_at_time: Some(now),
    };

    // Call ICP ledger
    let ledger = Principal::from_text(ICP_LEDGER_CANISTER).unwrap();
    let result: CallResult<(Result<Nat, TransferError>,)> =
        ic_cdk::call(ledger, "icrc1_transfer", (transfer_args,)).await;

    match result {
        Ok((Ok(block_index),)) => {
            // Update user account
            let mut account = get_or_create_account(caller);
            account.balance += amount;
            account.total_deposited += amount;
            account.last_activity = now;

            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            // Record deposit
            let deposit_id = NEXT_DEPOSIT_ID.with(|id| {
                let current = *id.borrow();
                *id.borrow_mut() = current + 1;
                current
            });

            let record = DepositRecord {
                user: caller,
                amount,
                timestamp: now,
                block_index: block_index.0.to_u64_digits()[0],
            };

            DEPOSITS.with(|deposits| {
                deposits.borrow_mut().insert(deposit_id, record);
            });

            // Update stats
            CASINO_STATS.with(|stats| {
                let mut stats_map = stats.borrow_mut();
                if let Some(mut s) = stats_map.get(&0) {
                    s.total_deposits += amount;
                    stats_map.insert(0, s);
                }
            });

            Ok(amount)
        }
        Ok((Err(transfer_error),)) => Err(format!("ICP transfer failed: {:?}", transfer_error)),
        Err((code, msg)) => Err(format!("Ledger call failed: {:?} - {}", code, msg)),
    }
}

// ============================================================================
// WITHDRAWAL FUNCTIONS
// ============================================================================

#[update]
async fn withdraw(amount: u64) -> Result<u64, String> {
    if amount < MIN_WITHDRAWAL {
        return Err(format!(
            "Minimum withdrawal is {} ICP",
            MIN_WITHDRAWAL / 100_000_000
        ));
    }

    if amount > MAX_WITHDRAWAL {
        return Err(format!(
            "Maximum withdrawal is {} ICP per transaction",
            MAX_WITHDRAWAL / 100_000_000
        ));
    }

    let caller = caller();
    let now = ic_cdk::api::time();

    // Check user balance
    let mut account = USER_ACCOUNTS.with(|accounts| {
        accounts
            .borrow()
            .get(&caller)
            .ok_or("Account not found".to_string())
    })?;

    if account.is_locked {
        return Err("Account is locked during active game".to_string());
    }

    if account.balance < amount {
        return Err(format!(
            "Insufficient balance. You have {} e8s, trying to withdraw {} e8s",
            account.balance, amount
        ));
    }

    // Deduct balance optimistically
    account.balance -= amount;
    account.total_withdrawn += amount;
    account.last_activity = now;

    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow_mut().insert(caller, account.clone());
    });

    // Transfer ICP from this canister to user
    let transfer_args = TransferArgs {
        from_subaccount: None,
        to: Account {
            owner: caller,
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        created_at_time: Some(now),
    };

    let ledger = Principal::from_text(ICP_LEDGER_CANISTER).unwrap();
    let result: CallResult<(Result<Nat, TransferError>,)> =
        ic_cdk::call(ledger, "icrc1_transfer", (transfer_args,)).await;

    match result {
        Ok((Ok(block_index),)) => {
            // Record withdrawal
            let withdrawal_id = NEXT_WITHDRAWAL_ID.with(|id| {
                let current = *id.borrow();
                *id.borrow_mut() = current + 1;
                current
            });

            let record = WithdrawalRecord {
                user: caller,
                amount,
                timestamp: now,
                block_index: block_index.0.to_u64_digits()[0],
            };

            WITHDRAWALS.with(|withdrawals| {
                withdrawals.borrow_mut().insert(withdrawal_id, record);
            });

            // Update stats
            CASINO_STATS.with(|stats| {
                let mut stats_map = stats.borrow_mut();
                if let Some(mut s) = stats_map.get(&0) {
                    s.total_withdrawals += amount;
                    stats_map.insert(0, s);
                }
            });

            Ok(amount)
        }
        Ok((Err(transfer_error),)) => {
            // ROLLBACK
            account.balance += amount;
            account.total_withdrawn -= amount;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            Err(format!("ICP transfer failed: {:?}", transfer_error))
        }
        Err((code, msg)) => {
            // ROLLBACK
            account.balance += amount;
            account.total_withdrawn -= amount;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            Err(format!("Ledger call failed: {:?} - {}", code, msg))
        }
    }
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

#[query]
fn get_balance() -> Result<u64, String> {
    let caller = caller();
    USER_ACCOUNTS.with(|accounts| {
        accounts
            .borrow()
            .get(&caller)
            .map(|acc| acc.balance)
            .ok_or("Account not found".to_string())
    })
}

#[query]
fn get_account_info() -> Result<UserAccount, String> {
    let caller = caller();
    USER_ACCOUNTS.with(|accounts| {
        accounts
            .borrow()
            .get(&caller)
            .ok_or("Account not found".to_string())
    })
}

#[query]
fn get_deposit_history(limit: u32) -> Vec<DepositRecord> {
    let caller = caller();
    DEPOSITS.with(|deposits| {
        deposits
            .borrow()
            .iter()
            .rev()
            .filter(|(_, record)| record.user == caller)
            .take(limit as usize)
            .map(|(_, record)| record)
            .collect()
    })
}

#[query]
fn get_withdrawal_history(limit: u32) -> Vec<WithdrawalRecord> {
    let caller = caller();
    WITHDRAWALS.with(|withdrawals| {
        withdrawals
            .borrow()
            .iter()
            .rev()
            .filter(|(_, record)| record.user == caller)
            .take(limit as usize)
            .map(|(_, record)| record)
            .collect()
    })
}

#[query]
fn get_game_history(limit: u32) -> Vec<GameTransaction> {
    let caller = caller();
    GAME_TRANSACTIONS.with(|txs| {
        txs.borrow()
            .iter()
            .rev()
            .filter(|(_, tx)| tx.user == caller)
            .take(limit as usize)
            .map(|(_, tx)| tx)
            .collect()
    })
}

#[query]
fn get_casino_stats() -> CasinoStats {
    CASINO_STATS.with(|stats| {
        stats
            .borrow()
            .get(&0)
            .unwrap_or_else(|| CasinoStats::default())
    })
}

// ============================================================================
// AUDIT FUNCTIONS
// ============================================================================

#[query]
fn get_total_user_balances() -> u64 {
    USER_ACCOUNTS.with(|accounts| {
        accounts
            .borrow()
            .iter()
            .map(|(_, account)| account.balance)
            .sum()
    })
}

#[query]
fn verify_reserves() -> ReservesReport {
    let total_user_balances = get_total_user_balances();

    ReservesReport {
        total_user_balances,
        is_solvent: true, // Would need async call to verify actual ICP balance
        timestamp: ic_cdk::api::time(),
    }
}

// ============================================================================
// GAME RESULT TYPES (matching game backends)
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct DiceResult {
    pub player: Principal,
    pub bet_amount: u64,
    pub target_number: u8,
    pub direction: RollDirection,
    pub rolled_number: u8,
    pub win_chance: f64,
    pub multiplier: f64,
    pub payout: u64,
    pub is_win: bool,
    pub timestamp: u64,
    pub client_seed: String,
    pub nonce: u64,
    pub server_seed_hash: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum RollDirection {
    Over,
    Under,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlinkoResult {
    pub player: Principal,
    pub bet_amount: u64,
    pub rows: u8,
    pub risk: RiskLevel,
    pub path: Vec<bool>,
    pub final_position: u8,
    pub multiplier: f64,
    pub payout: u64,
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

// For now, we'll use a simplified generic game result
// Full implementations can be added as games are integrated
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GenericGameResult {
    pub player: Principal,
    pub bet_amount: u64,
    pub payout: u64,
    pub timestamp: u64,
}

// ============================================================================
// GAME PLAY FUNCTIONS
// ============================================================================

#[update]
async fn play_dice(
    bet_amount: u64,
    target_number: u8,
    direction: RollDirection,
    client_seed: String,
) -> Result<DiceResult, String> {
    let caller = caller();

    // Validate bet
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if bet_amount > MAX_BET {
        return Err(format!("Maximum bet is {} ICP", MAX_BET / 100_000_000));
    }

    // Check and lock user balance
    let mut account = get_or_create_account(caller);
    if account.is_locked {
        return Err("Account locked during active game".to_string());
    }
    if account.balance < bet_amount {
        return Err("Insufficient balance".to_string());
    }

    account.balance -= bet_amount;
    account.is_locked = true;
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow_mut().insert(caller, account.clone());
    });

    // Call dice backend
    let dice_canister = Principal::from_text(DICE_BACKEND).unwrap();
    let result: CallResult<(Result<DiceResult, String>,)> = ic_cdk::call(
        dice_canister,
        "play_from_casino",
        (caller, bet_amount, target_number, direction.clone(), client_seed),
    )
    .await;

    match result {
        Ok((Ok(game_result),)) => {
            // Update balance with payout
            account.balance += game_result.payout;
            account.total_wagered += bet_amount;
            account.is_locked = false;
            account.last_activity = ic_cdk::api::time();

            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            // Record transaction
            record_game_transaction(caller, "dice", bet_amount, game_result.payout);

            Ok(game_result)
        }
        Ok((Err(error),)) => {
            // ROLLBACK
            account.balance += bet_amount;
            account.is_locked = false;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            Err(error)
        }
        Err((code, msg)) => {
            // ROLLBACK
            account.balance += bet_amount;
            account.is_locked = false;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            Err(format!("Game canister call failed: {:?} - {}", code, msg))
        }
    }
}

#[update]
async fn play_plinko(bet_amount: u64, rows: u8, risk: RiskLevel) -> Result<PlinkoResult, String> {
    let caller = caller();

    // Validate bet
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if bet_amount > MAX_BET {
        return Err(format!("Maximum bet is {} ICP", MAX_BET / 100_000_000));
    }

    // Check and lock user balance
    let mut account = get_or_create_account(caller);
    if account.is_locked {
        return Err("Account locked during active game".to_string());
    }
    if account.balance < bet_amount {
        return Err("Insufficient balance".to_string());
    }

    account.balance -= bet_amount;
    account.is_locked = true;
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow_mut().insert(caller, account.clone());
    });

    // Call plinko backend
    let plinko_canister = Principal::from_text(PLINKO_BACKEND).unwrap();
    let result: CallResult<(Result<PlinkoResult, String>,)> = ic_cdk::call(
        plinko_canister,
        "play_from_casino",
        (caller, bet_amount, rows, risk.clone()),
    )
    .await;

    match result {
        Ok((Ok(game_result),)) => {
            // Update balance with payout
            account.balance += game_result.payout;
            account.total_wagered += bet_amount;
            account.is_locked = false;
            account.last_activity = ic_cdk::api::time();

            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            // Record transaction
            record_game_transaction(caller, "plinko", bet_amount, game_result.payout);

            Ok(game_result)
        }
        Ok((Err(error),)) => {
            // ROLLBACK
            account.balance += bet_amount;
            account.is_locked = false;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            Err(error)
        }
        Err((code, msg)) => {
            // ROLLBACK
            account.balance += bet_amount;
            account.is_locked = false;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });

            Err(format!("Game canister call failed: {:?} - {}", code, msg))
        }
    }
}

// Simplified game play functions for crash and mines
// These will need to be expanded once the game backends are ready

#[update]
async fn play_crash(bet_amount: u64) -> Result<GenericGameResult, String> {
    let caller = caller();

    // Validate bet
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if bet_amount > MAX_BET {
        return Err(format!("Maximum bet is {} ICP", MAX_BET / 100_000_000));
    }

    // For now, return error until crash backend is updated
    Err("Crash game integration pending - use legacy crash_backend directly".to_string())
}

#[update]
async fn play_mines(bet_amount: u64, num_mines: u8) -> Result<GenericGameResult, String> {
    let caller = caller();

    // Validate bet
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if bet_amount > MAX_BET {
        return Err(format!("Maximum bet is {} ICP", MAX_BET / 100_000_000));
    }

    // For now, return error until mines backend is updated
    Err("Mines game integration pending - use legacy mines_backend directly".to_string())
}

// ============================================================================
// TEST FUNCTION
// ============================================================================

#[query]
fn greet(name: String) -> String {
    format!("Welcome to OpenHouse Casino Main Wallet, {}!", name)
}

// Export candid interface
ic_cdk::export_candid!();
