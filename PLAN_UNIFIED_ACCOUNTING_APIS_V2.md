# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-unified-apis"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-unified-apis`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release -p plinko_backend -p dice_backend
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Test plinko has new endpoints
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_house_balance
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_stats_count

   # Test dice has renamed type
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_my_lp_position
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: unify defi_accounting API exposure - plinko matches dice

- Add 12 missing query endpoints to plinko_backend
- Rename get_pending_withdrawal → get_my_withdrawal_status (consistency)
- Fix redeemable_icp → redeemable_usdt naming in both backends
- Update .did files with new endpoints and corrected types
- NO changes to defi_accounting/ internal logic"

   git push -u origin feature/unified-accounting-apis-v2

   gh pr create --title "Feat: Unify defi_accounting API exposure (plinko matches dice)" --body "$(cat <<'EOF'
## Summary
Aligns plinko_backend's exposed endpoints with dice_backend so the frontend /liquidity route works identically for both games.

## Changes

### Plinko Backend (`plinko_backend/src/lib.rs`)
Added 12 missing query endpoints (thin wrappers - no logic changes):
- `get_house_balance()` - Pool reserve balance
- `get_max_allowed_payout()` - Max payout limit
- `get_my_withdrawal_status()` - Renamed from get_pending_withdrawal
- `calculate_shares_preview()` - Preview LP shares
- `can_accept_bets()` - Pool readiness check
- `get_stats_range()` - Stats by date range
- `get_stats_count()` - Total snapshot count
- `admin_get_orphaned_funds_report_full()` - Full orphaned report
- `admin_get_all_balances()` - Paginated balances
- `admin_get_all_balances_complete()` - All balances
- `admin_get_all_lp_positions()` - Paginated LP positions
- `admin_get_all_lp_positions_complete()` - All LP positions

### Type Naming Fix (Both Backends)
- `LPPosition.redeemable_icp` → `LPPosition.redeemable_usdt`
- System uses ckUSDT, not ICP - naming was incorrect

### Files Modified
1. `plinko_backend/src/lib.rs` - Add endpoints
2. `plinko_backend/plinko_backend.did` - Add interface definitions
3. `dice_backend/src/defi_accounting/liquidity_pool.rs` - Fix type name
4. `dice_backend/dice_backend.did` - Fix type name

### Files NOT Modified
- `plinko_backend/src/defi_accounting/*` - No internal logic changes
- `dice_backend/src/lib.rs` - No endpoint changes needed

## Breaking Changes
1. Plinko: `get_pending_withdrawal` → `get_my_withdrawal_status`
2. Both: `LPPosition.redeemable_icp` → `LPPosition.redeemable_usdt`

## Testing
- Built successfully: `cargo build --target wasm32-unknown-unknown --release`
- Deployed to mainnet and verified endpoints respond

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ⚠️ MAINNET DEPLOYMENT: All changes go directly to production
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/unified-accounting-apis-v2`
**Worktree:** `/home/theseus/alexandria/openhouse-unified-apis`

---

# Implementation Plan

## Goal
Align plinko_backend's exposed endpoints with dice_backend so the frontend `/liquidity` route works identically for both games.

## Scope
- **Plinko**: `plinko_backend/src/lib.rs`, `plinko_backend/plinko_backend.did`
- **Dice**: `dice_backend/src/defi_accounting/liquidity_pool.rs`, `dice_backend/dice_backend.did` (type rename only)
- **No changes to**: `defi_accounting/` internal logic (all functions already exist)

---

## Step 1: Add missing endpoints to `plinko_backend/src/lib.rs`

### 1.1 Add after line 249 (after `get_my_balance`):

```rust
#[query]
fn get_house_balance() -> u64 {
    defi_accounting::query::get_house_balance()
}

