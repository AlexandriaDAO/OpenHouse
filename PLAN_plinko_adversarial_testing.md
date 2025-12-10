# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-adversarial"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-adversarial`
2. **Implement adversarial tests** - Follow attack vectors below
3. **Run tests** - `cd plinko_backend && cargo test adversarial -- --nocapture`
4. **Document findings** - Any bugs found go in test output and PR description
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(plinko): add adversarial security tests"
   git push -u origin feature/plinko-adversarial-testing
   gh pr create --title "Security: Adversarial Testing for Plinko Backend" --body "$(cat <<'EOF'
   ## Summary
   Adversarial tests that attempt to BREAK the plinko_backend accounting.

   ## Attack Vectors Tested
   - Integer overflow/underflow in Nat/u64 arithmetic
   - Division by zero in share calculations
   - LP share manipulation attacks
   - Balance extraction beyond deposits
   - Concurrent operation edge cases
   - Boundary condition exploits

   ## Findings
   [Test output will show any bugs found]

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?")
- ❌ NO confirming code works - ONLY try to break it
- ✅ Tests should FAIL if the code has bugs
- ✅ Tests should PASS only if attack was thwarted
- ✅ Every test attempts an EXPLOIT, not a happy path

**Branch:** `feature/plinko-adversarial-testing`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-adversarial`

---

# Implementation Plan: Adversarial Security Tests

## Objective

Write tests that **attempt to break** the plinko_backend, not confirm it works. Each test should try a specific attack. If the attack succeeds, the test FAILS (bug found). If the attack is thwarted, the test PASSES.

## File: `plinko_backend/src/defi_accounting/tests/adversarial/mod.rs`

```rust
// PSEUDOCODE
pub mod integer_attacks;
pub mod lp_manipulation;
pub mod balance_extraction;
pub mod boundary_exploits;
```

---

## Attack Vector 1: Integer Overflow/Underflow

**File:** `plinko_backend/src/defi_accounting/tests/adversarial/integer_attacks.rs`

### Attack 1.1: Overflow in share calculation
```rust
// PSEUDOCODE
// Attack: Deposit amount that causes (amount * total_shares) to overflow
// Target: liquidity_pool.rs line 143: amount_nat.clone() * total_shares

#[test]
fn attack_share_calculation_overflow() {
    // Setup: Create pool with maximum total_shares possible
    // Attack: Deposit u64::MAX
    // Expected: Should reject or handle gracefully, NOT overflow

    // If shares calculation wraps around, attacker gets fewer shares
    // than expected but pool state is corrupted
}
```

### Attack 1.2: Underflow in payout calculation
```rust
// PSEUDOCODE
// Attack: Try to make (payout - bet) underflow in settle_bet
// Target: liquidity_pool.rs line 601

#[test]
fn attack_settle_bet_underflow() {
    // Setup: Game where payout calculation could underflow
    // Attack: Craft bet_amount > payout_amount with weird values
    // Expected: Should use checked_sub, never panic
}
```

### Attack 1.3: Fee calculation overflow
```rust
// PSEUDOCODE
// Attack: Make (payout_u64 * LP_WITHDRAWAL_FEE_BPS) overflow
// Target: liquidity_pool.rs line 334

#[test]
fn attack_fee_calculation_overflow() {
    // Setup: LP with huge position
    // Attack: Withdraw with payout_u64 near u64::MAX
    // Expected: Should handle overflow, not wrap to small fee

    // If fee wraps to 0, attacker pays no withdrawal fee
}
```

---

## Attack Vector 2: Division by Zero

**File:** `plinko_backend/src/defi_accounting/tests/adversarial/division_attacks.rs`

### Attack 2.1: Share calculation with zero reserve
```rust
// PSEUDOCODE
// Attack: Deposit when pool_reserve is 0 but total_shares > 0
// Target: liquidity_pool.rs line 147: numerator / current_reserve

