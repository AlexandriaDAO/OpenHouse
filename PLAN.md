# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-fix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-fix`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - **Frontend changes**:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh --frontend-only
     ```
     *Note: No backend changes required for these fixes.*

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(dice): fix max bet calculation and LP deposit approval"
   git push -u origin fix/dice-max-bet-and-lp
   gh pr create --title "fix(dice): Max bet calculation and LP deposit approval" --body "Implements fix/dice-max-bet-and-lp plan.

**Fixes:**
1. Fixed `ReferenceError: mult is not defined` in Dice game max bet calculation.
2. Fixed `InsufficientAllowance` error in Dice LP deposit by including transaction fee in ICRC-2 approval.

**Deployed to mainnet:**
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
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

**Branch:** `fix/dice-max-bet-and-lp`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-fix`

---

# Implementation Plan

## 1. Fix `ReferenceError: mult is not defined` in `Dice.tsx`

**Problem**: The variable `mult` is block-scoped within `if ('Ok' in result)` but used outside in the `try/catch` block for max bet calculation.

**File**: `openhouse_frontend/src/pages/Dice.tsx`

```typescript
// PSEUDOCODE - FIX
useEffect(() => {
    const updateOdds = async () => {
      // ...
      
      // DECLARE VARIABLE OUTSIDE
      let currentMultiplier = 0;

      if ('Ok' in result) {
          const [chance, mult] = result.Ok;
          setWinChance(chance * 100);
          setMultiplier(mult);
          currentMultiplier = mult; // CAPTURE VALUE
      } else if ('Err' in result) {
          gameState.setGameError(result.Err);
      }

      // Get max bet
      try {
          const maxPayoutE8s = await actor.get_max_allowed_payout();
          const maxPayoutICP = Number(maxPayoutE8s) / E8S_PER_ICP;

          // USE CAPTURED VARIABLE
          const maxBetICP = currentMultiplier > 0 ? maxPayoutICP / currentMultiplier : 0;
          setMaxBet(maxBetICP);
          // ...
      }
      // ...
    };
    // ...
}, [targetNumber, direction, actor]);
```

## 2. Fix `InsufficientAllowance` in `DiceLiquidityPanel.tsx`

**Problem**: The frontend approves exactly the deposit amount, but the backend transfer requires `amount + fee` (or simply the allowance must cover the debit which includes the fee paid by the user).

**File**: `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx`

```typescript
// PSEUDOCODE - FIX
const handleDeposit = async () => {
    // ...
    const amountE8s = BigInt(Math.floor(parseFloat(depositAmount) * 100_000_000));
    const TRANSFER_FEE = 10_000n; // Standard ICP fee

    // ...

    // CRITICAL: ICRC-2 Approval Flow
    // Approve amount + fee because 'transfer_from' charges the user account
    const approveAmount = amountE8s + TRANSFER_FEE;

    const approveArgs = {
        spender: {
            owner: diceBackendPrincipal,
            subaccount: [],
        },
        amount: approveAmount, // CHANGED FROM amountE8s
        // ...
    };
    
    // ...
};
```

## 3. Deployment Strategy

Since these are purely frontend logic fixes (and one interaction adjustment with backend), we only need to deploy the frontend.

```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