#[query]
fn get_max_allowed_payout() -> u64 {
    defi_accounting::query::get_max_allowed_payout()
}
```

### 1.2 Rename `get_pending_withdrawal` to `get_my_withdrawal_status` (line 237-240):

Change:
```rust
#[query]
fn get_pending_withdrawal() -> Option<defi_accounting::types::PendingWithdrawal> {
```

To:
```rust
#[query]
fn get_my_withdrawal_status() -> Option<defi_accounting::types::PendingWithdrawal> {
```

### 1.3 Add after line 278 (after `get_my_lp_position`):

```rust
#[query]
fn calculate_shares_preview(amount: u64) -> Result<candid::Nat, String> {
    defi_accounting::liquidity_pool::calculate_shares_preview(amount)
}

#[query]
fn can_accept_bets() -> bool {
    defi_accounting::liquidity_pool::can_accept_bets()
}
```

### 1.4 Add after line 302 (after `admin_get_orphaned_funds_report`):

```rust
#[query]
fn admin_get_orphaned_funds_report_full() -> Result<defi_accounting::types::OrphanedFundsReport, String> {
    defi_accounting::admin_query::get_orphaned_funds_report_full()
}

#[query]
fn admin_get_all_balances(offset: u64, limit: u64) -> Result<Vec<defi_accounting::types::UserBalance>, String> {
    defi_accounting::admin_query::get_all_balances(offset, limit)
}

#[query]
fn admin_get_all_balances_complete() -> Result<Vec<defi_accounting::types::UserBalance>, String> {
    defi_accounting::admin_query::get_all_balances_complete()
}

#[query]
fn admin_get_all_lp_positions(offset: u64, limit: u64) -> Result<Vec<defi_accounting::types::LPPositionInfo>, String> {
    defi_accounting::admin_query::get_all_lp_positions(offset, limit)
}

#[query]
fn admin_get_all_lp_positions_complete() -> Result<Vec<defi_accounting::types::LPPositionInfo>, String> {
    defi_accounting::admin_query::get_all_lp_positions_complete()
}
```

### 1.5 Add after line 316 (after `get_pool_apy`):

```rust
#[query]
fn get_stats_range(start_ts: u64, end_ts: u64) -> Vec<defi_accounting::DailySnapshot> {
    defi_accounting::get_snapshots_range(start_ts, end_ts)
}

#[query]
fn get_stats_count() -> u64 {
    defi_accounting::get_snapshot_count()
}
```

---

## Step 2: Update `plinko_backend/plinko_backend.did`

### 2.1 Add missing types (after line 113, after AbandonedEntry):

```candid
type UserBalance = record {
  user: principal;
  balance: nat64;
};

type LPPositionInfo = record {
  user: principal;
  shares: nat;
};
```

### 2.2 Fix LPPosition type (line 36-40):

Change `redeemable_icp` to `redeemable_usdt`:
```candid
type LPPosition = record {
  shares: nat;
  pool_ownership_percent: float64;
  redeemable_usdt: nat;
};
```

### 2.3 Update service definition - replace `get_pending_withdrawal` with `get_my_withdrawal_status` and add all new endpoints:

In the service block, change:
```candid
  get_pending_withdrawal: () -> (opt PendingWithdrawal) query;
```
To:
```candid
  get_my_withdrawal_status: () -> (opt PendingWithdrawal) query;
```

Add after `get_my_balance`:
```candid
  get_house_balance: () -> (nat64) query;
  get_max_allowed_payout: () -> (nat64) query;
```

Add after `get_house_mode`:
```candid
  calculate_shares_preview: (nat64) -> (variant { Ok: nat; Err: text }) query;
  can_accept_bets: () -> (bool) query;
```

Add after `admin_get_orphaned_funds_report`:
```candid
  admin_get_orphaned_funds_report_full: () -> (variant { Ok: OrphanedFundsReport; Err: text }) query;
  admin_get_all_balances: (nat64, nat64) -> (variant { Ok: vec UserBalance; Err: text }) query;
  admin_get_all_balances_complete: () -> (variant { Ok: vec UserBalance; Err: text }) query;
  admin_get_all_lp_positions: (nat64, nat64) -> (variant { Ok: vec LPPositionInfo; Err: text }) query;
  admin_get_all_lp_positions_complete: () -> (variant { Ok: vec LPPositionInfo; Err: text }) query;
```

Add after `get_pool_apy`:
```candid
  get_stats_range: (nat64, nat64) -> (vec DailySnapshot) query;
  get_stats_count: () -> (nat64) query;
```

---

## Step 3: Fix `redeemable_usdt` naming in dice_backend

### 3.1 In `dice_backend/src/defi_accounting/liquidity_pool.rs`:

**Line 112** - Change struct field:
```rust
pub redeemable_usdt: Nat,  // was: redeemable_icp
```

**Line 432** - Change variable name:
```rust
let (ownership_percent, redeemable_usdt) = if total_shares == 0u64 {  // was: redeemable_icp
```

**Line 452** - Change field assignment:
```rust
redeemable_usdt,  // was: redeemable_icp
```

### 3.2 In `dice_backend/dice_backend.did` (line 38):

Change:
```candid
type LPPosition = record {
  shares: nat;
  pool_ownership_percent: float64;
  redeemable_icp: nat;
};
```

To:
```candid
type LPPosition = record {
  shares: nat;
  pool_ownership_percent: float64;
  redeemable_usdt: nat;
};
```

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `plinko_backend/src/lib.rs` | Add 12 endpoints, rename 1 |
| `plinko_backend/plinko_backend.did` | Add types, endpoints, fix naming |
| `dice_backend/src/defi_accounting/liquidity_pool.rs` | Rename field (3 occurrences) |
| `dice_backend/dice_backend.did` | Rename field (1 occurrence) |

## Files NOT Modified

- All `plinko_backend/src/defi_accounting/*` files
- `dice_backend/src/lib.rs`
- All other dice_backend defi_accounting files

---

## Breaking Changes

1. **Plinko**: `get_pending_withdrawal` → `get_my_withdrawal_status`
2. **Both backends**: `LPPosition.redeemable_icp` → `LPPosition.redeemable_usdt`

Frontend will need to update to use the new names.

---

## Verification Commands

After deployment, verify:

```bash
# Plinko new endpoints
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_house_balance
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_max_allowed_payout
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_stats_count
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai can_accept_bets

# Renamed endpoint
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_my_withdrawal_status

# Dice type check (should show redeemable_usdt)
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_my_lp_position
```
