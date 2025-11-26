use super::*;
use crate::defi_accounting::tests::stress_tests::generators::operation_sequence;
use proptest::prelude::*;
use rand::{SeedableRng, Rng};
use rand_chacha::ChaCha8Rng;

// ============================================
// CATEGORY 1: ACCOUNTING DRIFT DETECTION
// ============================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    #[test]
    fn test_invariant_holds_after_100_ops(ops in operation_sequence(100)) {
        let mut model = AccountingModel::with_initial_liquidity(100_000_000);

        for (i, op) in ops.into_iter().enumerate() {
            let _ = model.execute(op);

            // Check invariant after EVERY operation
            model.check_invariant()
                .map_err(|e| TestCaseError::fail(format!("Op {}: {}", i, e)))?;
        }
    }

    #[test]
    fn test_invariant_holds_after_1000_ops(ops in operation_sequence(1000)) {
        let mut model = AccountingModel::with_initial_liquidity(1_000_000_000);

        for op in ops {
            let _ = model.execute(op);
        }

        // Check at end
        model.check_invariant().map_err(TestCaseError::fail)?;
        model.check_lp_invariant().map_err(TestCaseError::fail)?;
    }
}

// Deterministic regression test (reproducible with seed)
#[test]
fn test_deterministic_10k_operations() {
    let mut rng = ChaCha8Rng::seed_from_u64(12345);  // Fixed seed
    let mut model = AccountingModel::with_initial_liquidity(100_000_000_000);

    for i in 0..10000 {
        let op = generate_random_op(&mut rng);
        let _ = model.execute(op);

        // Check every 100 ops
        if i % 100 == 0 {
            model.check_invariant().expect(&format!("Failed at op {}", i));
        }
    }

    model.check_invariant().expect("Final invariant check failed");
    model.check_lp_invariant().expect("Final LP invariant check failed");
}

// ============================================
// CATEGORY 2: EDGE CASE STRESS
// ============================================

#[test]
fn test_max_u64_overflow_protection() {
    let mut model = AccountingModel::new();

    // Deposit near max u64
    let huge = u64::MAX - 1000;
    let result = model.execute(Operation::UserDeposit { user: 1, amount: huge });
    assert_eq!(result, OpResult::Success);

    // Another huge deposit should fail with overflow
    let result = model.execute(Operation::UserDeposit { user: 1, amount: huge });
    assert_eq!(result, OpResult::Overflow);

    model.check_invariant().unwrap();
}

#[test]
fn test_minimum_bet_edge_cases() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    // Deposit exactly MIN_BET (10_000)
    model.execute(Operation::UserDeposit { user: 1, amount: 10_000 });

    // Bet exactly MIN_BET and lose
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000, win: false, multiplier_bps: 20000,
    });
    assert_eq!(result, OpResult::Success);

    // Now balance is 0, bet should fail
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000, win: false, multiplier_bps: 20000,
    });
    assert_eq!(result, OpResult::InsufficientBalance);

    model.check_invariant().unwrap();
}

#[test]
fn test_5000_small_operations_precision() {
    let mut model = AccountingModel::with_initial_liquidity(1_000_000_000_000);

    // 5000 minimum-sized operations
    for i in 0..5000 {
        let user = (i % 100 + 1) as u64;
        model.execute(Operation::UserDeposit { user, amount: 10_000 });
        model.execute(Operation::PlaceBet {
            user, amount: 10_000, win: false, multiplier_bps: 20000,
        });
    }

    // Should have zero accumulated error
    model.check_invariant().unwrap();
}

#[test]
fn test_single_decimal_precision() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    // Many operations at single decimal precision (0.01 USDT = 10000 decimals)
    // Wait, 10000 is 0.01 USDT (10^-2). 
    // Test implies repeated small ops.
    for i in 0..1000 {
        let user = (i % 10 + 1) as u64;
        model.execute(Operation::UserDeposit { user, amount: 10_000 });
        model.execute(Operation::PlaceBet {
            user, amount: 10_000, win: i % 3 == 0, multiplier_bps: 20000,
        });
    }

    model.check_invariant().unwrap();
}

