# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-audit-accounting-fixes"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-audit-accounting-fixes`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ./deploy.sh --dice-only
   ```
4. **Verify deployment**:
   ```bash
   dfx canister --network ic status dice_backend
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(dice): Address audit vulnerabilities 2.1 and 2.2

   - Make PendingWithdrawal and AuditEntry serialization unbounded
   - Replace StableVec audit log with StableBTreeMap for proper pruning
   - Implement 1,000 entry limit with automatic oldest-entry removal
   - Add StableCell counter for sequential audit log keys"
   git push -u origin feature/audit-accounting-fixes
   gh pr create --title "fix(dice): Address audit vulnerabilities 2.1 and 2.2" --body "$(cat <<'EOF'
## Summary
Fixes two audit findings in the defi_accounting module:

- **Vuln 2.1 (Serialization DoS)**: Changed `PendingWithdrawal` and `AuditEntry` from bounded (2048 bytes) to unbounded serialization
- **Vuln 2.2 (Unbounded Audit Log)**: Replaced `StableVec` with `StableBTreeMap<u64, AuditEntry>` + `StableCell<u64>` counter, with automatic pruning at 1,000 entries

## Test plan
- [ ] Deploy with `--mode reinstall` (fresh install, no migration needed)
- [ ] Verify deposit/withdraw operations still work
- [ ] Call `get_audit_log(0, 10)` to verify logging works
- [ ] Verify canister builds without warnings

## Technical Details
- New memory IDs: 22 (AUDIT_LOG_MAP), 23 (AUDIT_LOG_COUNTER)
- Old MemoryId 21 (StableVec) is abandoned
- Pruning removes oldest entries when log exceeds 1,000

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```
6. **Report PR URL and stop**

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- MAINNET DEPLOYMENT: All changes go directly to production
- ONLY stop at: PR created, or error

**Branch:** `feature/audit-accounting-fixes`
**Worktree:** `/home/theseus/alexandria/openhouse-audit-accounting-fixes`

---

# Implementation Plan: Audit Vulnerabilities 2.1 & 2.2

## Task Classification
**REFACTORING**: Improve existing code with targeted fixes

## Affected Canisters
- **Dice Backend**: `whchi-hyaaa-aaaao-a4ruq-cai`

## Current State

### File: `dice_backend/src/defi_accounting/types.rs`

**Lines 63-66** - PendingWithdrawal bounded at 2048 bytes:
```rust
const BOUND: Bound = Bound::Bounded {
    max_size: 2048,
    is_fixed_size: false,
};
```

**Lines 116-119** - AuditEntry bounded at 2048 bytes:
```rust
const BOUND: Bound = Bound::Bounded {
    max_size: 2048,
    is_fixed_size: false,
};
```

### File: `dice_backend/src/defi_accounting/accounting.rs`

**Lines 20** - Memory ID for audit log:
```rust
const AUDIT_LOG_MEMORY_ID: u8 = 21;
```

**Lines 43-47** - StableVec for audit log (unbounded growth):
```rust
static AUDIT_LOG: RefCell<StableVec<AuditEntry, Memory>> = RefCell::new(
    StableVec::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(AUDIT_LOG_MEMORY_ID)))
    )
);
```

**Lines 71-79** - log_audit with no pruning:
```rust
pub(crate) fn log_audit(event: AuditEvent) {
    AUDIT_LOG.with(|log| {
        let entry = AuditEntry {
            timestamp: ic_cdk::api::time(),
            event: event.clone(),
        };
        log.borrow_mut().push(&entry);
    });
}
```

**Lines 553-562** - get_audit_log using StableVec iteration:
```rust
#[query]
pub fn get_audit_log(offset: usize, limit: usize) -> Vec<AuditEntry> {
    AUDIT_LOG.with(|log| {
        let log = log.borrow();
        log.iter()
            .skip(offset)
            .take(limit)
            .collect()
    })
}
```

---

## Implementation

### Change 1: types.rs - Make PendingWithdrawal Unbounded

**Location:** `dice_backend/src/defi_accounting/types.rs` lines 63-66

```rust
// PSEUDOCODE - Replace bounded with unbounded
impl Storable for PendingWithdrawal {
    // ... to_bytes, into_bytes, from_bytes remain unchanged ...

    const BOUND: Bound = Bound::Unbounded;  // Was Bounded { max_size: 2048 }
}
```

### Change 2: types.rs - Make AuditEntry Unbounded

**Location:** `dice_backend/src/defi_accounting/types.rs` lines 116-119

```rust
// PSEUDOCODE - Replace bounded with unbounded
impl Storable for AuditEntry {
    // ... to_bytes, into_bytes, from_bytes remain unchanged ...

