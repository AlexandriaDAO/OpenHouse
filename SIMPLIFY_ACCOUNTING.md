# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-accounting-simplify"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-accounting-simplify`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build dice backend
   cargo build --target wasm32-unknown-unknown --release

   # Deploy to mainnet
   ./deploy.sh --dice-only
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend

   # Test the new max payout limit
   dfx canister --network ic call dice_backend get_max_allowed_payout
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor: simplify accounting to 10% max payout with hourly refresh"
   git push -u origin refactor/accounting-simplification
   gh pr create --title "Refactor: Simplify Accounting System to 10% House Limit" --body "Implements SIMPLIFY_ACCOUNTING.md

**Key Changes:**
- Replaced complex cache staleness checking with simple 10% max payout rule
- Changed refresh from 30s to hourly (100x cycle cost reduction)
- Removed MAX_WIN constant and calculate_max_bet() function
- Simplified from 772 lines to ~550 lines total

**Cost Savings:**
- Before: ~$33/month in refresh cycles
- After: ~$0.27/month (99% reduction)

**Security Model:**
- No bet can win more than 10% of house balance
- Self-limiting if exploited (max loss = current house balance)

Deployed to mainnet:
- Dice backend: whchi-hyaaa-aaaao-a4ruq-cai"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
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

**Branch:** `refactor/accounting-simplification`
**Worktree:** `/home/theseus/alexandria/openhouse-accounting-simplify`

---

# Implementation Plan: Simplify Accounting with 10% House Limit

## Task Classification
**REFACTORING**: Simplify existing code → remove complexity, add simple percentage limit

## Current State Documentation

### Files to Modify
```
dice_backend/
├── src/
│   ├── accounting.rs (369 lines → target ~200 lines)
│   ├── game.rs (284 lines → target ~250 lines)
│   └── heartbeat_impl.rs (119 lines → modify refresh interval)
```

### Current Complexity to Remove
1. **accounting.rs lines 98-105**: `LAST_BALANCE_REFRESH` and `get_last_refresh()`
2. **accounting.rs lines 92-97**: Timestamp tracking in refresh function
3. **game.rs lines 89-96**: Cache staleness checking
4. **game.rs lines 67-75**: `calculate_max_bet()` function
5. **game.rs line 31**: MAX_WIN constant (10 ICP hard limit)

### Current Cost Structure
- Refresh interval: 30 seconds
- Cycles per refresh: ~590M
- Monthly cost: ~$33

### Target Cost Structure
- Refresh interval: 3600 seconds (1 hour)
- Cycles per refresh: ~590M (same)
- Monthly cost: ~$0.27 (99% reduction)

## Implementation Steps

### Step 1: Simplify `dice_backend/src/accounting.rs`

```rust
// PSEUDOCODE - Changes to accounting.rs

// =============================================================================
// REMOVE these items completely:
// =============================================================================
// DELETE lines 55-56: LAST_BALANCE_REFRESH state variable
// DELETE lines 98-105: get_last_refresh() function

// =============================================================================
// ADD new constant after line 10:
// =============================================================================
const MAX_PAYOUT_PERCENTAGE: f64 = 0.10;  // 10% of house balance

// =============================================================================
// SIMPLIFY refresh_canister_balance() - lines 83-106
// =============================================================================
pub async fn refresh_canister_balance() -> u64 {
    let account = Account {
        owner: ic_cdk::id(),
        subaccount: None,
    };

    let ledger = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let result: Result<(Nat,), _> = ic_cdk::call(ledger, "icrc1_balance_of", (account,)).await;

    match result {
        Ok((balance,)) => {
            let balance_u64 = balance.0.try_into().unwrap_or(0);
            CACHED_CANISTER_BALANCE.with(|cache| {
                *cache.borrow_mut() = balance_u64;
            });
            // REMOVE: LAST_BALANCE_REFRESH update
            // Just return the balance
            balance_u64
        }
        Err(_) => {
            // On error, return cached value
            CACHED_CANISTER_BALANCE.with(|cache| *cache.borrow())
        }
    }
}

// =============================================================================
// ADD new function after get_house_balance() around line 310:
// =============================================================================
#[query]
pub fn get_max_allowed_payout() -> u64 {
    let house_balance = get_house_balance();
    if house_balance == 0 {
        return 0;
    }
    (house_balance as f64 * MAX_PAYOUT_PERCENTAGE) as u64
}

// =============================================================================
// OPTIONAL: Remove these convenience functions to further simplify:
// =============================================================================
// Consider removing withdraw_all() - line 268-285
// Consider removing get_my_balance() - line 299-301
// Consider reducing MIN_DEPOSIT and MIN_WITHDRAW constants
```

### Step 2: Simplify `dice_backend/src/game.rs`