#[test]
fn attack_deposit_zero_reserve() {
    // Setup: Pool where reserve was drained but shares exist
    // This requires: LP deposits, games drain reserve to 0, LP didn't withdraw
    // Attack: New LP deposits
    // Expected: Should reject or handle, NOT divide by zero
}
```

### Attack 2.2: Payout calculation with zero shares
```rust
// PSEUDOCODE
// Attack: Withdraw when total_shares is 0
// Target: liquidity_pool.rs line 317: numerator / total_shares

#[test]
fn attack_withdraw_zero_shares() {
    // Setup: Somehow get into state where total_shares = 0
    // Attack: Try to withdraw
    // Expected: Should reject, NOT divide by zero
}
```

---

## Attack Vector 3: LP Share Manipulation

**File:** `plinko_backend/src/defi_accounting/tests/adversarial/lp_manipulation.rs`

### Attack 3.1: First depositor inflation attack
```rust
// PSEUDOCODE
// Classic Uniswap V2 attack: inflate share price to steal from next depositor
// Defense should be: MINIMUM_LIQUIDITY burn

#[test]
fn attack_first_depositor_inflation() {
    // Step 1: Attacker deposits minimum (1 wei equivalent)
    // Step 2: Attacker manipulates reserve (if possible)
    // Step 3: Victim deposits large amount
    // Step 4: Check if victim got fair shares

    // If MINIMUM_LIQUIDITY isn't properly implemented, victim loses funds
}
```

### Attack 3.2: Sandwich attack on LP deposit
```rust
// PSEUDOCODE
// Attack: Front-run victim's deposit to steal value

#[test]
fn attack_sandwich_lp_deposit() {
    // Setup: Pool with liquidity
    // Attack sequence:
    //   1. Attacker sees victim's pending deposit
    //   2. Attacker deposits first (changes share price)
    //   3. Victim's deposit executes (gets fewer shares)
    //   4. Attacker withdraws (profits)

    // Check: Did attacker extract value from victim?
}
```

### Attack 3.3: Share price manipulation via games
```rust
// PSEUDOCODE
// Attack: Manipulate games to change share price unfavorably

#[test]
fn attack_game_share_manipulation() {
    // Setup: LP1 deposits
    // Attack: Attacker plays games that drain pool just before LP2 deposits
    // Result: LP2 gets more shares per dollar (buying at discount)
    // Later: If pool recovers, LP2 profits at LP1's expense
}
```

---

## Attack Vector 4: Balance Extraction

**File:** `plinko_backend/src/defi_accounting/tests/adversarial/balance_extraction.rs`

### Attack 4.1: Withdraw more than deposited
```rust
// PSEUDOCODE
// Attack: Extract more funds than were deposited

#[test]
fn attack_extract_more_than_deposited() {
    // Setup: Deposit 100
    // Attack: Try various sequences to withdraw > 100
    //   - Multiple withdrawals
    //   - Withdrawal + game + withdrawal
    //   - LP deposit + withdrawal

    // Check: total_withdrawn <= total_deposited (per user)
}
```

### Attack 4.2: Double withdrawal via race condition
```rust
// PSEUDOCODE
// Attack: Exploit async boundary to withdraw twice

#[test]
fn attack_double_withdrawal_race() {
    // Setup: User has 100 balance
    // Attack:
    //   1. Initiate withdrawal (balance -> 0, pending created)
    //   2. Before transfer completes, try to initiate again
    // Expected: Second withdrawal should fail

    // If race exists, user could withdraw 200 from 100 balance
}
```

### Attack 4.3: Abandon then retry attack
```rust
// PSEUDOCODE
// Attack: Exploit abandon + retry to double-spend

#[test]
fn attack_abandon_retry_double_spend() {
    // Setup: Initiate withdrawal, timeout
    // Attack:
    //   1. Call abandon_withdrawal()
    //   2. Somehow try to also call retry_withdrawal()
    // Expected: Only one should succeed

    // If both work, funds are extracted twice
}
```

---

## Attack Vector 5: Boundary Exploits

**File:** `plinko_backend/src/defi_accounting/tests/adversarial/boundary_exploits.rs`

### Attack 5.1: Minimum bet bypass
```rust
// PSEUDOCODE
// Attack: Play game with bet below minimum

