# OpenHouse Casino - Security Audit Results

**Audit Date:** 2025-12-11
**Auditor:** Claude Code (Automated Security Analysis)
**Scope:** crash_backend, dice_backend, plinko_backend, roulette_backend
**Methodology:** Mechanical vulnerability discovery via pattern scanning

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total async functions audited | 36 |
| Total await points analyzed | 42 |
| State mutations reviewed | 129 |
| Arithmetic operations checked | 40+ |
| **Critical findings** | 1 |
| **High findings** | 0 |
| **Medium findings** | 2 |
| **Low/Info findings** | 4 |

### Overall Assessment: **MOSTLY SECURE**

The codebase demonstrates strong security practices with explicit TOCTOU mitigation, proper arithmetic safety, and comprehensive rollback handling. One critical issue exists in the roulette backend which lacks DeFi integration.

---

## Scan 1: TOCTOU (Time-of-Check-Time-of-Use) Results

### Pattern Analyzed
```
READ state → AWAIT → USE stale state
```

### Async Functions Audit Table

| Function | Location | State Read Before Await? | Used After Await? | Verdict |
|----------|----------|-------------------------|-------------------|---------|
| `deposit` | accounting.rs:148 | No | N/A | **SAFE** |
| `withdraw_all` | accounting.rs:216 | Yes (balance) | No (zeroed first) | **SAFE** |
| `withdraw_internal` | accounting.rs:221 | Yes (balance) | No (CEI pattern) | **SAFE** |
| `attempt_transfer` | accounting.rs:325 | No | N/A | **SAFE** |
| `auto_withdraw_parent` | accounting.rs:400 | Yes (balance) | Via withdraw_internal | **SAFE** |
| `retry_withdrawal` | accounting.rs:471 | Yes (pending) | Same pending state | **SAFE** |
| `refresh_canister_balance` | accounting.rs:744 | No | N/A | **SAFE** |
| `admin_health_check` | admin_query.rs:25 | No | N/A | **SAFE** |
| `deposit_liquidity` | liquidity_pool.rs:171 | Yes (shares) | Recalculated after | **SAFE** |
| `withdraw_liquidity` | liquidity_pool.rs:311 | Yes (shares) | Burned before await | **SAFE** |
| `withdraw_all_liquidity` | liquidity_pool.rs:448 | Yes | Via withdraw_liquidity | **SAFE** |
| `transfer_from_user` | liquidity_pool.rs:676 | No | N/A | **SAFE** |
| `play_crash` | game.rs:175 | No (max_payout check) | try_deduct_balance after | **SAFE** |
| `play_crash_multi` | game.rs:258 | No (max_payout check) | try_deduct_balance after | **SAFE** |
| `play_dice` | game.rs:79 | No (max_payout check) | try_deduct_balance after | **SAFE** |
| `play_multi_dice` | game.rs:191 | No (max_payout check) | try_deduct_balance after | **SAFE** |
| `play_plinko` | game.rs:84 | No (max_payout check) | try_deduct_balance after | **SAFE** |
| `play_multi_plinko` | game.rs:155 | No (max_payout check) | try_deduct_balance after | **SAFE** |
| `spin` (roulette) | game.rs:11 | No | **NO DEFI INTEGRATION** | **REVIEW** |

### Key Security Pattern Identified

All game play functions follow the **correct TOCTOU-safe pattern**:

```rust
// 1. Validate inputs (no state read)
// 2. Check max payout limit (read-only query)
// 3. raw_rand().await (async suspension point)
// 4. try_deduct_balance(caller, amount) // ATOMIC read + deduct
// 5. Process game result
// 6. Credit payout
// 7. Settle with pool
```

The `try_deduct_balance()` function at `accounting.rs:607` is the critical fix that prevents TOCTOU:
```rust
pub fn try_deduct_balance(user: Principal, amount: u64) -> Result<u64, String> {
    // Reads CURRENT balance and deducts atomically
    // No await between check and deduction
}
```

---

## Scan 2: Rollback Consistency Results

### Pattern Analyzed
```
STATE_CHANGE_1 → AWAIT → STATE_CHANGE_2 (what if await fails?)
```

### Multi-State Functions Audit

