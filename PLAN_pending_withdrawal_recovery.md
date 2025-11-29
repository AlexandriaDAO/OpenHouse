# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-pending-recovery"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-pending-recovery`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build backend
   cargo build --target wasm32-unknown-unknown --release

   # Build frontend
   cd openhouse_frontend && npm run build && cd ..

   # Deploy all to mainnet
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend

   # Test the new query
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_my_withdrawal_status '()'

   # Visit frontend
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: add pending withdrawal recovery UI for dice game"
   git push -u origin feature/pending-withdrawal-recovery
   gh pr create --title "Feature: Pending Withdrawal Recovery UI" --body "$(cat <<'EOF'
## Summary
Implements user-facing UI for recovering stuck withdrawals caused by network timeouts (UncertainError).

Addresses Finding #3 from Gemini Audit V4: Users with pending withdrawals now have a self-service recovery path.

## Changes
### Backend
- Expose `get_my_withdrawal_status()` query endpoint
- Update Candid interface

### Frontend
- Add `PendingWithdrawalRecovery` component
- Integrate into DiceAccountingPanel and DiceLiquidity pages
- Check pending status on page load
- Provide "Retry Transfer" and "Confirm Receipt" actions

## Test Plan
- [ ] Deploy to mainnet
- [ ] Verify `get_my_withdrawal_status` returns null for normal users
- [ ] Verify UI shows recovery panel when pending exists (requires simulated stuck state)
- [ ] Verify retry and abandon buttons call correct backend methods

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Dice Backend: whchi-hyaaa-aaaao-a4ruq-cai

