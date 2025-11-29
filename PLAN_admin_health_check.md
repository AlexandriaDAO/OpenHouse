# Admin Health Check Feature - Dice Backend

**Type:** NEW FEATURE
**Scope:** Dice Backend only
**Purpose:** Admin-only endpoint to check accounting health from frontend

---

## Autonomous PR Orchestrator

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

### Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

### Workflow
1. Verify isolation in worktree: `/home/theseus/alexandria/openhouse-admin-health`
2. Implement the feature below
3. Build & Deploy: `./deploy.sh --dice-only`
4. Create PR (MANDATORY)
5. Iterate on review feedback

**Branch:** `feature/admin-health-check`
**Worktree:** `/home/theseus/alexandria/openhouse-admin-health`

---

## Feature Summary

Add an admin-only `admin_health_check()` endpoint that replicates the logic of `scripts/check_balance.sh` as a backend function. This allows the admin to monitor accounting health from a frontend UI without SSH access.

**Admin Principal:** `p7336-jmpo5-pkjsf-7dqkd-ea3zu-g2ror-ctcn2-sxtuo-tjve3-ulrx7-wae`

---

## Current State

**File:** `dice_backend/src/lib.rs`
- Contains all endpoint exports
- Accounting endpoints at lines 102-164
- No admin-specific endpoints exist

**File:** `dice_backend/src/defi_accounting/types.rs`
- Contains `PendingWithdrawal`, `WithdrawalType`, `AuditEntry`, `AuditEvent`
- No `HealthCheck` type exists

**File:** `dice_backend/src/defi_accounting/accounting.rs`
- Contains `refresh_canister_balance()`, `get_balance_internal()`, etc.
- Has `calculate_total_deposits()` (private)
- No admin health check function exists

**File:** `dice_backend/dice_backend.did`
- Candid interface definition
- No `HealthCheck` type or `admin_health_check` method

---

## Implementation

### 1. Add `HealthCheck` type to `types.rs`

Add after the `AuditEvent` enum (around line 99):

```rust
/// Health check result for admin monitoring.
/// Mirrors the logic of scripts/check_balance.sh
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct HealthCheck {
    pub pool_reserve: u64,
    pub total_deposits: u64,
    pub canister_balance: u64,
    pub calculated_total: u64,
    pub excess: i64,
    pub excess_usdt: f64,
    pub is_healthy: bool,
    pub health_status: String,
    pub timestamp: u64,
}
```

### 2. Add `admin_health_check` function to `accounting.rs`

Add at the end of the file (after `get_canister_balance`):

```rust
use super::types::HealthCheck;

const ADMIN_PRINCIPAL: &str = "p7336-jmpo5-pkjsf-7dqkd-ea3zu-g2ror-ctcn2-sxtuo-tjve3-ulrx7-wae";

/// Admin-only health check that mirrors scripts/check_balance.sh
/// Returns comprehensive accounting health status.
pub async fn admin_health_check() -> Result<HealthCheck, String> {
    let admin = Principal::from_text(ADMIN_PRINCIPAL)
        .map_err(|_| "Invalid admin principal constant")?;

    let caller = ic_cdk::api::msg_caller();
    if caller != admin {
        return Err("Unauthorized: admin only".to_string());
    }

    // Refresh canister balance from ledger
    let canister_balance = refresh_canister_balance().await;

    // Get current values
    let pool_reserve = super::liquidity_pool::get_pool_reserve();
    let total_deposits = calculate_total_deposits();
    let calculated_total = pool_reserve + total_deposits;

    // Calculate excess (can be negative if deficit)
    let excess = canister_balance as i64 - calculated_total as i64;
    let excess_usdt = excess as f64 / 1_000_000.0;

    // Determine health status
    let (is_healthy, health_status) = if excess < 0 {
        (false, "CRITICAL: DEFICIT - Liabilities exceed assets".to_string())
    } else if excess < 1_000_000 {
        (true, "HEALTHY".to_string())
    } else if excess < 5_000_000 {
        (true, "WARNING: Excess accumulating (1-5 USDT)".to_string())
    } else {
        (false, "ACTION REQUIRED: High excess (>5 USDT)".to_string())
    };

    Ok(HealthCheck {
        pool_reserve,
        total_deposits,
        canister_balance,
        calculated_total,
        excess,
        excess_usdt,
        is_healthy,
        health_status,
        timestamp: ic_cdk::api::time(),
    })
}
```

### 3. Export `HealthCheck` from `mod.rs`

Update `dice_backend/src/defi_accounting/mod.rs` to export the type:

```rust
pub use types::HealthCheck;
```

### 4. Add endpoint to `lib.rs`

Add after the accounting endpoints section (around line 164):

```rust
// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

#[update]
async fn admin_health_check() -> Result<defi_accounting::types::HealthCheck, String> {
    defi_accounting::accounting::admin_health_check().await
}
```

### 5. Update `dice_backend.did`

Add the `HealthCheck` type after `ApyInfo` (around line 48):

```candid
type HealthCheck = record {
  pool_reserve: nat64;
  total_deposits: nat64;
  canister_balance: nat64;
  calculated_total: nat64;
  excess: int64;
  excess_usdt: float64;
  is_healthy: bool;
  health_status: text;
  timestamp: nat64;
};
```

Add the method to the service (around line 100):

```candid
  // Admin endpoints
  admin_health_check: () -> (variant { Ok: HealthCheck; Err: text });
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `dice_backend/src/defi_accounting/types.rs` | Add `HealthCheck` struct |
| `dice_backend/src/defi_accounting/accounting.rs` | Add `admin_health_check` function |
| `dice_backend/src/defi_accounting/mod.rs` | Export `HealthCheck` |
| `dice_backend/src/lib.rs` | Add `admin_health_check` endpoint |
| `dice_backend/dice_backend.did` | Add `HealthCheck` type and method |

---

## Deployment

```bash
# Build
cargo build --target wasm32-unknown-unknown --release -p dice_backend

# Deploy dice backend only
./deploy.sh --dice-only

# Verify (as admin)
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai admin_health_check
```

---

## Testing

```bash
# Test as admin (should succeed)
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai admin_health_check

# Test as non-admin (should fail with "Unauthorized")
dfx identity use default
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai admin_health_check
# Expected: (variant { Err = "Unauthorized: admin only" })
```

---

## PR Template

```
feat: Add admin health check endpoint for dice backend

## Summary
- Adds `admin_health_check()` endpoint for monitoring accounting health
- Mirrors logic of `scripts/check_balance.sh` as a backend function
- Admin-only (principal: p7336-jmpo5-...)

## Changes
- types.rs: Add `HealthCheck` struct
- accounting.rs: Add `admin_health_check` function
- mod.rs: Export `HealthCheck`
- lib.rs: Add endpoint
- dice_backend.did: Add Candid types

## Usage
```
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai admin_health_check
```

## Returns
- pool_reserve, total_deposits, canister_balance
- excess (positive = surplus, negative = deficit)
- health_status: HEALTHY, WARNING, CRITICAL, ACTION REQUIRED
- timestamp

Deployed to mainnet:
- Dice Backend: whchi-hyaaa-aaaao-a4ruq-cai
```

---

## Verification Checklist

- [ ] `HealthCheck` type added to types.rs
- [ ] `admin_health_check` function in accounting.rs
- [ ] Principal check works (rejects non-admin)
- [ ] Candid interface updated
- [ ] Build succeeds
- [ ] Deployed to mainnet
- [ ] Admin can call successfully
- [ ] Non-admin gets "Unauthorized" error
- [ ] PR created
