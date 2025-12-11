//! Async Execution Model
//!
//! Simulates IC message execution with explicit await points.
//! Key insight: Messages interleave at await, not during sync code.

use std::collections::HashMap;

/// State captured by a message BEFORE its await point
#[derive(Debug, Clone)]
pub struct SuspendedMessage {
    pub id: u64,
    pub caller: u64,
    pub captured_balance: u64, // Balance seen at start
    pub bet_amount: u64,
    pub target_multiplier: f64,
    // State frozen at suspension
}

/// Represents a message that has resumed after await
#[derive(Debug, Clone)]
pub struct ResumedMessage {
    pub suspended: SuspendedMessage,
    pub random_result: f64, // VRF result (determines win/loss)
    // Message continues with stale captured_balance
}

/// The concurrent execution model
pub struct ConcurrentGameModel {
    // Actual canister state
    pub user_balances: HashMap<u64, u64>,
    pub pool_reserve: u64,
    pub total_system_funds: u64,

    // Messages in flight
    pub suspended_messages: Vec<SuspendedMessage>,
    pub completed_games: Vec<GameResult>,

    // Tracking
    pub message_counter: u64,
}

#[derive(Debug, Clone)]
pub struct GameResult {
    pub message_id: u64,
    pub caller: u64,
    pub bet_amount: u64,
    pub payout: u64,
    pub balance_before_deduct: u64, // What the message THOUGHT the balance was
    pub balance_written: u64,       // What the message WROTE
}

impl ConcurrentGameModel {
    pub fn new() -> Self {
        Self {
            user_balances: HashMap::new(),
            pool_reserve: 0,
            total_system_funds: 0,
            suspended_messages: Vec::new(),
            completed_games: Vec::new(),
            message_counter: 0,
        }
    }

    /// Seed the model with initial state
    pub fn setup(&mut self, user: u64, balance: u64, pool: u64) {
        self.user_balances.insert(user, balance);
        self.pool_reserve = pool;
        self.total_system_funds = balance + pool;
    }

    /// Phase 1: Message starts, captures state, suspends at await
    /// Models game.rs lines 181-213 (before raw_rand().await returns)
    pub fn start_game(
        &mut self,
        caller: u64,
        bet_amount: u64,
        target: f64,
    ) -> Result<u64, String> {
        // Capture balance (line 183)
        let captured_balance = *self.user_balances.get(&caller).unwrap_or(&0);

        // Check balance (line 184-186)
        if captured_balance < bet_amount {
            return Err("INSUFFICIENT_BALANCE".to_string());
        }

        // Validate bet (simplified)
        if bet_amount < 10_000 {
            return Err("Below minimum".to_string());
        }

        // Check max payout (simplified)
        let max_payout = (bet_amount as f64 * target) as u64;
        let max_allowed = self.pool_reserve / 10; // 10% limit
        if max_payout > max_allowed {
            return Err("Exceeds house limit".to_string());
        }

        // SUSPEND at raw_rand().await (line 212)
        // Message is now frozen with captured_balance
        let message_id = self.message_counter;
        self.message_counter += 1;

        self.suspended_messages.push(SuspendedMessage {
            id: message_id,
            caller,
            captured_balance,
            bet_amount,
            target_multiplier: target,
        });

        Ok(message_id)
    }

    /// Phase 2: Message resumes from await, uses STALE captured_balance
    /// Models game.rs lines 214-268 (after raw_rand().await returns)
    pub fn resume_game(&mut self, message_id: u64, random_result: f64) -> Result<GameResult, String> {
        // Find and remove the suspended message
        let idx = self
            .suspended_messages
            .iter()
            .position(|m| m.id == message_id)
            .ok_or("Message not found")?;
        let msg = self.suspended_messages.remove(idx);

        // Calculate crash point from random (line 229)
        let crash_point = calculate_crash_point(random_result);

        // Determine outcome (line 232)
        let won = crash_point >= msg.target_multiplier;
        let payout = if won {
            (msg.bet_amount as f64 * msg.target_multiplier) as u64
        } else {
            0
        };

        // CRITICAL BUG LOCATION (lines 220-222):
        // Uses msg.captured_balance (STALE!) instead of re-reading
        let balance_after_bet = msg
            .captured_balance
            .checked_sub(msg.bet_amount)
            .ok_or("Balance underflow")?;

        // This OVERWRITES whatever the current balance is
        self.user_balances.insert(msg.caller, balance_after_bet);

        // Add payout (lines 241-244)
        let current = *self.user_balances.get(&msg.caller).unwrap_or(&0);
        let new_balance = current + payout;
        self.user_balances.insert(msg.caller, new_balance);

        // Settle with pool (line 247)
        if payout > msg.bet_amount {
            let profit = payout - msg.bet_amount;
            self.pool_reserve = self.pool_reserve.saturating_sub(profit);
        } else if payout < msg.bet_amount {
            let loss = msg.bet_amount - payout;
            self.pool_reserve += loss;
        }

        let result = GameResult {
            message_id: msg.id,
            caller: msg.caller,
            bet_amount: msg.bet_amount,
            payout,
            balance_before_deduct: msg.captured_balance,
            balance_written: new_balance,
        };

        self.completed_games.push(result.clone());
        Ok(result)
    }

    /// Check if the model detected a TOCTOU violation
    pub fn check_toctou_violation(&self) -> Option<String> {
        // Group completed games by caller
        let mut by_caller: HashMap<u64, Vec<&GameResult>> = HashMap::new();
        for game in &self.completed_games {
            by_caller.entry(game.caller).or_default().push(game);
        }

        for (caller, games) in by_caller {
            if games.len() <= 1 {
                continue;
            }

            // Check if multiple games used the same captured balance
            let balances_seen: Vec<u64> = games.iter().map(|g| g.balance_before_deduct).collect();

            // If all games saw the same balance, TOCTOU occurred
            if balances_seen.iter().all(|&b| b == balances_seen[0]) {
                let total_bet: u64 = games.iter().map(|g| g.bet_amount).sum();
                let single_balance = balances_seen[0];

                if total_bet > single_balance {
                    return Some(format!(
                        "TOCTOU DETECTED: Caller {} placed {} bets totaling {} \
                         but all saw balance {}",
                        caller,
                        games.len(),
                        total_bet,
                        single_balance
                    ));
                }
            }
        }

        None
    }

    /// Check solvency invariant
    pub fn check_solvency(&self) -> Result<(), String> {
        let user_sum: u64 = self.user_balances.values().sum();
        let calculated = user_sum + self.pool_reserve;

        // With TOCTOU bugs, total_system_funds will NOT match
        // because bets were deducted from stale values
        if calculated != self.total_system_funds {
            return Err(format!(
                "SOLVENCY VIOLATION: users({}) + pool({}) = {} != expected({})",
                user_sum, self.pool_reserve, calculated, self.total_system_funds
            ));
        }

        Ok(())
    }
}

impl Default for ConcurrentGameModel {
    fn default() -> Self {
        Self::new()
    }
}

/// Simplified crash point calculation
fn calculate_crash_point(random: f64) -> f64 {
    // 1% house edge calculation
    let raw = 0.99 / (1.0 - random);
    if raw < 1.0 {
        1.0
    } else {
        raw
    }
}
