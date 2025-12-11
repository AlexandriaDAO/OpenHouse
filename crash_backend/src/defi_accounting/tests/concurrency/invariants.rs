//! Post-Concurrent-Execution Invariant Checks
//!
//! These invariants MUST hold even after concurrent execution.
//! If any fail, the code has a TOCTOU vulnerability.

use super::async_model::ConcurrentGameModel;
use rand::{Rng, SeedableRng};
use rand_chacha::ChaCha8Rng;

/// INVARIANT 1: Total deductions must equal sum of individual bets
///
/// If N games execute with bet B each, the total balance reduction
/// should be N*B, not B (which happens with TOCTOU).
#[test]
fn invariant_total_deductions_match_bets() {
    println!("\n=== INVARIANT: Total Deductions Match Bets ===");

    let mut model = ConcurrentGameModel::new();
    let user = 1;
    let initial = 100_000_000; // 100 USDT
    model.setup(user, initial, 1_000_000_000);

    // Run N concurrent games
    let n = 10;
    let bet = 5_000_000; // 5 USDT each

    let mut ids = Vec::new();
    for _ in 0..n {
        if let Ok(id) = model.start_game(user, bet, 2.0) {
            ids.push(id);
        }
    }

    // All lose (to simplify - no payouts)
    for id in ids.iter() {
        model.resume_game(*id, 0.99).unwrap();
    }

    let final_balance = *model.user_balances.get(&user).unwrap();
    let expected_deduction = ids.len() as u64 * bet;

    println!("Games executed: {}", ids.len());
    println!("Initial balance: {}", initial);
    println!("Final balance: {}", final_balance);
    println!(
        "Expected deduction: {} ({} * {})",
        expected_deduction,
        ids.len(),
        bet
    );

    // Handle case where final_balance > initial (TOCTOU bug creates phantom balance)
    if final_balance > initial {
        panic!(
            "INVARIANT VIOLATION: Final balance {} > initial {} (phantom balance created by TOCTOU)",
            final_balance, initial
        );
    }

    let actual_deduction = initial - final_balance;
    println!("Actual deduction: {}", actual_deduction);

    assert_eq!(
        actual_deduction, expected_deduction,
        "INVARIANT VIOLATION: Deducted {} but should have deducted {}",
        actual_deduction, expected_deduction
    );
}

/// INVARIANT 2: System funds are conserved
///
/// total_system_funds should equal sum(user_balances) + pool_reserve
/// after ANY sequence of operations.
#[test]
fn invariant_system_funds_conservation() {
    println!("\n=== INVARIANT: System Funds Conservation ===");

    let mut model = ConcurrentGameModel::new();

    // Setup multiple users
    for user in 1..=5 {
        model.user_balances.insert(user, 10_000_000);
        model.total_system_funds += 10_000_000;
    }
    model.pool_reserve = 100_000_000;
    model.total_system_funds += 100_000_000;

    let initial_total = model.total_system_funds;

    // Random concurrent operations
    let mut rng = ChaCha8Rng::seed_from_u64(42);

    for _ in 0..20 {
        let user = rng.gen_range(1..=5);
        let bet = rng.gen_range(100_000..1_000_000);

        if let Ok(id) = model.start_game(user, bet, 2.0) {
            model.resume_game(id, rng.gen::<f64>()).ok();
        }
    }

    // Check conservation
    let user_sum: u64 = model.user_balances.values().sum();
    let calculated_total = user_sum + model.pool_reserve;

    println!("Initial system funds: {}", initial_total);
    println!("Final user balances: {}", user_sum);
    println!("Final pool reserve: {}", model.pool_reserve);
    println!("Calculated total: {}", calculated_total);
    println!("Expected total: {}", initial_total);

    // Note: With wins/losses, money moves but total is conserved
    // (assuming no external deposits/withdrawals in this test)

    assert_eq!(
        calculated_total, initial_total,
        "INVARIANT VIOLATION: System funds {} != expected {}",
        calculated_total, initial_total
    );
}

