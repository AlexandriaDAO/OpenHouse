//! TOCTOU Attack Test Scenarios
//!
//! Each test simulates a specific attack that exploits the race condition.

use super::async_model::ConcurrentGameModel;

/// TEST 1: Multiple concurrent bets with single balance
/// This is the exact scenario from PROJECT_WIDE_SECURITY_AUDIT.md
#[test]
fn test_concurrent_bets_same_balance() {
    println!("\n=== TEST: Concurrent Bets Same Balance ===");
    println!("Attack: Send 5 bets with 1 USDT balance");

    let mut model = ConcurrentGameModel::new();

    // Setup: User has 1 USDT, pool has 100 USDT
    let user = 1;
    let initial_balance = 1_000_000; // 1 USDT
    let pool = 100_000_000; // 100 USDT
    model.setup(user, initial_balance, pool);

    println!("Initial: balance={}, pool={}", initial_balance, pool);

    // Attack: Start 5 concurrent bets (all capture same balance)
    let bet_amount = 1_000_000; // 1 USDT each
    let target = 2.0; // 2x multiplier

    let mut message_ids = Vec::new();
    for i in 0..5 {
        match model.start_game(user, bet_amount, target) {
            Ok(id) => {
                println!(
                    "Message {} started, captured balance: {}",
                    id,
                    model.suspended_messages.last().unwrap().captured_balance
                );
                message_ids.push(id);
            }
            Err(e) => {
                println!("Message {} rejected: {}", i, e);
            }
        }
    }

    // EXPECTED (secure): Only 1 message should start
    // ACTUAL (vulnerable): All 5 start because they all see balance=1_000_000

    println!("\nMessages in flight: {}", message_ids.len());

    // Resume all messages (simulate raw_rand returning)
    // Give them random results that make some win, some lose
    let randoms = [0.5, 0.3, 0.7, 0.2, 0.6]; // Mix of wins and losses

    for (id, &random) in message_ids.iter().zip(randoms.iter()) {
        match model.resume_game(*id, random) {
            Ok(result) => {
                println!(
                    "Message {} completed: bet={}, payout={}",
                    result.message_id, result.bet_amount, result.payout
                );
            }
            Err(e) => {
                println!("Message {} failed on resume: {}", id, e);
            }
        }
    }

    // Check for TOCTOU violation
    if let Some(violation) = model.check_toctou_violation() {
        println!("\n!!! VULNERABILITY DETECTED !!!");
        println!("{}", violation);

        // This test SHOULD FAIL in vulnerable code
        // When fixed, this assertion should be removed
        panic!("TOCTOU vulnerability confirmed: {}", violation);
    }

    // Check solvency
    match model.check_solvency() {
        Ok(()) => println!("\nSolvency check passed"),
        Err(e) => {
            println!("\n!!! SOLVENCY VIOLATION !!!");
            println!("{}", e);
            panic!("Solvency violated: {}", e);
        }
    }

    let final_balance = model.user_balances.get(&user).unwrap_or(&0);
    println!(
        "\nFinal state: balance={}, pool={}",
        final_balance, model.pool_reserve
    );
}

/// TEST 2: Stale balance overwrites
/// Shows how the last message to resume "wins" by overwriting
#[test]
fn test_stale_balance_overwrites() {
    println!("\n=== TEST: Stale Balance Overwrites ===");
    println!("Attack: Demonstrate last-write-wins corruption");

    let mut model = ConcurrentGameModel::new();

    let user = 1;
    model.setup(user, 10_000_000, 100_000_000); // 10 USDT balance

    // Start two concurrent bets
    let id1 = model.start_game(user, 3_000_000, 2.0).unwrap(); // 3 USDT
    let id2 = model.start_game(user, 5_000_000, 2.0).unwrap(); // 5 USDT

    // Both captured balance = 10_000_000

    // Resume in different order to show overwrite
    // Message 2 resumes first: writes 10_000_000 - 5_000_000 = 5_000_000
    model.resume_game(id2, 0.3).unwrap(); // Loses

    let balance_after_msg2 = *model.user_balances.get(&user).unwrap();
    println!("After msg2: balance = {}", balance_after_msg2);
    // Balance is now 5_000_000

    // Message 1 resumes: writes 10_000_000 - 3_000_000 = 7_000_000
    // This OVERWRITES the 5_000_000 from msg2!
    model.resume_game(id1, 0.3).unwrap(); // Loses

    let balance_after_msg1 = *model.user_balances.get(&user).unwrap();
    println!("After msg1: balance = {}", balance_after_msg1);

    // EXPECTED (secure): balance = 10 - 3 - 5 = 2 USDT
    // ACTUAL (vulnerable): balance = 7 USDT (msg2's deduction lost!)

    let expected = 10_000_000 - 3_000_000 - 5_000_000; // 2_000_000

    if balance_after_msg1 != expected {
        println!("\n!!! OVERWRITE BUG DETECTED !!!");
        println!("Expected final balance: {}", expected);
        println!("Actual final balance: {}", balance_after_msg1);
        println!("Missing deduction: {}", balance_after_msg1 - expected);

        panic!(
            "Stale balance overwrite: lost {} in deductions",
            balance_after_msg1 - expected
        );
    }
}

