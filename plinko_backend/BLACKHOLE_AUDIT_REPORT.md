# Plinko Backend Blackhole Audit Report

## Executive Summary

This audit examines the `plinko_backend` canister to identify **real accounting issues** that would cause the internal ledger to diverge from actual ckUSDT holdings over time if the canister were blackholed.

**Result: No Critical Accounting Bugs Found**

After tracing through all fund flows line-by-line, the accounting logic is sound. The canister maintains the invariant:

```
canister_ckusdt_balance >= pool_reserve + sum(user_balances)
```

Integer rounding always favors the house (depositors and winners get rounded down), creating a small surplus over time rather than a deficit.

---

## Methodology

Traced every code path that moves funds:
1. User deposits (ckUSDT → canister → user_balance)
2. User withdrawals (user_balance → canister → ckUSDT)
3. LP deposits (ckUSDT → canister → pool_reserve + shares)
4. LP withdrawals (shares + pool_reserve → canister → ckUSDT)
5. Game bets (user_balance ↔ pool_reserve)

---

## Fund Flow Analysis

### User Deposits (`accounting.rs:125-174`)

```
Flow: User's ckUSDT wallet → Canister's ckUSDT balance → User's internal balance

1. icrc2_transfer_from sends `amount` to canister (user pays fee separately)
2. On success, credit user_balance += amount

Result: canister_balance += amount, obligations += amount ✓ BALANCED
```

**No drift possible.** Transfer succeeds BEFORE crediting balance.

---

### User Withdrawals (`accounting.rs:180-251`)

```
Flow: User's internal balance → Pending state → Canister's ckUSDT → User's wallet

1. Create PendingWithdrawal record
2. Set user_balance = 0
3. Attempt transfer (amount - fee)
4. On success: remove pending
   On definite failure: rollback (restore balance)
   On uncertain: stay pending (user retries)

Result: Either balance restored OR transferred. Never both. ✓ SAFE
```

**No drift possible.** The "uncertain outcome" path is handled by requiring user action - the canister never auto-rolls-back uncertain transfers.

---

### LP Deposits (`liquidity_pool.rs:154-271`)

```
Flow: User's ckUSDT → Canister → pool_reserve + LP shares

1. Pre-flight check: calculate expected shares
2. Transfer from user (requires prior approval)
3. Post-flight check: recalculate shares (state may have changed)
4. Mint shares and add to pool_reserve

Result: canister_balance += amount, pool_reserve += amount ✓ BALANCED
```

**No drift possible.** Shares are calculated AFTER transfer succeeds.

---

### LP Withdrawals (`liquidity_pool.rs:282-408`)

```
Flow: LP shares → pool_reserve deduction → ckUSDT transfer → User's wallet

1. Burn shares (remove from LP_SHARES)
2. Deduct payout from pool_reserve
3. Create PendingWithdrawal
4. Attempt transfer
5. On success: complete, credit fee to parent
   On failure: rollback shares + reserve

Result: Either shares restored OR transferred. Never both. ✓ SAFE
```

**No drift possible.** CEI pattern (Checks-Effects-Interactions) ensures atomicity.

---

### Game Bets (`game.rs:84-161`)

```
Flow: user_balance → pool_reserve (on loss) OR pool_reserve → user_balance (on win)

1. Deduct bet from user_balance
2. Get VRF randomness
3. Calculate payout
4. Credit payout to user_balance
5. Settle with pool: pool gains (bet - payout) OR pool loses (payout - bet)

IMPORTANT: No ckUSDT moves. Only internal balances change.
Sum of (user_balances + pool_reserve) stays constant.
```

**No drift possible.** Games are zero-sum between users and pool.

---

## Integer Rounding Analysis

All divisions round DOWN (integer division in Rust):

| Operation | Formula | Rounding Direction |
|-----------|---------|-------------------|
| Share calculation | `(amount * total_shares) / reserve` | DOWN - user gets fewer shares |
| Payout calculation | `(shares * reserve) / total_shares` | DOWN - user gets less ckUSDT |
| Bet payout | `(bet * multiplier_bp) / 10000` | DOWN - player gets less |

**Effect:** Over millions of operations, the canister accumulates "dust" - tiny fractions that favor the house. This creates a small surplus, not a deficit. The canister becomes MORE solvent over time from rounding alone.

**Quantified:** With 6-decimal USDT and carefully chosen multipliers (all multiples of 50bp), most operations have zero rounding loss. Worst case is ~1 decimal unit per operation.

---

## Potential Issues (Non-Critical)

### 1. Audit Log Pruning

**Location:** `accounting.rs:90-109`

The audit log caps at 1,000 entries. When exceeded, oldest entries are pruned.

**Impact:**
- `sum_abandoned_from_audit_internal()` may undercount if abandonments were pruned
- This affects the `OrphanedFundsReport` accuracy, NOT actual fund safety

**Severity:** Informational. Doesn't affect fund integrity.

---

### 2. Cached Balance Staleness

**Location:** `accounting.rs:647-670`

The `CACHED_CANISTER_BALANCE` is only refreshed when `play_plinko` or `play_multi_plinko` is called.

**Impact:**
- If no games are played for extended periods, `is_canister_solvent()` uses stale data
- However, solvency check is conservative (requires balance >= obligations)
- Stale high balance = games allowed when they should be
- Stale low balance = games blocked when they could be allowed

**Severity:** Low. Worst case is unnecessary game blocking, not fund loss.

---

### 3. Statistics Gaps

**Location:** `statistics/collector.rs:94-115`

Daily snapshots are triggered by:
1. First bet of a new day
2. Backup timer (every 24 hours)

**Impact:** If no bets occur and timer fires at wrong time, a day could be missed.

**Severity:** Informational. Affects APY display accuracy, not funds.

---

### 4. Multi-Ball Variance Validation

**Location:** `game.rs:186-196`

For 4+ balls, the max payout validation uses a statistical estimate (`effective_mult_bp`) rather than the theoretical maximum (6.52x for all balls).

**Impact:**
- Actual payout could exceed validated max in extreme luck scenarios
- However, `settle_bet` re-checks pool solvency before paying
- If pool can't afford it, the entire bet is rolled back

**Severity:** Low. The rollback path is correct. Worst case is a valid-seeming bet that fails at settlement.

---

## Conclusion

The `plinko_backend` canister has **no accounting bugs** that would cause fund divergence over time.

The design follows sound principles:
- **Checks-Effects-Interactions (CEI)** - State changes before external calls
- **Pessimistic locking** - PendingWithdrawal prevents double-spend
- **Conservative rounding** - Always rounds in house's favor
- **Solvency invariant** - `canister_balance >= obligations` checked before games

**If blackholed today:**
- Games would continue to function correctly
- Deposits/withdrawals would continue to work
- Accounting would remain accurate indefinitely
- The only degradation would be in auxiliary features (statistics, audit logs)

The canister is safe for long-term autonomous operation.

---

*Report generated: 2025-12-09*
*Auditor: Claude Code AI Assistant*
*Canister: weupr-2qaaa-aaaap-abl3q-cai (Plinko Backend)*
