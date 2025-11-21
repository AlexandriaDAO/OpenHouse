# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-bugfix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-bugfix`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   echo "Test both: max bet calculation and LP deposit"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(dice): fix max bet calculation and LP deposit allowance"
   git push -u origin bugfix/dice-maxbet-lp-deposit
   gh pr create --title "Fix: Dice max bet calculation and LP deposit allowance" --body "Implements BUGFIX_DICE_MAXBET_LP_DEPOSIT.md

Fixes two critical bugs in the dice game:
1. Frontend max bet calculation error (mult is not defined)
2. LP deposit insufficient allowance error

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
- Affected canister: dice_backend (whchi-hyaaa-aaaao-a4ruq-cai)"
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

**Branch:** `bugfix/dice-maxbet-lp-deposit`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-bugfix`

---

# Implementation Plan: Fix Dice Max Bet & LP Deposit Bugs

## 🐛 Problem Statement

Two critical bugs are breaking the dice game on page load:

### Bug 1: Frontend Max Bet Calculation Error
**Error Message:**
```
Failed to get max bet, using default: ReferenceError: mult is not defined
```

**Root Cause:**
In `openhouse_frontend/src/pages/Dice.tsx:108`, the variable `mult` is used outside its scope:
- Line 95: `mult` is defined inside the `if ('Ok' in result)` block
- Line 108: `mult` is used in a different scope (nested try block)
- Result: `mult` is undefined when line 108 executes if the code path doesn't go through line 95

**Impact:**
- Max bet defaults to 10 ICP instead of being calculated correctly
- Users can't place optimal bets based on actual house balance

### Bug 2: LP Deposit Insufficient Allowance
**Error Message:**
```
Transfer failed: InsufficientAllowance { allowance: Nat(100000000) }
```

**Root Cause:**
In `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx:87`, the approval only covers the deposit amount:
- Frontend approves exactly `amountE8s` (e.g., 100,000,000 e8s for 1 ICP)
- Backend's `icrc2_transfer_from` requires approval for `amount + fee`
- ICRC-2 standard: allowance must cover both transfer amount AND the 10,000 e8s fee
- Result: Transfer fails because `100,000,000 < 100,010,000`

**Impact:**
- Users cannot deposit liquidity into the dice game pool
- House cannot fund games, blocking all gameplay

---

## 📋 Current State Documentation

### Affected Files

1. **Frontend - Max Bet Calculation**
   - File: `openhouse_frontend/src/pages/Dice.tsx`
   - Lines: 84-126 (useEffect for odds calculation)
   - Issue: Variable scoping error on line 108

2. **Frontend - LP Deposit**
   - File: `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx`
   - Lines: 62-123 (handleDeposit function)
   - Issue: Insufficient approval amount on line 87

### Dependencies
- ICRC-2 Ledger: ICP mainnet ledger canister
- Dice Backend: `whchi-hyaaa-aaaao-a4ruq-cai`
- Constants: `TRANSFER_FEE = 10,000 e8s` (0.0001 ICP)

---

## 🔧 Implementation Plan

### Fix 1: Frontend Max Bet Calculation (Dice.tsx)

**File:** `openhouse_frontend/src/pages/Dice.tsx`

**Location:** Lines 84-126 (useEffect hook)

**Strategy:** Move `mult` variable to outer scope so it's accessible throughout the try block

**PSEUDOCODE:**
```typescript
// In useEffect starting at line 84
useEffect(() => {
  const updateOdds = async () => {
    if (!actor) return;

    try {
      const directionVariant = direction === 'Over' ? { Over: null } : { Under: null };

      // CHANGE: Declare mult in outer scope with initial value
      let mult = 0;

      // Get payout info (existing)
      const result = await actor.calculate_payout_info(targetNumber, directionVariant);

      if ('Ok' in result) {
        const [chance, multiplier] = result.Ok;  // CHANGE: Use 'multiplier' instead of 'mult'
        mult = multiplier;  // CHANGE: Assign to outer scope variable
        setWinChance(chance * 100);
        setMultiplier(mult);
      } else if ('Err' in result) {
        gameState.setGameError(result.Err);
      }

      // Get max bet based on max allowed payout (10% house limit)
      try {
        const maxPayoutE8s = await actor.get_max_allowed_payout();
        const maxPayoutICP = Number(maxPayoutE8s) / E8S_PER_ICP;

        // CHANGE: Now 'mult' is defined and accessible here
        const maxBetICP = mult > 0 ? maxPayoutICP / mult : 0;
        setMaxBet(maxBetICP);

        // Adjust current bet if it exceeds new max
        if (gameState.betAmount > maxBetICP) {
          gameState.setBetAmount(maxBetICP);
        }
      } catch (maxBetError) {
        console.error('Failed to get max bet, using default:', maxBetError);
        setMaxBet(10);
      }
    } catch (err) {
      console.error('Failed to calculate odds:', err);
    }
  };

  updateOdds();
}, [targetNumber, direction, actor]);
```

**Changes Summary:**
1. Declare `let mult = 0;` before the first try block (outer scope)
2. Change `const [chance, mult]` to `const [chance, multiplier]` to use local name
3. Add `mult = multiplier;` to assign to outer scope variable
4. Now line 108 can safely access `mult`

---

### Fix 2: LP Deposit Allowance (DiceLiquidityPanel.tsx)

**File:** `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx`

**Location:** Lines 62-123 (handleDeposit function)

**Strategy:** Approve `amount + fee` instead of just `amount` to match ICRC-2 requirements

**PSEUDOCODE:**
```typescript
// In handleDeposit function starting at line 62
const handleDeposit = async () => {
  if (!diceActor || !ledgerActor || !principal) return;

  setIsDepositing(true);
  setError(null);
  setSuccess(null);

  try {
    // CHANGE: Define transfer fee constant at top
    const TRANSFER_FEE = 10_000; // 0.0001 ICP (ICRC-2 standard fee)

    const amountE8s = BigInt(Math.floor(parseFloat(depositAmount) * 100_000_000));

    // Validate
    if (amountE8s < BigInt(100_000_000)) {
      setError('Minimum deposit is 1 ICP');
      setIsDepositing(false);
      return;
    }

    // CRITICAL: ICRC-2 Approval Flow
    // Step 1: Approve dice_backend to spend funds
    const diceBackendPrincipal = Principal.fromText('whchi-hyaaa-aaaao-a4ruq-cai');

    // CHANGE: Approve amount + fee (not just amount)
    // The backend's icrc2_transfer_from needs allowance for BOTH amount AND fee
    const approvalAmount = amountE8s + BigInt(TRANSFER_FEE);

    const approveArgs = {
      spender: {
        owner: diceBackendPrincipal,
        subaccount: [],
      },
      amount: approvalAmount,  // CHANGE: Was amountE8s, now amountE8s + fee
      fee: [],
      memo: [],
      from_subaccount: [],
      created_at_time: [],
      expected_allowance: [],
      expires_at: [],
    };

    const approveResult = await ledgerActor.icrc2_approve(approveArgs);

    if ('Err' in approveResult) {
      throw new Error(`Approval failed: ${JSON.stringify(approveResult.Err)}`);
    }

    // Step 2: Call deposit_liquidity (uses transfer_from internally)
    const result = await diceActor.deposit_liquidity(amountE8s);

    if ('Ok' in result) {
      const shares = result.Ok;
      setSuccess(`Deposited ${depositAmount} ICP! Received ${shares.toString()} shares`);
      setDepositAmount('1.0');

      // Refresh stats
      const stats = await diceActor.get_pool_stats();
      setPoolStats(stats);
      const position = await diceActor.get_my_lp_position();
      setMyPosition(position);
    } else {
      setError(result.Err);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Deposit failed');
  } finally {
    setIsDepositing(false);
  }
};
```

**Changes Summary:**
1. Add `const TRANSFER_FEE = 10_000;` constant at top of function
2. Calculate `approvalAmount = amountE8s + BigInt(TRANSFER_FEE)`
3. Change `amount: amountE8s` to `amount: approvalAmount` in approveArgs
4. Add comment explaining ICRC-2 requirement

**Why This Works:**
- Backend calls `icrc2_transfer_from` with `amount` and `fee` separately
- ICRC-2 ledger deducts `amount + fee` from allowance
- Frontend must approve `amount + fee` upfront
- Standard ICRC-2 fee is 10,000 e8s (0.0001 ICP)

---

## 🧪 Testing Plan

### Manual Testing (No Automated Tests Required)

#### Test 1: Max Bet Calculation
1. Deploy frontend changes
2. Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
3. Open browser console (F12)
4. Verify: No "mult is not defined" error appears
5. Verify: Max bet updates correctly when changing target number/direction
6. Try edge cases:
   - Target 1 Over (98% win chance) - Max bet should be low
   - Target 99 Under (98% win chance) - Max bet should be low
   - Target 50 (49.5% win chance) - Max bet should be ~5 ICP

#### Test 2: LP Deposit
1. Log in with a wallet that has ICP
2. Navigate to dice game liquidity panel
3. Enter deposit amount (minimum 1 ICP)
4. Click "Deposit LP"
5. Approve the transaction in wallet
6. Verify: No "InsufficientAllowance" error
7. Verify: Success message shows shares received
8. Verify: Pool stats update correctly
9. Verify: "Your Position" panel shows new shares

#### Test 3: Full Game Flow
1. Ensure house pool has liquidity (from Test 2)
2. Deposit game balance (use accounting panel)
3. Place a bet with varying odds
4. Verify: Max bet enforces correct limits based on multiplier
5. Roll dice and verify game completes successfully

---

## 📊 Deployment Notes

### Affected Canisters
- **dice_backend**: No changes (bug is frontend-only)
- **openhouse_frontend**: Both fixes applied

### Deployment Strategy
```bash
# Only frontend needs redeployment
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

### Rollback Plan
If issues occur:
1. Revert changes to Dice.tsx and DiceLiquidityPanel.tsx
2. Rebuild: `cd openhouse_frontend && npm run build`
3. Redeploy: `./deploy.sh --frontend-only`

---

## ✅ Success Criteria

### Bug 1 Fixed: Max Bet Calculation
- ✅ No JavaScript errors in browser console on page load
- ✅ Max bet displays correct value based on multiplier and house balance
- ✅ Max bet updates dynamically when target/direction changes
- ✅ Bet slider respects calculated max bet limit

### Bug 2 Fixed: LP Deposit
- ✅ Users can successfully deposit 1+ ICP into liquidity pool
- ✅ No "InsufficientAllowance" errors
- ✅ Pool stats update correctly after deposit
- ✅ LP shares are minted and displayed correctly

### Overall System Health
- ✅ Dice game playable end-to-end
- ✅ House can accept bets (pool funded)
- ✅ Max bet enforces solvency (house can cover payouts)
- ✅ No regression in other game functionality

---

## 📝 Implementation Checklist

- [ ] Verify in correct worktree (`/home/theseus/alexandria/openhouse-dice-bugfix`)
- [ ] Apply Fix 1 (Dice.tsx max bet calculation)
- [ ] Apply Fix 2 (DiceLiquidityPanel.tsx approval amount)
- [ ] Build frontend: `cd openhouse_frontend && npm run build`
- [ ] Deploy to mainnet: `./deploy.sh --frontend-only`
- [ ] Test Fix 1: Check browser console for errors
- [ ] Test Fix 2: Attempt LP deposit with real ICP
- [ ] Verify both bugs resolved on live site
- [ ] Create PR with detailed description
- [ ] Monitor for review feedback

---

## 🔍 Root Cause Analysis

### Why Did This Happen?

**Bug 1 (Max Bet):**
- Variable `mult` was declared inside an `if` block with block scope
- JavaScript ES6+ uses lexical scoping for `const/let`
- Developer tried to access `mult` outside its scope in nested try-catch
- TypeScript didn't catch this because error handling made the code path complex

**Bug 2 (LP Deposit):**
- ICRC-2 standard requires allowance to cover `amount + fee`
- Frontend developer only approved the transfer amount
- Backend correctly calls `icrc2_transfer_from` with separate fee parameter
- Ledger deducts `amount + fee` from allowance, causing underflow
- Error message is cryptic: shows allowance (100M) without showing required amount (100.01M)

### Prevention for Future

**For Bug 1:**
- Use linters that catch "variable used before assignment" errors
- Consider using TypeScript strict mode
- Code review should check variable scoping in async functions
- Add unit tests for edge cases in odds calculation

**For Bug 2:**
- Document ICRC-2 approval pattern clearly in CLAUDE.md
- Add approval helper function that always adds fee: `approveWithFee(amount)`
- Backend could return more helpful error: "Insufficient allowance: need X, got Y"
- Add integration test for ICRC-2 approval flow
