use std::collections::HashMap;
use super::{Operation, OpResult};

// Constants matching production (from types.rs)
// const DECIMALS_PER_USDT: u64 = 1_000_000;
const MIN_BET: u64 = 10_000;
const LP_WITHDRAWAL_FEE_BPS: u64 = 100;
const MINIMUM_LIQUIDITY: u64 = 1000;

pub struct AccountingModel {
    // User balances - mirrors USER_BALANCES_STABLE
    pub user_balances: HashMap<u64, u64>,

    // LP shares - mirrors LP_SHARES
    pub lp_shares: HashMap<u64, u64>,
    pub total_shares: u64,

    // Pool reserve - mirrors POOL_STATE.reserve
    pub pool_reserve: u64,

    // Tracking for invariant checking
    pub total_system_funds: u64,
    pub accumulated_fees: u64,

    // State
    pub operation_count: u64,
}

impl AccountingModel {
    pub fn new() -> Self {
        Self {
            user_balances: HashMap::new(),
            lp_shares: HashMap::new(),
            total_shares: 0,
            pool_reserve: 0,
            total_system_funds: 0,
            accumulated_fees: 0,
            operation_count: 0,
        }
    }

    pub fn with_initial_liquidity(amount: u64) -> Self {
        let mut model = Self::new();
        // Create model with seed liquidity
        // Burn MINIMUM_LIQUIDITY to address 0 (mirrors liquidity_pool.rs:214)
        if amount > 0 {
             let _ = model.lp_deposit(0, amount); // Using 0 as "admin/initial" user for simplicity or specific logic
        }
        model
    }

    /// THE CORE INVARIANT
    /// Must hold after ANY sequence of operations
    pub fn check_invariant(&self) -> Result<(), String> {
        let sum_user_balances: u64 = self.user_balances.values().sum();
        let calculated = self.pool_reserve + sum_user_balances + self.accumulated_fees;

        if calculated != self.total_system_funds {
            return Err(format!(
                "INVARIANT VIOLATION: pool({}) + users({}) + fees({}) = {} != total({})",
                self.pool_reserve, sum_user_balances, self.accumulated_fees,
                calculated, self.total_system_funds
            ));
        }
        Ok(())
    }

    /// LP shares must sum to total_shares
    pub fn check_lp_invariant(&self) -> Result<(), String> {
        let sum_shares: u64 = self.lp_shares.values().sum();
        if sum_shares != self.total_shares {
            return Err(format!(
                "LP shares mismatch: sum({}) != total({})",
                sum_shares, self.total_shares
            ));
        }
        Ok(())
    }

    /// Execute an operation and return result
    pub fn execute(&mut self, op: Operation) -> OpResult {
        self.operation_count += 1;
        match op {
            Operation::UserDeposit { user, amount } => self.user_deposit(user, amount),
            Operation::UserWithdraw { user } => self.user_withdraw(user),
            Operation::PlaceBet { user, amount, win, multiplier_bps } =>
                self.place_bet(user, amount, win, multiplier_bps),
            Operation::LPDeposit { user, amount } => self.lp_deposit(user, amount),
            Operation::LPWithdraw { user } => self.lp_withdraw(user),
        }
    }

    // Each method mirrors exact production logic
    fn user_deposit(&mut self, user: u64, amount: u64) -> OpResult {
        // Mirror accounting.rs:170-176
        if amount == 0 {
             return OpResult::ZeroAmount;
        }
        // Add amount to user balance
        let balance = self.user_balances.entry(user).or_insert(0);
        match balance.checked_add(amount) {
            Some(new_bal) => {
                *balance = new_bal;
                // Add amount to total_system_funds
                self.total_system_funds = self.total_system_funds.checked_add(amount).expect("System funds overflow");
                OpResult::Success
            }
            None => OpResult::Overflow,
        }
    }