Generated with [Claude Code](https://claude.com/claude-code)
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
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- MAINNET DEPLOYMENT: All changes go directly to production
- After sleep: IMMEDIATELY continue (no pause)
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/pending-withdrawal-recovery`
**Worktree:** `/home/theseus/alexandria/openhouse-pending-recovery`

---

# Implementation Plan

## Context

**Problem:** When a withdrawal transfer times out (UncertainError), user funds are locked in a "pending" state. The backend has `retry_withdrawal()` and `abandon_withdrawal()` functions, but:
1. `get_withdrawal_status()` is not exposed as an API endpoint
2. The frontend has no UI to check pending status or trigger recovery

**Impact:** Users with stuck withdrawals have no self-service recovery path.

**Finding:** Gemini Audit V4 Finding #3 (INFO severity)

---

## Current State

### Backend (`dice_backend/src/`)

| File | Line | Status |
|------|------|--------|
| `defi_accounting/accounting.rs` | 603-606 | `get_withdrawal_status()` EXISTS but NOT exposed |
| `lib.rs` | 117-124 | `retry_withdrawal()` and `abandon_withdrawal()` ARE exposed |
| `dice_backend.did` | - | Missing `get_my_withdrawal_status` |

### Frontend (`openhouse_frontend/src/`)

| File | Status |
|------|--------|
| `types/dice-backend.ts` | Has `PendingWithdrawal` type (unused) |
| `components/game-specific/dice/DiceAccountingPanel.tsx` | No pending check |
| `pages/dice/DiceLiquidity.tsx` | No pending check |

---

## Implementation

### Part 1: Backend - Expose Query Endpoint

#### File: `dice_backend/src/lib.rs`

Add after line 124 (after `abandon_withdrawal`):

```rust
// PSEUDOCODE
#[query]
fn get_my_withdrawal_status() -> Option<defi_accounting::types::PendingWithdrawal> {
    defi_accounting::accounting::get_withdrawal_status()
}
```

#### File: `dice_backend/dice_backend.did`

Add to service block:

```candid
// PSEUDOCODE
type WithdrawalType = variant {
  User: record { amount: nat64 };
  LP: record { shares: nat; reserve: nat; amount: nat64 };
};

type PendingWithdrawal = record {
  withdrawal_type: WithdrawalType;
  created_at: nat64;
};

// Add to service:
get_my_withdrawal_status: () -> (opt PendingWithdrawal) query;
```

---

### Part 2: Frontend - Create Recovery Component

#### File: `openhouse_frontend/src/components/game-specific/dice/PendingWithdrawalRecovery.tsx` (NEW)

```typescript
// PSEUDOCODE
import React, { useState, useEffect } from 'react';
import useDiceActor from '../../../hooks/actors/useDiceActor';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '../../../types/balance';

interface PendingWithdrawal {
  withdrawal_type: { User: { amount: bigint } } | { LP: { shares: bigint; reserve: bigint; amount: bigint } };
  created_at: bigint;
}

interface Props {
  onResolved: () => void;  // Callback when pending state is cleared
}

export const PendingWithdrawalRecovery: React.FC<Props> = ({ onResolved }) => {
  const { actor } = useDiceActor();
  const [pending, setPending] = useState<PendingWithdrawal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for pending withdrawal on mount
  useEffect(() => {
    const checkPending = async () => {
      if (!actor) return;
      try {
        const result = await actor.get_my_withdrawal_status();
        setPending(result.length > 0 ? result[0] : null);
      } catch (err) {
        console.error('Failed to check pending status:', err);
      } finally {
        setIsLoading(false);
      }
    };
    checkPending();
  }, [actor]);

  // Handle retry
  const handleRetry = async () => {
    if (!actor) return;
    setIsRetrying(true);
    setError(null);
    try {
      const result = await actor.retry_withdrawal();
      if ('Ok' in result) {
        setSuccess('Transfer successful! Funds sent to your wallet.');
        setPending(null);
        onResolved();
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setIsRetrying(false);
    }
  };

  // Handle abandon
  const handleAbandon = async () => {
    if (!actor) return;
    setIsAbandoning(true);
    setError(null);
    try {
      const result = await actor.abandon_withdrawal();
      if ('Ok' in result) {
        setSuccess('Withdrawal confirmed as received. State cleared.');
        setPending(null);
        onResolved();
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Abandon failed');
    } finally {
      setIsAbandoning(false);
    }
  };

  // Don't render if no pending withdrawal
  if (isLoading || !pending) return null;

  // Extract amount from withdrawal type
  const amount = 'User' in pending.withdrawal_type
    ? pending.withdrawal_type.User.amount
    : pending.withdrawal_type.LP.amount;

  const isLP = 'LP' in pending.withdrawal_type;

  return (
    <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-bold text-yellow-400 mb-1">
            Pending {isLP ? 'Liquidity' : ''} Withdrawal
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            You have a pending withdrawal of <strong>{formatUSDT(amount)}</strong> that
            may have timed out. Please check your wallet balance on-chain.
          </p>

          <div className="bg-black/30 rounded p-3 mb-3 text-xs text-gray-400">
            <p className="mb-2"><strong>Check your ckUSDT balance:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>If funds arrived in your wallet → Click "Confirm Receipt"</li>
              <li>If funds did NOT arrive → Click "Retry Transfer"</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRetry}
              disabled={isRetrying || isAbandoning}
              className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {isRetrying ? 'Retrying...' : '🔄 Retry Transfer'}
            </button>
            <button
              onClick={handleAbandon}
              disabled={isRetrying || isAbandoning}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              {isAbandoning ? 'Confirming...' : '✓ Confirm Receipt'}
            </button>
          </div>

          {error && (
            <div className="mt-2 text-red-400 text-xs">{error}</div>
          )}
          {success && (
            <div className="mt-2 text-green-400 text-xs">{success}</div>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

### Part 3: Frontend - Integrate Component

#### File: `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx`

```typescript
// PSEUDOCODE - Add at top of component render, before balance display

import { PendingWithdrawalRecovery } from './PendingWithdrawalRecovery';

// Inside the component, add before the existing card:
<PendingWithdrawalRecovery onResolved={() => {
  refreshBalance();
  onBalanceChange();
}} />
```

#### File: `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx`

```typescript
// PSEUDOCODE - Add same component import and usage

import { PendingWithdrawalRecovery } from '../../components/game-specific/dice/PendingWithdrawalRecovery';

// Inside the component, add before "MAIN CARD" section:
{isAuthenticated && (
  <PendingWithdrawalRecovery onResolved={async () => {
    const stats = await diceActor?.get_pool_stats();
    if (stats) setPoolStats(stats);
    const position = await diceActor?.get_my_lp_position();
    if (position) setMyPosition(position);
  }} />
)}
```

---

### Part 4: Export Component

#### File: `openhouse_frontend/src/components/game-specific/dice/index.ts`

```typescript
// PSEUDOCODE - Add export
export { PendingWithdrawalRecovery } from './PendingWithdrawalRecovery';
```

---

## Files Changed Summary

| File | Action |
|------|--------|
| `dice_backend/src/lib.rs` | MODIFY - Add query endpoint |
| `dice_backend/dice_backend.did` | MODIFY - Add types and method |
| `openhouse_frontend/src/components/game-specific/dice/PendingWithdrawalRecovery.tsx` | NEW |
| `openhouse_frontend/src/components/game-specific/dice/index.ts` | MODIFY - Add export |
| `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` | MODIFY - Add component |
| `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx` | MODIFY - Add component |

---

## Deployment Notes

**Affected Canisters:**
- `dice_backend` (whchi-hyaaa-aaaao-a4ruq-cai) - New query endpoint
- `openhouse_frontend` (pezw3-laaaa-aaaal-qssoa-cai) - New UI component

**Deployment Order:**
1. Backend first (exposes new API)
2. Frontend second (uses new API)

**Verification:**
```bash
# Test backend API
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_my_withdrawal_status '()'
# Should return: (null) for users without pending withdrawals
```