| Function | State Changes | Await Points | Rollback on Failure? | Verdict |
|----------|--------------|--------------|---------------------|---------|
| `withdraw_internal` | 1. Create pending, 2. Zero balance | 1 | Yes (rollback_withdrawal) | **SAFE** |
| `withdraw_liquidity` | 1. Burn shares, 2. Deduct reserve, 3. Schedule pending | 1 | Yes (comprehensive) | **SAFE** |
| `deposit_liquidity` | 1. Transfer tokens (await), 2. Mint shares | 1 | Yes (slippage refund) | **SAFE** |
| `play_crash` | 1. Deduct balance, 2. Credit payout, 3. Settle pool | 0 (after VRF) | Yes (refund on settle fail) | **SAFE** |
| `deposit` | 1. Transfer (await), 2. Credit balance | 1 | No rollback needed | **SAFE** |

### Rollback Handlers Found

1. **`rollback_withdrawal()`** - accounting.rs:350
   - Restores user balance for User withdrawals
   - Restores LP shares + reserve for LP withdrawals
   - Removes pending state

2. **`restore_lp_position()`** - liquidity_pool.rs:659
   - Restores LP shares to user
   - Restores reserve amount to pool

3. **Game rollback pattern**:
   ```rust
   if let Err(e) = liquidity_pool::settle_bet(bet_amount, payout) {
       // Refund bet to user
       let refund_balance = current_balance.checked_add(bet_amount)?;
       accounting::update_balance(caller, refund_balance)?;
   }
   ```

---

## Scan 3: Arithmetic Safety Results

### Protected Operations Count

| Backend | checked_* | saturating_* | Total Protected |
|---------|-----------|--------------|-----------------|
| crash_backend | 12 | 10 | 22 |
| dice_backend | 12 | 10 | 22 |
| plinko_backend | 12 | 10 | 22 |

### Critical Financial Operations

| Location | Operation | Protection | Verdict |
|----------|-----------|------------|---------|
| accounting.rs:197 | `current.checked_add(amount)` | checked_add | **SAFE** |
| accounting.rs:620 | `current.checked_sub(amount)` | checked_sub | **SAFE** |
| accounting.rs:660 | `current.checked_add(amount)` | checked_add | **SAFE** |
| liquidity_pool.rs:361 | `payout_u64.checked_mul(FEE_BPS)` | checked_mul | **SAFE** |
| liquidity_pool.rs:368 | `payout_u64.saturating_sub(fee)` | saturating_sub | **SAFE** |
| game.rs (all) | Payout calculations | u128 intermediate | **SAFE** |

### Nat (Arbitrary Precision) Usage

LP share calculations use `Nat` type for:
- Share minting: `amount * total_shares / reserve`
- Share burning: `shares * reserve / total_shares`
- No overflow possible with arbitrary precision

### Potential Issues (INFO)

1. **crash_backend/game.rs:225**: `(payout as i64) - (bet_amount as i64)`
   - Uses `as i64` cast which could theoretically overflow for massive values
   - **Mitigated by**: MAX_USER_DEPOSIT constant (1B USDT)
   - **Verdict**: Low risk, acceptable

---

## Scan 4: Access Control Results

### Update Functions Audit

| Function | File | Restriction | Caller Check | Verdict |
|----------|------|-------------|--------------|---------|
| `play_crash` | lib.rs:127 | Any user | msg_caller (implicit) | **SAFE** |
| `play_crash_multi` | lib.rs:137 | Any user | msg_caller | **SAFE** |
| `deposit` | lib.rs:159 | Any user | msg_caller | **SAFE** |
| `withdraw_all` | lib.rs:164 | User's own balance | msg_caller | **SAFE** |
| `retry_withdrawal` | lib.rs:169 | User's own pending | msg_caller | **SAFE** |
| `abandon_withdrawal` | lib.rs:174 | User's own pending | msg_caller | **SAFE** |
| `deposit_liquidity` | lib.rs:208 | Any user | msg_caller | **SAFE** |
| `withdraw_all_liquidity` | lib.rs:213 | User's own shares | msg_caller | **SAFE** |
| `admin_health_check` | lib.rs:252 | Admin only | require_admin() | **SAFE** |

### Admin Protection

```rust
// admin_query.rs:10-17
const ADMIN_PRINCIPAL: &str = "p7336-jmpo5-pkjsf-7dqkd-ea3zu-g2ror-ctcn2-sxtuo-tjve3-ulrx7-wae";

fn require_admin() -> Result<(), String> {
    let caller = ic_cdk::api::msg_caller();
    let admin = Principal::from_text(ADMIN_PRINCIPAL)?;
    if caller != admin {
        return Err("Unauthorized: admin only".to_string());
    }
    Ok(())
}
```

All admin functions properly call `require_admin()?` at function start.

---

## Scan 5: IC-Specific Results

### 5a: Candid Decoding DoS