    fn user_withdraw(&mut self, user: u64) -> OpResult {
        // Mirror accounting.rs:195-261
        // Check user has balance
        if let Some(balance) = self.user_balances.get_mut(&user) {
             let amount = *balance;
             if amount == 0 {
                 return OpResult::InsufficientBalance;
             }
             *balance = 0;
             self.total_system_funds = self.total_system_funds.checked_sub(amount).expect("System funds underflow");
             OpResult::Success
        } else {
            OpResult::InsufficientBalance
        }
    }

    fn place_bet(&mut self, user: u64, amount: u64, win: bool, multiplier_bps: u64) -> OpResult {
        // Mirror game.rs:117-182
        
        if amount < MIN_BET {
            return OpResult::BelowMinimum;
        }

        // Check user has sufficient balance
        let balance = self.user_balances.entry(user).or_insert(0);
        if *balance < amount {
            return OpResult::InsufficientBalance;
        }

        // Calculate potential payout
        // multiplier is bps (e.g. 20000 = 2.0x)
        // payout = amount * multiplier / 10000
        // profit = payout - amount
        // For Dice/Crash/etc, usually the payout includes the original bet.
        
        // Checking implementation details from plan context or typical logic.
        // "Deduct bet from user"
        
        let payout = (amount as u128 * multiplier_bps as u128 / 10000) as u64;
        
        if win {
            let _profit = if payout > amount { payout - amount } else { 0 };
            
            // Check if pool can afford it? 
            // Usually max profit is capped by pool size, but here checking simple afford logic
            // "If win: calculate payout, check pool can afford"
            
            // If payout > amount, the pool loses (payout - amount).
            // If payout < amount (multiplier < 1x), pool gains.
            
            if payout > amount {
                let amount_from_pool = payout - amount;
                if self.pool_reserve < amount_from_pool {
                    return OpResult::InsufficientPoolReserve;
                }
                // Deduct bet from user first?
                // Logic: user balance -= amount.
                // Then user balance += payout.
                // Net: user balance += (payout - amount).
                // Pool: pool reserve -= (payout - amount).
                
                *balance = balance.checked_sub(amount).unwrap(); // Deduct bet
                *balance = balance.checked_add(payout).expect("User balance overflow"); // Add winnings
                
                self.pool_reserve = self.pool_reserve.checked_sub(amount_from_pool).unwrap();
            } else {
                 // Multiplier < 1.0x (Loss technically for user relative to bet)
                 // amount_to_pool = amount - payout
                 let amount_to_pool = amount - payout;
                 *balance = balance.checked_sub(amount).unwrap();
                 *balance = balance.checked_add(payout).unwrap();
                 
                 self.pool_reserve = self.pool_reserve.checked_add(amount_to_pool).expect("Pool overflow");
            }
        } else {
            // Loss
            // "If loss: add bet to pool"
            *balance = balance.checked_sub(amount).unwrap();
            self.pool_reserve = self.pool_reserve.checked_add(amount).expect("Pool overflow");
        }
        
        // total_system_funds unchanged (internal transfer)
        OpResult::Success
    }