/// TEST 3: Pool drain via concurrent winning bets
/// Shows how attackers can extract more than deposited
#[test]
fn test_pool_drain_via_concurrent_wins() {
    println!("\n=== TEST: Pool Drain via Concurrent Wins ===");
    println!("Attack: Extract more than deposited through concurrent wins");

    let mut model = ConcurrentGameModel::new();

    let attacker = 1;
    let initial_deposit = 1_000_000; // 1 USDT
    let pool = 50_000_000; // 50 USDT pool
    model.setup(attacker, initial_deposit, pool);

    // Start 10 concurrent games, all with 1 USDT bet at 2x
    let mut ids = Vec::new();
    for _ in 0..10 {
        if let Ok(id) = model.start_game(attacker, initial_deposit, 2.0) {
            ids.push(id);
        }
    }

    println!(
        "Started {} concurrent games with {} deposit",
        ids.len(),
        initial_deposit
    );

    // Make all of them win (favorable random values)
    for id in ids {
        model.resume_game(id, 0.01).unwrap(); // Low random = high crash point = win
    }

    let final_balance = *model.user_balances.get(&attacker).unwrap();
    let total_payout: u64 = model.completed_games.iter().map(|g| g.payout).sum();

    println!("\nResults:");
    println!("  Initial deposit: {}", initial_deposit);
    println!("  Total payouts: {}", total_payout);
    println!("  Final balance: {}", final_balance);
    println!("  Pool remaining: {}", model.pool_reserve);

    // EXPECTED (secure): Only 1 game should execute (deposit = 1, bet = 1)
    // ACTUAL (vulnerable): All 10 execute, each paying 2 USDT

    if total_payout > initial_deposit * 2 {
        // Attacker got more than 1 bet could win
        println!("\n!!! POOL DRAIN ATTACK SUCCESSFUL !!!");
        println!(
            "Attacker extracted {} from {} deposit",
            total_payout, initial_deposit
        );

        panic!(
            "Pool drain: {} payout from {} deposit",
            total_payout, initial_deposit
        );
    }
}

/// TEST 4: Accounting inflation (losses that don't reduce balance)
#[test]
fn test_accounting_inflation() {
    println!("\n=== TEST: Accounting Inflation ===");
    println!("Attack: Multiple losses only deduct once");

    let mut model = ConcurrentGameModel::new();

    let user = 1;
    model.setup(user, 5_000_000, 100_000_000); // 5 USDT

    // Start 5 games at 1 USDT each (total 5 USDT = full balance)
    let mut ids = Vec::new();
    for _ in 0..5 {
        if let Ok(id) = model.start_game(user, 1_000_000, 2.0) {
            ids.push(id);
        }
    }

    // Make all lose
    for id in ids {
        model.resume_game(id, 0.99).unwrap(); // High random = low crash point = loss
    }

    let final_balance = *model.user_balances.get(&user).unwrap();

    // EXPECTED (secure): balance = 5 - 5 = 0 (or only 1 game executes)
    // ACTUAL (vulnerable): balance = 4 USDT (only last deduction counts)

    println!("\nFinal balance: {} (expected 0)", final_balance);

    if final_balance > 0 {
        println!("\n!!! ACCOUNTING INFLATION !!!");
        println!("User should have 0 but has {}", final_balance);
        println!("This is 'free money' created by the bug");

        // Check pool - it received contributions from losing bets
        let pool_change = if model.pool_reserve > 100_000_000 {
            model.pool_reserve - 100_000_000
        } else {
            0
        };
        println!(
            "Pool received {} from 5 'losing' bets",
            pool_change
        );

        panic!("Accounting inflation: {} phantom balance", final_balance);
    }
}

/// TEST 5: Mixed operations interleaving
#[test]
fn test_mixed_concurrent_operations() {
    println!("\n=== TEST: Mixed Concurrent Operations ===");
    println!("Attack: Interleave games, deposits, withdrawals");

    let mut model = ConcurrentGameModel::new();

    let user = 1;
    // Larger pool to allow bigger bets (10% limit check)
    model.setup(user, 10_000_000, 500_000_000);

    // Start game 1
    let game1 = model.start_game(user, 5_000_000, 2.0).unwrap();
    println!(
        "Game 1 started, sees balance: {}",
        model.suspended_messages[0].captured_balance
    );

    // User deposits more (between start and resume of game1)
    // In production this would be a separate message that completes
    // while game1 is suspended
    let deposit = 20_000_000;
    *model.user_balances.get_mut(&user).unwrap() += deposit;
    model.total_system_funds += deposit;
    println!("Deposit of {} completed", deposit);
    println!("Balance now: {}", model.user_balances.get(&user).unwrap());

    // Start game 2 (sees new balance)
    let game2 = model.start_game(user, 15_000_000, 2.0).unwrap();
    println!(
        "Game 2 started, sees balance: {}",
        model.suspended_messages[0].captured_balance
    );

    // Resume game 1 (uses STALE balance of 10_000_000)
    model.resume_game(game1, 0.5).unwrap();
    println!(
        "Game 1 resumed with stale balance 10M, wrote: {}",
        model.user_balances.get(&user).unwrap()
    );

    // Resume game 2
    model.resume_game(game2, 0.5).unwrap();
    println!(
        "Game 2 resumed, final balance: {}",
        model.user_balances.get(&user).unwrap()
    );

    // Check solvency - the deposit got "lost" due to overwrite
    match model.check_solvency() {
        Ok(()) => println!("Solvency OK (unexpected with bug)"),
        Err(e) => {
            println!("\n!!! DEPOSIT LOST !!!");
            println!("{}", e);
            panic!("Mixed operation bug: {}", e);
        }
    }
}