| Endpoint | Vec Arguments | Risk | Mitigation |
|----------|---------------|------|------------|
| `spin` (roulette) | `Vec<Bet>` | Medium | MAX_BETS_PER_SPIN = 20 |
| `admin_get_audit_log` | Returns `Vec<AuditEntry>` | Low | Capped at 100 entries |

### 5b: Cycle Drain

| Query Function | Iteration | Risk | Verdict |
|----------------|-----------|------|---------|
| `get_daily_stats` | Bounded by limit | Low | **SAFE** |
| `get_pool_stats` | Single calculation | None | **SAFE** |
| `calculate_total_supply` | Iterates all LPs | Medium | **REVIEW** |

**Finding (MEDIUM)**: `calculate_total_supply()` iterates all LP positions on every call. With many LPs, this could be expensive.

### 5c: Upgrade Safety

```rust
#[pre_upgrade]
fn pre_upgrade() {
    // StableBTreeMap persists automatically
    ic_cdk::println!("Pre-upgrade: state persists automatically");
}

#[post_upgrade]
fn post_upgrade() {
    // Restart timers
    defi_accounting::accounting::start_parent_withdrawal_timer();
    defi_accounting::accounting::start_balance_reconciliation_timer();
    // Initialize balance cache
    ic_cdk_timers::set_timer(std::time::Duration::ZERO, async {
        defi_accounting::accounting::refresh_canister_balance().await;
    });
}
```

**Verdict**: **SAFE** - Uses StableBTreeMap for automatic persistence.

### 5d: Inter-Canister Call Failures

| Call | Location | Failure Handling |
|------|----------|------------------|
| `icrc2_transfer_from` | deposit | Returns error to caller |
| `icrc1_transfer` | withdraw | TransferResult enum (Success/DefiniteError/UncertainError) |
| `icrc1_balance_of` | refresh_canister_balance | Falls back to cached value |

**Verdict**: **SAFE** - Comprehensive error handling with UncertainError for timeout scenarios.

---

## Scan 6: Concurrency Matrix

### Operation Pairs Analysis

| Op A | Op B | Concurrent Possible? | Shared State | Protected? | Verdict |
|------|------|---------------------|--------------|------------|---------|
| deposit | deposit (same user) | Yes | user_balance | checked_add | **SAFE** |
| deposit | withdraw (same user) | No | pending check | PENDING_WITHDRAWALS | **SAFE** |
| deposit | play_game (same user) | Yes | user_balance | try_deduct_balance | **SAFE** |
| withdraw | withdraw (same user) | No | pending check | PENDING_WITHDRAWALS | **SAFE** |
| withdraw | play_game (same user) | No | pending check | PENDING_WITHDRAWALS | **SAFE** |
| LP_deposit | LP_withdraw (same) | No | pending check | PENDING_WITHDRAWALS | **SAFE** |
| LP_deposit | user_withdraw (diff) | Yes | pool_reserve | Nat arithmetic | **SAFE** |
| play_game | play_game (same user) | Yes | user_balance | try_deduct_balance | **SAFE** |
| play_game | LP_withdraw (diff) | Yes | pool_reserve | settle_bet | **SAFE** |

### Key Protection Mechanisms

1. **PENDING_WITHDRAWALS guard**: Prevents any balance modification during withdrawal
2. **try_deduct_balance**: Atomic read-and-deduct prevents double-spend
3. **CEI Pattern**: State changes committed before await points
4. **Nat arithmetic**: Arbitrary precision prevents overflow in LP calculations

---

## Detailed Findings

### Finding 1: Roulette Backend Lacks DeFi Integration

- **Severity**: CRITICAL
- **Location**: `roulette_backend/src/lib.rs`
- **Description**: The roulette backend does not integrate with the defi_accounting module. The `spin()` function returns results but does NOT:
  - Deduct bet amounts from user balance
  - Credit winnings to user balance
  - Settle with the liquidity pool
- **Current State**:
  ```rust
  #[query]
  fn get_my_balance() -> u64 {
      0  // Stub - always returns 0
  }

  #[query]
  fn get_house_balance() -> u64 {
      1_000_000_000_000  // Stub - dummy value
  }
  ```
- **Impact**: Roulette games do NOT use real money. Users cannot actually bet.
- **Recommendation**: Integrate defi_accounting module following crash/dice/plinko pattern
- **Status**: Known (marked with TODO comments)

---

### Finding 2: LP Share Calculation Iteration

- **Severity**: MEDIUM
- **Location**: `liquidity_pool.rs:529-535`
- **Description**: `calculate_total_supply()` iterates all LP positions on every call:
  ```rust
  fn calculate_total_supply() -> Nat {
      LP_SHARES.with(|shares| {
          shares.borrow()
              .iter()
              .map(|entry| entry.value().0)
              .fold(Nat::from(0u64), |acc, amt| acc + amt)
      })
  }
  ```