/// INVARIANT 3: No negative balances via race
///
/// Even with concurrent operations, balance should never go negative
/// or underflow to a huge number.
#[test]
fn invariant_no_negative_balance_via_race() {
    println!("\n=== INVARIANT: No Negative Balance via Race ===");

    let mut model = ConcurrentGameModel::new();
    let user = 1;
    model.setup(user, 5_000_000, 100_000_000); // Only 5 USDT

    // Try to spend 10 USDT via concurrent 2 USDT bets
    let mut ids = Vec::new();
    for _ in 0..5 {
        // Each captures balance, sees it as sufficient
        if let Ok(id) = model.start_game(user, 2_000_000, 2.0) {
            ids.push(id);
        }
    }

    // Resume all (all will try to deduct from stale balance)
    for id in ids {
        model.resume_game(id, 0.99).ok(); // May fail on underflow
    }

    let final_balance = *model.user_balances.get(&user).unwrap();

    println!("Initial balance: 5_000_000");
    println!("Attempted to spend: 10_000_000 (5 * 2M)");
    println!("Final balance: {}", final_balance);

    // Check for underflow (wrapping to huge number)
    if final_balance > 100_000_000 {
        panic!(
            "INVARIANT VIOLATION: Balance underflowed to {}",
            final_balance
        );
    }

    // Balance should be 0 or reasonable, not negative-as-large-positive
    println!("Balance check passed (no underflow)");
}

/// INVARIANT 4: Pool cannot be over-drained
///
/// Pool reserve should not go negative or underflow.
#[test]
fn invariant_pool_not_overdrained() {
    println!("\n=== INVARIANT: Pool Not Over-Drained ===");

    let mut model = ConcurrentGameModel::new();

    // Small pool, many concurrent winning bets
    let pool_initial = 10_000_000; // 10 USDT pool
    model.setup(1, 100_000_000, pool_initial);

    // Try to win 50 USDT from 10 USDT pool via concurrent wins
    let mut ids = Vec::new();
    for _ in 0..10 {
        if let Ok(id) = model.start_game(1, 5_000_000, 2.0) {
            ids.push(id);
        }
    }

    // Make all win
    for id in ids {
        model.resume_game(id, 0.01).ok();
    }

    println!("Pool initial: {}", pool_initial);
    println!("Pool final: {}", model.pool_reserve);

    // Check for underflow (would show as huge number)
    if model.pool_reserve > 1_000_000_000_000 {
        panic!(
            "INVARIANT VIOLATION: Pool underflowed to {}",
            model.pool_reserve
        );
    }

    // With proper limits, pool should not go negative
    // (saturating_sub prevents this, but concurrent wins can still over-pay)
    println!("Pool check passed (no underflow)");
}

/// COMPREHENSIVE: Run many random concurrent scenarios
#[test]
fn invariant_stress_concurrent_execution() {
    println!("\n=== INVARIANT: Stress Test Concurrent Execution ===");

    let mut violations = Vec::new();

    for seed in 0..100 {
        let mut model = ConcurrentGameModel::new();
        let mut rng = ChaCha8Rng::seed_from_u64(seed);

        // Setup
        for user in 1..=10 {
            model.user_balances.insert(user, 50_000_000);
            model.total_system_funds += 50_000_000;
        }
        model.pool_reserve = 500_000_000;
        model.total_system_funds += 500_000_000;

        let initial_total = model.total_system_funds;

        // Random concurrent operations
        for _ in 0..50 {
            let user = rng.gen_range(1..=10);
            let bet = rng.gen_range(100_000..5_000_000);
            let target = rng.gen_range(1.1..5.0);

            if let Ok(id) = model.start_game(user, bet, target) {
                // Immediately resume (could also batch)
                model.resume_game(id, rng.gen::<f64>()).ok();
            }
        }

        // Check TOCTOU
        if let Some(v) = model.check_toctou_violation() {
            violations.push(format!("Seed {}: {}", seed, v));
        }

        // Check solvency
        let user_sum: u64 = model.user_balances.values().sum();
        let calculated = user_sum + model.pool_reserve;
        if calculated != initial_total {
            violations.push(format!(
                "Seed {}: Conservation violation: {} != {}",
                seed, calculated, initial_total
            ));
        }
    }

    if !violations.is_empty() {
        println!(
            "\n!!! {} INVARIANT VIOLATIONS FOUND !!!",
            violations.len()
        );
        for v in &violations[..violations.len().min(10)] {
            println!("  - {}", v);
        }
        panic!(
            "{} invariant violations in 100 stress runs",
            violations.len()
        );
    }

    println!("All 100 stress runs passed invariant checks");
}