    const BOUND: Bound = Bound::Unbounded;  // Was Bounded { max_size: 2048 }
}
```

### Change 3: accounting.rs - Add New Constants and Memory IDs

**Location:** `dice_backend/src/defi_accounting/accounting.rs` after line 20

```rust
// PSEUDOCODE - Add new memory IDs and constants
const AUDIT_LOG_MAP_MEMORY_ID: u8 = 22;      // New: BTreeMap for audit entries
const AUDIT_LOG_COUNTER_MEMORY_ID: u8 = 23;  // New: Counter for sequential keys
const MAX_AUDIT_ENTRIES: u64 = 1000;         // Retention limit
```

### Change 4: accounting.rs - Add StableCell Import

**Location:** `dice_backend/src/defi_accounting/accounting.rs` line 4

```rust
// PSEUDOCODE - Add StableCell to imports
use ic_stable_structures::{StableBTreeMap, StableCell};  // Add StableCell
// Remove: StableVec (no longer used)
```

### Change 5: accounting.rs - Replace AUDIT_LOG with BTreeMap + Counter

**Location:** `dice_backend/src/defi_accounting/accounting.rs` lines 38-47

```rust
// PSEUDOCODE - Replace StableVec with StableBTreeMap + StableCell

// DELETE the old AUDIT_LOG StableVec definition (lines 38-47)
// KEEP the comment about monitoring

// ADD new structures:
static AUDIT_LOG_MAP: RefCell<StableBTreeMap<u64, AuditEntry, Memory>> = RefCell::new(
    StableBTreeMap::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(AUDIT_LOG_MAP_MEMORY_ID)))
    )
);

static AUDIT_LOG_COUNTER: RefCell<StableCell<u64, Memory>> = RefCell::new(
    StableCell::init(
        MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(AUDIT_LOG_COUNTER_MEMORY_ID))),
        0u64  // Initial counter value
    ).expect("Failed to init audit log counter")
);
```

### Change 6: accounting.rs - Rewrite log_audit with Pruning

**Location:** `dice_backend/src/defi_accounting/accounting.rs` lines 71-79

```rust
// PSEUDOCODE - New log_audit with pruning

pub(crate) fn log_audit(event: AuditEvent) {
    // Get next counter value and increment
    let idx = AUDIT_LOG_COUNTER.with(|counter| {
        let mut cell = counter.borrow_mut();
        let current = *cell.get();
        cell.set(current + 1).expect("Failed to increment audit counter");
        current
    });

    // Create and insert entry
    let entry = AuditEntry {
        timestamp: ic_cdk::api::time(),
        event,
    };

    AUDIT_LOG_MAP.with(|log| {
        log.borrow_mut().insert(idx, entry);
    });

    // Prune if over limit
    let len = AUDIT_LOG_MAP.with(|log| log.borrow().len());
    if len > MAX_AUDIT_ENTRIES {
        prune_oldest_audit_entries(len - MAX_AUDIT_ENTRIES);
    }
}

// Helper function for pruning
fn prune_oldest_audit_entries(count: u64) {
    AUDIT_LOG_MAP.with(|log| {
        let mut log = log.borrow_mut();
        // BTreeMap iterates in key order (oldest first since keys are sequential)
        let keys_to_remove: Vec<u64> = log.iter()
            .take(count as usize)
            .map(|(k, _)| k)
            .collect();
        for key in keys_to_remove {
            log.remove(&key);
        }
    });
}
```

### Change 7: accounting.rs - Update get_audit_log Query

**Location:** `dice_backend/src/defi_accounting/accounting.rs` lines 553-562

```rust
// PSEUDOCODE - Update for BTreeMap iteration

#[query]
pub fn get_audit_log(offset: usize, limit: usize) -> Vec<AuditEntry> {
    AUDIT_LOG_MAP.with(|log| {
        let log = log.borrow();
        // BTreeMap iterates in key order (sequential = chronological)
        log.iter()
            .skip(offset)
            .take(limit)
            .map(|(_, entry)| entry)  // Extract just the entry, discard key
            .collect()
    })
}
```

---

## File Summary

| File | Action | Lines Changed |
|------|--------|---------------|
| `dice_backend/src/defi_accounting/types.rs` | MODIFY | ~8 lines (2 bound changes) |
| `dice_backend/src/defi_accounting/accounting.rs` | MODIFY | ~40 lines (imports, constants, log_audit, get_audit_log) |

## Deployment Notes

- **Fresh install required**: Use `dfx deploy dice_backend --mode reinstall`
- **No migration needed**: Old MemoryId 21 data is abandoned
- **New memory IDs**: 22 (BTreeMap), 23 (Counter)
- **Only affects dice_backend canister**

## Verification Checklist

- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] No compiler warnings in defi_accounting module
- [ ] Canister deploys successfully
- [ ] `get_audit_log(0, 10)` returns entries after operations