- **Impact**: With many LP providers (1000+), this could be expensive in cycles
- **Recommendation**: Consider caching total_supply in a separate StableCell
- **Status**: New finding

---

### Finding 3: Roulette Vec<Bet> DoS Potential

- **Severity**: MEDIUM
- **Location**: `roulette_backend/src/game.rs:11`
- **Description**: The `spin()` function accepts `Vec<Bet>` with MAX_BETS_PER_SPIN = 20
- **Impact**: Limited DoS vector - attacker can send 20 bets per call
- **Mitigation Present**: MAX_BETS_PER_SPIN constant limits vector size
- **Recommendation**: Consider validating total bet amount against caller's balance
- **Status**: Partially mitigated

---

### Finding 4: Hardcoded Admin Principal

- **Severity**: LOW
- **Location**: `admin_query.rs:6`
- **Description**: Admin principal is hardcoded:
  ```rust
  const ADMIN_PRINCIPAL: &str = "p7336-jmpo5-pkjsf-7dqkd-ea3zu-g2ror-ctcn2-sxtuo-tjve3-ulrx7-wae";
  ```
- **Impact**: Cannot change admin without canister upgrade
- **Recommendation**: Consider multi-sig or configurable admin list
- **Status**: Info

---

### Finding 5: Balance Overflow Edge Case Documentation

- **Severity**: INFO
- **Location**: `accounting.rs:635-647`
- **Description**: The `force_credit_balance_system()` function documents theoretical overflow impossibility:
  ```rust
  /// However, this is theoretically impossible because:
  /// - Token is USDT (6 decimals)
  /// - Max u64 is ~18 quintillion (1.8 * 10^19)
  /// - Total USDT supply is ~100 billion (10^11)
  /// - Therefore, `current_balance + refund` can never overflow u64.
  ```
- **Impact**: None - correctly documented impossibility
- **Status**: Info - good documentation practice

---

### Finding 6: Anonymous Principal Protection

- **Severity**: INFO
- **Location**: Multiple locations
- **Description**: Code properly prevents anonymous principal from:
  - Depositing liquidity (`liquidity_pool.rs:187`)
  - Withdrawing liquidity (`liquidity_pool.rs:315`)
  - Receiving burned shares (assigned to anonymous as burn address)
- **Impact**: None - correctly implemented
- **Status**: Good practice

---

### Finding 7: TOCTOU Fix Documentation

- **Severity**: INFO
- **Location**: `accounting.rs:592-606`
- **Description**: Excellent in-code documentation of TOCTOU fix:
  ```rust
  /// # TOCTOU Race Condition Fix
  /// This function prevents the Time-of-Check-Time-of-Use vulnerability by performing
  /// balance check and deduction atomically. Unlike the old pattern where balance was
  /// captured before an await point and then used after, this function reads the CURRENT
  /// balance at the time of deduction.
  ```
- **Impact**: Demonstrates security-aware development
- **Status**: Good practice

---

## Reusable Tooling

### `scripts/security-scan.sh`

A reusable security scanning script has been created that:
- Scans for TOCTOU patterns (state reads before await)
- Identifies rollback consistency issues
- Finds unprotected arithmetic operations
- Checks access control on update functions
- Analyzes IC-specific vulnerabilities

Usage:
```bash
./scripts/security-scan.sh           # Scan all backends
./scripts/security-scan.sh crash_backend  # Scan specific backend
```

---

## Recommendations

### Immediate Actions
1. **CRITICAL**: Integrate defi_accounting into roulette_backend before production use
2. Consider caching total LP supply to reduce iteration costs

### Future Improvements
1. Add configurable admin list for multi-sig governance
2. Consider rate limiting on game endpoints
3. Add circuit breakers for anomaly detection

---

## Conclusion

The OpenHouse codebase demonstrates **strong security practices**:

1. **TOCTOU Mitigation**: `try_deduct_balance()` after await points
2. **Rollback Consistency**: Comprehensive rollback handlers for all failure modes
3. **Arithmetic Safety**: Extensive use of checked/saturating operations
4. **Access Control**: Proper caller verification on all sensitive endpoints
5. **IC-Specific**: Proper handling of inter-canister call failures

The main concern is the **incomplete roulette backend** which lacks DeFi integration. All other backends (crash, dice, plinko) are production-ready from a security perspective.

---

*Generated with Claude Code security audit methodology*