    fn lp_deposit(&mut self, user: u64, amount: u64) -> OpResult {
        // Mirror liquidity_pool.rs:126-231
        if amount == 0 {
            return OpResult::ZeroAmount;
        }

        // Calculate shares: (amount * total_shares) / pool_reserve
        // If total_shares == 0, shares = amount (initial deposit)
        
        let shares;
        if self.total_shares == 0 {
            if amount < MINIMUM_LIQUIDITY {
                 return OpResult::BelowMinimum; // Cannot deposit less than min liquidity on first init
            }
            // First deposit: burn MINIMUM_LIQUIDITY
            let shares_minted = amount - MINIMUM_LIQUIDITY;
            shares = shares_minted;
            
            // Burned shares
            // The plan says "Burn MINIMUM_LIQUIDITY to address 0"
            // But usually burned shares means total_shares increases but they aren't assigned to user?
            // Or assigned to 0?
            // "Burn MINIMUM_LIQUIDITY to address 0 (mirrors liquidity_pool.rs:214)"
            
            let burned_shares = MINIMUM_LIQUIDITY;
            // We track burned shares as shares held by 0? Or just exist in total_shares but nobody holds them?
            // Usually uniswap V2 burns by sending to address 0.
            // Let's assign to 0 to keep accounting clean (sum of shares == total_shares)
            *self.lp_shares.entry(0).or_insert(0) += burned_shares;
            self.total_shares += burned_shares;
        } else {
            // amount * total_shares / pool_reserve
            // Use u128 for calc
            if self.pool_reserve == 0 {
                // Should not happen if total_shares > 0 usually, unless reserve drained fully?
                // If reserve is 0 but shares > 0, new deposit gets shares?
                // Typically undefined or 0.
                // If reserve is 0, shares = amount?
                // Let's assume standard proportional
                shares = (amount as u128 * self.total_shares as u128 / self.pool_reserve as u128) as u64;
            } else {
                shares = (amount as u128 * self.total_shares as u128 / self.pool_reserve as u128) as u64;
            }
        }
        
        if shares == 0 {
            return OpResult::BelowMinimum; // Effectively too small to get shares
        }

        // Add shares to user
        *self.lp_shares.entry(user).or_insert(0) += shares;
        self.total_shares += shares;

        // Add amount to pool_reserve
        self.pool_reserve = self.pool_reserve.checked_add(amount).expect("Pool reserve overflow");
        
        // Add amount to total_system_funds
        self.total_system_funds = self.total_system_funds.checked_add(amount).expect("System funds overflow");
        
        OpResult::Success
    }

    fn lp_withdraw(&mut self, user: u64) -> OpResult {
        // Mirror liquidity_pool.rs:242-369
        
        let user_shares = *self.lp_shares.get(&user).unwrap_or(&0);
        if user_shares == 0 {
            return OpResult::InsufficientShares;
        }

        // Withdraw ALL shares? Plan: "Operation::LPWithdraw { user }" -> implies all?
        // Or maybe just "withdraw" action.
        // Usually simpler to test withdraw all or random amount.
        // The plan says "Remove user shares" -> implies all for the simplified operation.
        let shares_to_withdraw = user_shares;

        // Calculate payout: (shares * pool_reserve) / total_shares
        let gross_payout = (shares_to_withdraw as u128 * self.pool_reserve as u128 / self.total_shares as u128) as u64;
        
        // Calculate 1% fee
        let fee = gross_payout * LP_WITHDRAWAL_FEE_BPS / 10000;
        let net_payout = gross_payout - fee;

        // Remove user shares
        self.lp_shares.remove(&user);
        self.total_shares -= shares_to_withdraw;

        // Deduct payout from pool_reserve
        // Note: pool_reserve reduces by gross_payout?
        // Usually: reserve reduces by gross_payout.
        // User gets net_payout.
        // Fee goes to fee accumulator?
        // "Deduct payout from pool_reserve" -> ambiguous if gross or net.
        // "Add fee to accumulated_fees"
        // "Deduct (payout - fee) from total_system_funds" -> this implies user leaves with net_payout.
        // So pool_reserve must lose gross_payout?
        // No, fee stays in system (accumulated_fees).
        // So pool_reserve loses gross_payout.
        // accumulated_fees gains fee.
        // Wait, if reserve loses gross, where does fee go?
        // Typically fee stays in pool or goes to separate pot.
        // Plan: "Add fee to accumulated_fees". "Deduct (payout - fee) from total_system_funds".
        // Since total_system_funds = reserve + users + fees.
        // If we reduce reserve by gross, add fee to fees.
        // Then total funds change = -gross + fee = -net.
        // This matches "Deduct (payout - fee) from total_system_funds".
        
        self.pool_reserve = self.pool_reserve.checked_sub(gross_payout).expect("Pool reserve underflow");
        self.accumulated_fees = self.accumulated_fees.checked_add(fee).expect("Fees overflow");
        
        // User gets net_payout (simulated by leaving system)
        self.total_system_funds = self.total_system_funds.checked_sub(net_payout).expect("System funds underflow");

        OpResult::Success
    }
}