#[test]
fn attack_min_bet_bypass() {
    // Attack: Call play_plinko with bet_amount = 0 or 1
    // Expected: Should reject

    // If accepted, could spam zero-cost games
}
```

### Attack 5.2: Maximum payout bypass
```rust
// PSEUDOCODE
// Attack: Win more than max_allowed_payout

#[test]
fn attack_max_payout_bypass() {
    // Setup: Pool with 1000 USDT (max payout = 150 USDT)
    // Attack: Bet amount that could win > 150 USDT
    // Expected: Bet should be rejected upfront

    // If not checked, could drain pool in one lucky bet
}
```

### Attack 5.3: Dust attack on shares
```rust
// PSEUDOCODE
// Attack: Deposit tiny amount to get 0 shares but tokens stay in pool

#[test]
fn attack_dust_share_theft() {
    // Setup: Large pool
    // Attack: Deposit amount that rounds to 0 shares
    // Expected: Either reject or give at least 1 share

    // If 0 shares given, attacker donated to pool (not an exploit)
    // But if this can be exploited to manipulate share price...
}
```

### Attack 5.4: Pool drain via max bets
```rust
// PSEUDOCODE
// Attack: Drain entire pool through legitimate max bets + luck

#[test]
fn attack_pool_drain_max_bets() {
    // Setup: Pool with minimum operating balance
    // Attack: Repeatedly bet max at highest multiplier
    // Question: Can pool be drained below MIN_OPERATING_BALANCE?

    // Check: Pool should stop accepting bets before draining
}
```

---

## Attack Vector 6: State Corruption

**File:** `plinko_backend/src/defi_accounting/tests/adversarial/state_corruption.rs`

### Attack 6.1: Concurrent LP operations
```rust
// PSEUDOCODE
// Attack: Corrupt LP state through concurrent operations

#[test]
fn attack_concurrent_lp_corruption() {
    // Simulate: Two LP deposits from same user in quick succession
    // Check: total_shares == sum of individual shares
    // Check: pool_reserve == sum of deposits

    // Race condition could cause shares or reserve to be wrong
}
```

### Attack 6.2: Game during LP withdrawal
```rust
// PSEUDOCODE
// Attack: Play game while LP withdrawal is pending

#[test]
fn attack_game_during_lp_pending() {
    // Setup: LP initiates withdrawal (pending state)
    // Attack: Same user plays game
    // Question: Does game use stale pool_reserve?

    // If pool_reserve not yet updated, payout calculation wrong
}
```

### Attack 6.3: Orphaned LP shares
```rust
// PSEUDOCODE
// Attack: Create LP shares that can never be redeemed

#[test]
fn attack_orphaned_lp_shares() {
    // Setup: LP deposits, gets shares
    // Attack: Drain pool_reserve to 0 via games
    // Result: LP has shares but reserve = 0
    // Question: Can LP withdraw anything? Are shares stuck?
}
```

---

## Success Criteria

Each test should:
1. **Attempt a specific exploit**
2. **PASS if exploit is thwarted** (code is secure)
3. **FAIL if exploit succeeds** (bug found)
4. **Print detailed output** showing what was attempted

Example test structure:
```rust
#[test]
fn attack_X() {
    // Setup
    let mut model = ProductionMirrorModel::new();

    // Execute attack
    let result = model.attempt_exploit();

    // Verify exploit failed
    assert!(
        result.is_err() || !result.unwrap().was_exploited(),
        "EXPLOIT SUCCEEDED: {}", describe_exploit()
    );

    // Verify invariants still hold
    assert!(model.check_solvency().is_ok(), "Solvency broken!");
}
```

---

## Deployment Notes

**This is a test-only change.** No canister deployment needed.

```bash
# Run adversarial tests
cd plinko_backend
cargo test adversarial -- --nocapture

# If any test FAILS, a bug was found
# Document the bug in the PR
```

**Affected files:**
- `plinko_backend/src/defi_accounting/tests/adversarial/` (NEW)
- `plinko_backend/src/defi_accounting/tests/mod.rs` (MODIFY - add adversarial module)