// ============================================
// CATEGORY 3: STATE MACHINE VALIDITY
// ============================================

#[test]
fn test_cannot_withdraw_more_than_balance() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    model.execute(Operation::UserDeposit { user: 1, amount: 10_000_000 });

    // Lose everything
    model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000_000, win: false, multiplier_bps: 20000,
    });

    // Try to withdraw - should fail
    let result = model.execute(Operation::UserWithdraw { user: 1 });
    assert_eq!(result, OpResult::InsufficientBalance);
}

#[test]
fn test_cannot_bet_more_than_balance() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    model.execute(Operation::UserDeposit { user: 1, amount: 1_000_000 });

    // Try to bet more than balance
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000_000, win: false, multiplier_bps: 20000,
    });
    assert_eq!(result, OpResult::InsufficientBalance);

    model.check_invariant().unwrap();
}

#[test]
fn test_pool_cannot_go_negative() {
    let mut model = AccountingModel::with_initial_liquidity(10_000_000);  // Small pool

    // User has large balance
    model.execute(Operation::UserDeposit { user: 1, amount: 1_000_000_000 });

    // Try 100x win on 10 USDT bet - would need 990 USDT from pool (only has 10)
    // 10 USDT = 10_000_000. 100x = 1_000_000_000 payout.
    // Profit = 990_000_000.
    // Pool has 10_000_000.
    // 990 > 10.
    
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000_000, win: true, multiplier_bps: 1_000_000,
    });
    assert_eq!(result, OpResult::InsufficientPoolReserve);

    model.check_invariant().unwrap();
}

#[test]
fn test_lp_share_consistency_after_many_ops() {
    let mut model = AccountingModel::new();

    // Multiple LPs deposit
    for user in 1..=10 {
        model.execute(Operation::LPDeposit {
            user,
            amount: user * 1_000_000
        });
    }

    // Run some game activity
    for _ in 0..100 {
        model.execute(Operation::UserDeposit { user: 50, amount: 1_000_000 });
        model.execute(Operation::PlaceBet {
            user: 50, amount: 100_000, win: false, multiplier_bps: 20000,
        });
    }

    // LP shares should still be consistent
    model.check_lp_invariant().unwrap();

    // Some LPs withdraw
    for user in [2, 4, 6, 8] {
        model.execute(Operation::LPWithdraw { user });
    }

    // Still consistent
    model.check_lp_invariant().unwrap();
    model.check_invariant().unwrap();
}

#[test]
fn test_withdrawal_fee_properly_tracked() {
    let mut model = AccountingModel::new();

    // LP deposits
    model.execute(Operation::LPDeposit { user: 1, amount: 100_000_000 });
    
    model.check_invariant().unwrap();

    // LP withdraws
    model.execute(Operation::LPWithdraw { user: 1 });

    // Fee should be in accumulated_fees (1% of ~99 USDT after burn)
    assert!(model.accumulated_fees > 0, "Fee should be accumulated");

    // Invariant must still hold
    model.check_invariant().unwrap();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

fn generate_random_op(rng: &mut ChaCha8Rng) -> Operation {
    let op_type = rng.gen_range(0..5);
    let user = rng.gen_range(1..=100);
    let amount = rng.gen_range(10_000..10_000_000u64);

    match op_type {
        0 => Operation::UserDeposit { user, amount },
        1 => Operation::UserWithdraw { user },
        2 => Operation::PlaceBet {
            user,
            amount: amount.min(1_000_000),
            win: rng.gen_bool(0.25),
            multiplier_bps: [20000, 40000, 100000][rng.gen_range(0..3)],
        },
        3 => Operation::LPDeposit { user, amount },
        4 => Operation::LPWithdraw { user },
        _ => unreachable!(),
    }
}
