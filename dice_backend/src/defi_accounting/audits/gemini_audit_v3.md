# Gemini Security Audit V3: ckUSDT Integration

**Auditor:** Gemini (Model 2.5)
**Date:** November 24, 2025
**Scope:** `@dice_backend/src/defi_accounting` (Post-Migration to ckUSDT)
**Severity Level:** HIGH

## Executive Summary

The migration from ICP to ckUSDT (ICRC-2) has introduced a **systematic insolvency leak** in the deposit logic. Unlike the ICP Ledger where the sender implicitly pays transfer fees, the ICRC-2 `transfer_from` standard dictates that the **spender** (the canister) pays the transaction fee. The current implementation credits the user the full amount while the canister absorbs the fee, creating a permanent deficit in the accounting system.

## 1. Critical: Deposit Fee Insolvency Leak

### The Vulnerability
In `accounting.rs` (`deposit`) and `liquidity_pool.rs` (`deposit_liquidity`), the code uses `icrc2_transfer_from` to pull funds from the user.

```rust
// accounting.rs:112-130
let args = TransferFromArgs {
    // ...
    amount: amount.into(),
    fee: Some(Nat::from(CKUSDT_TRANSFER_FEE)), 
    // ...
};

// ...

// Credits user with FULL amount
let amount_received = amount; 
```

**The Flaw:**
According to the ICRC-2 standard, the `spender` (the canister calling `transfer_from`) pays the transaction fee.
1. User approves 100 USDT.
2. Canister calls `transfer_from(100)`.
3. Ledger deducts 100 from User.
4. Ledger deducts `Fee` (e.g., 0.00001) from Canister's balance.
5. Canister receives 100.
6. **Net Canister Balance Change:** `+100 (received) - Fee (paid) = 100 - Fee`.
7. **User Internal Credit:** `+100`.
8. **Accounting Imbalance:** `Liabilities (100) > Assets (100 - Fee)`.

Every deposit creates a deficit equal to the transaction fee. Over time, `audit_balances()` will permanently fail as `pool_reserve + deposits > canister_balance`.

### Remediation
The canister must deduct the fee from the amount credited to the user.

```rust
// Fix for accounting.rs
let fee = CKUSDT_TRANSFER_FEE;
// Ensure amount covers fee to prevent underflow (though checks usually catch this)
if amount <= fee {
    return Err("Deposit too small to cover fees".to_string());
}
let amount_received = amount - fee; 

// Update balance with amount_received (NOT amount)
let new_balance = USER_BALANCES_STABLE.with(|balances| { ... });
```

*Note: This applies to both `accounting.rs` and `liquidity_pool.rs`.*

## 2. Medium: Hardcoded Fee Configuration Risk

### The Vulnerability
The fee is hardcoded as `2` (0.000002 USDT) in multiple files:
- `accounting.rs`: `const CKUSDT_TRANSFER_FEE: u64 = 2;`
- `liquidity_pool.rs`: `const TRANSFER_FEE: u64 = 2;`

If the ckUSDT Ledger changes its fee (e.g., to 10 or 1000), or if the mainnet deployment uses a different fee:
1. **Deposits:** The canister will attempt to pay `2`. If the ledger requires `10`, the `transfer_from` call will fail (`BadFee`). Deposits will break.
2. **Withdrawals:** The canister will try to burn `2`. If ledger requires `10`, withdrawals will fail.

### Remediation
1. **Centralize Constants:** Define the fee in one place (e.g., `types.rs` or a config module).
2. **Dynamic Fee Fetching:** Ideally, fetch the fee from the Ledger using `icrc1_fee` on initialization or periodically, rather than hardcoding it.

## 3. Low: Terminology Confusion (e8s vs e6s)

### The Observation
The codebase continues to refer to "e8s" (ICP 8 decimals) in comments and error messages, while ckUSDT typically uses 6 decimals ("e6s").

- `liquidity_pool.rs`: `format!("Minimum deposit is {} e8s", MIN_DEPOSIT)`
- `accounting.rs`: `icrc1_transfer` logic.

While mathematically the code works (as long as `u64` values are consistent), this terminology is misleading for future developers and audits. `10_000_000` is `10.0` in e6 (USDT), but `0.1` in e8 (ICP).

### Remediation
Global search and replace "e8s" with "decimals" or "smallest units" or specifically "USDT" where appropriate to avoid confusion.

## 4. Verification of Previous Fixes

- **Double Spend (Rollback):** `accounting.rs` correctly uses `UncertainError` handling.
- **Fee Orphaning:** `liquidity_pool.rs` correctly uses `credit_parent_fee` to internalize protocol fees.
- **Serialization DoS:** `types.rs` bounds increased to 2048.

## Conclusion
The migration is mostly sound, but the **Deposit Fee Insolvency Leak** is a critical regression that must be fixed before deployment. The canister is currently subsidizing all deposit fees at the cost of its own solvency.
