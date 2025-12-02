# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-clippy"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-clippy`
2. **Implement fixes** - Follow plan sections below
3. **Build & Verify**:
   ```bash
   cargo clippy -p dice_backend --target wasm32-unknown-unknown 2>&1
   # Should show 0 errors, 0 warnings
   cargo build -p dice_backend --target wasm32-unknown-unknown --release
   ```
4. **Deploy to Mainnet**:
   ```bash
   ./deploy.sh --dice-only
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(dice): resolve all clippy warnings and errors"
   git push -u origin feature/dice-clippy-cleanup
   gh pr create --title "[Dice]: Clippy cleanup - 2 errors, 37 warnings fixed" --body "$(cat <<'EOF'
## Summary
- Fixed 2 clippy errors (absurd_extreme_comparisons)
- Fixed 37 clippy warnings across 6 files
- Zero functional changes - code style only

## Changes by Category

### Errors Fixed (2)
- `game.rs:83,194` - Changed `target_number <= 0` to `== 0` for u8 type

### Warnings Fixed (37)
- `clone_on_copy` - Replaced `.clone()` with dereference for Copy types
- `missing_const_for_thread_local` - Added `const { }` wrappers
- `needless_borrows_for_generic_args` - Removed unnecessary borrows
- `cmp_owned` - Direct comparisons instead of Nat::from()
- `manual_saturating_arithmetic` - Use saturating_mul()
- `manual_range_contains` - Use Range::contains()
- `collapsible_else_if` - Combined else-if blocks
- `redundant_closure` - Removed unnecessary closures
- `unnecessary_mut_passed` - Removed mut for immutable refs

## Test plan
- [x] `cargo clippy` shows 0 errors, 0 warnings
- [x] `cargo build --release` succeeds
- [ ] Deploy to mainnet and verify dice game works

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Dice Backend: whchi-hyaaa-aaaao-a4ruq-cai

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ⚠️ MAINNET DEPLOYMENT: All changes go directly to production
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/dice-clippy-cleanup`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-clippy`

---

# Implementation Plan

## Task Classification
**REFACTORING**: Improve existing code → subtractive + targeted fixes

## Current State

### Clippy Analysis Summary
- **2 Errors** (build-blocking)
- **37 Warnings** (code quality)

### Affected Files
| File | Errors | Warnings |
|------|--------|----------|
| `dice_backend/src/game.rs` | 2 | 1 |
| `dice_backend/src/defi_accounting/accounting.rs` | 0 | 8 |
| `dice_backend/src/defi_accounting/admin_query.rs` | 0 | 1 |
| `dice_backend/src/defi_accounting/liquidity_pool.rs` | 0 | 12 |
| `dice_backend/src/defi_accounting/query.rs` | 0 | 4 |
| `dice_backend/src/lib.rs` | 0 | 3 |
| `dice_backend/src/seed.rs` | 0 | 8 |

---

## Fix 1: game.rs - ERRORS (2) + WARNING (1)

### Error 1: Line 83 - absurd_extreme_comparisons
```rust
// BEFORE (line 83)
if target_number <= 0 {

// AFTER
if target_number == 0 {
```
**Reason:** `target_number` is `u8`, which cannot be less than 0.

### Error 2: Line 194 - absurd_extreme_comparisons
```rust
// BEFORE (line 194)
if target_number <= 0 || target_number > MAX_NUMBER {

// AFTER
if target_number == 0 || target_number > MAX_NUMBER {
```

### Warning: Line 189 - manual_range_contains
```rust
// BEFORE (line 189)
if target_number >= MAX_NUMBER || target_number < 1 {

// AFTER
if !(1..MAX_NUMBER).contains(&target_number) {
```

---

## Fix 2: accounting.rs - WARNINGS (8)

### Lines 59-60: missing_const_for_thread_local
```rust
// BEFORE
static CACHED_CANISTER_BALANCE: RefCell<u64> = RefCell::new(0);
static PARENT_TIMER: RefCell<Option<ic_cdk_timers::TimerId>> = RefCell::new(None);

// AFTER
static CACHED_CANISTER_BALANCE: RefCell<u64> = const { RefCell::new(0) };
static PARENT_TIMER: RefCell<Option<ic_cdk_timers::TimerId>> = const { RefCell::new(None) };
```

### Lines 105, 117: clone_on_copy
```rust
// BEFORE (line 105)
.map(|entry| entry.key().clone())

// AFTER
.map(|entry| *entry.key())

// BEFORE (line 117)
.map(|entry| entry.value().clone())

// AFTER
.map(|entry| entry.value())
```
Note: For `.value()` on u64, just remove `.clone()` since the method already returns by value.

### Lines 665, 684, 685, 720: clone_on_copy
```rust
// Line 665: user: user.clone() → user: *user
// Line 684: entry.key().clone() → *entry.key()
// Line 685: entry.value().clone() → entry.value() (remove clone)
// Line 720: user.clone() → *user
```

---

## Fix 3: admin_query.rs - WARNING (1)

### Line 59-61: manual_saturating_arithmetic
```rust
// BEFORE
let heap_memory_bytes = (core::arch::wasm32::memory_size(0) as u64)
    .checked_mul(WASM_PAGE_SIZE_BYTES)
    .unwrap_or(u64::MAX);

// AFTER
let heap_memory_bytes = (core::arch::wasm32::memory_size(0) as u64)
    .saturating_mul(WASM_PAGE_SIZE_BYTES);
```

---

## Fix 4: liquidity_pool.rs - WARNINGS (12)

### Lines 132, 144, 156, 165, 199, 210: cmp_owned
```rust
// BEFORE
if total_shares == Nat::from(0u64) {

// AFTER
if total_shares == 0u64 {
```
Apply same pattern to all 6 occurrences.

### Lines 147, 168, 202, 213: redundant_closure
```rust
// BEFORE
.ok_or_else(|| "Arithmetic overflow in share calculation".to_string())?

// AFTER
.ok_or("Arithmetic overflow in share calculation")?
```

### Lines 321, 362: collapsible_else_if
```rust
// BEFORE
} else {
    if condition {
        ...
    }
}

// AFTER
} else if condition {
    ...
}
```

---

## Fix 5: query.rs - WARNINGS (4)

### Lines 24, 25, 26, 27: missing_const_for_thread_local
```rust
// Add const { } wrapper to all thread_local initializers
static LAST_GAME_SEEN: RefCell<u64> = const { RefCell::new(0) };
// etc for all 4 declarations
```

---

## Fix 6: lib.rs - WARNINGS (3)

### Lines 44, 45, 46: missing_const_for_thread_local
```rust
// Add const { } wrapper to all thread_local initializers
```

---

## Fix 7: seed.rs - WARNINGS (8)

### Lines 24, 25: missing_const_for_thread_local
```rust
// Add const { } wrapper
static SEED_INIT_LOCK: RefCell<bool> = const { RefCell::new(false) };
```

### Lines 145, 158, 250, 265, 283: needless_borrows_for_generic_args
```rust
// BEFORE
seed_hasher.update(&seed_state.current_seed);

// AFTER
seed_hasher.update(seed_state.current_seed);
```
Remove `&` from all hasher.update() calls where the argument is already an owned value.

### Line 206: clone_on_copy
```rust
// BEFORE
cell.borrow().get().clone()

// AFTER
*cell.borrow().get()
```

---

## Verification

After all fixes, run:
```bash
cargo clippy -p dice_backend --target wasm32-unknown-unknown -- -D warnings 2>&1
```

Expected output: No errors, no warnings.

---

## Deployment Notes

- **Affected Canister**: dice_backend (`whchi-hyaaa-aaaao-a4ruq-cai`)
- **No functional changes**: All fixes are purely stylistic
- **Deploy command**: `./deploy.sh --dice-only`