```rust
// PSEUDOCODE - Changes to game.rs

// =============================================================================
// REMOVE completely:
// =============================================================================
// DELETE line 31: const MAX_WIN: u64 = 1_000_000_000;
// DELETE lines 67-75: calculate_max_bet() function
// DELETE lines 89-96: Cache staleness checking

// =============================================================================
// SIMPLIFY validate_and_place_bet() - replace lines 110-151
// =============================================================================
pub async fn validate_and_place_bet(
    player: Principal,
    bet_amount: u64,
    target_number: u8,
    direction: RollDirection,
) -> Result<(), String> {
    // Basic validation
    if bet_amount == 0 {
        return Err("Bet amount must be positive".to_string());
    }

    // Check user balance
    let user_balance = accounting::get_balance(player);
    if user_balance < bet_amount {
        return Err(format!(
            "Insufficient balance. You have {} ICP, trying to bet {} ICP",
            user_balance as f64 / 100_000_000.0,
            bet_amount as f64 / 100_000_000.0
        ));
    }

    // Calculate potential payout
    let (winning_chance, multiplier) = calculate_payout_info(target_number, direction)?;
    let max_payout = (bet_amount as f64 * multiplier) as u64;

    // NEW SIMPLIFIED CHECK - just one comparison!
    let max_allowed = accounting::get_max_allowed_payout();
    if max_payout > max_allowed {
        return Err(format!(
            "Max payout of {} ICP exceeds house limit of {} ICP (10% of house balance)",
            max_payout as f64 / 100_000_000.0,
            max_allowed as f64 / 100_000_000.0
        ));
    }

    // Debit user's balance for the bet
    accounting::update_balance(player, false, bet_amount)?;

    Ok(())
}

// =============================================================================
// REMOVE from play_dice() function around lines 180-200:
// =============================================================================
// Remove any references to MAX_WIN
// Remove any references to calculate_max_bet()
// The validation is now just the simple check above
```

### Step 3: Update `dice_backend/src/heartbeat_impl.rs`

```rust
// PSEUDOCODE - Changes to heartbeat_impl.rs

// =============================================================================
// CHANGE line 61 - Update refresh interval from 30s to 1 hour
// =============================================================================
// OLD: if now - last_refresh > 30_000_000_000
// NEW:
if now - last_refresh > 3_600_000_000_000 {  // 1 hour in nanoseconds
    ic_cdk::spawn(async {
        accounting::refresh_canister_balance().await;
    });
    *last_refresh = now;
}

// That's it for heartbeat - just change the interval
```

### Step 4: Update Candid Interface

```candid
// PSEUDOCODE - Add to dice_backend.did

service : {
    // ... existing methods ...

    // ADD new query method:
    get_max_allowed_payout : () -> (nat64) query;
}
```

### Step 5: Create Template Documentation

Create `dice_backend/ACCOUNTING_TEMPLATE.md`:
```markdown
# Simplified Accounting Module

This accounting system uses a simple 10% house limit instead of complex caching.

## How It Works
1. Heartbeat refreshes canister balance every hour (not 30 seconds)
2. Any bet's max payout cannot exceed 10% of house balance
3. This prevents both variance drain and exploit damage

## To Adopt in Other Games
1. Copy `accounting.rs` to your game
2. In your game logic: `if payout > accounting::get_max_allowed_payout() { reject }`
3. Adjust `MAX_PAYOUT_PERCENTAGE` if needed (10% is conservative)

## Cycle Costs
- Hourly refresh: ~$0.27/month
- Previous 30s refresh: ~$33/month
- Savings: 99%
```

## Expected Results

### Metrics
- **Code Reduction**: ~220 lines removed across 3 files
- **Complexity**: Eliminated all cache staleness logic
- **Validation**: Single percentage check replaces multi-layer validation
- **Cycles**: $33/month → $0.27/month (99% reduction)
- **Security**: Self-limiting at current house balance

### Final File Sizes
- `accounting.rs`: ~200 lines (from 369)
- `game.rs`: ~250 lines (from 284)
- `heartbeat_impl.rs`: 119 lines (just interval change)
- **Total**: ~550 lines (from 772)

## Testing Commands

```bash
# After deployment, test the new system:

# 1. Check current max allowed payout
dfx canister --network ic call dice_backend get_max_allowed_payout

# 2. Check house balance
dfx canister --network ic call dice_backend get_house_balance

# 3. Verify 10% relationship (max_payout should be ~10% of house_balance)

# 4. Try a bet that exceeds the limit (should fail)
# If house has 100 ICP, max payout is 10 ICP
# So betting 1 ICP at 15x multiplier should fail:
dfx canister --network ic call dice_backend play_dice '(100000000, 93, variant { Over })'
# (93 Over = ~15x multiplier, 1 ICP * 15 = 15 ICP payout > 10 ICP limit)

# 5. Try a bet within the limit (should succeed if you have balance)
dfx canister --network ic call dice_backend play_dice '(100000000, 50, variant { Over })'
# (50 Over = ~2x multiplier, 1 ICP * 2 = 2 ICP payout < 10 ICP limit)
```

## Rollout Safety

This is a SAFE refactoring because:
1. Makes the system MORE conservative (10% limit)
2. Reduces complexity (less chance for bugs)
3. Self-limiting on exploits
4. No breaking API changes (just adds one new query method)
5. Saves significant costs immediately