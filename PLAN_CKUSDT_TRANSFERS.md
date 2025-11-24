# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-ckusdt-transfers"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-ckusdt-transfers`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Full build and deploy
   cargo build --target wasm32-unknown-unknown --release
   cd openhouse_frontend && npm run build && cd ..
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(transfers): Add ckUSDT wallet transfer functionality

- Implement ckUSDT transfers to external wallets
- Add Redux state management for transfers
- Create transfer UI with loading states
- Add transaction history tracking
- Implement proper error handling"
   git push -u origin feature/ckusdt-transfers
   gh pr create --title "Feature: ckUSDT Wallet Transfers with Alexandria-Quality Implementation" --body "Implements PLAN_CKUSDT_TRANSFERS.md

## Summary
- Added ckUSDT transfer functionality to external wallets
- Redux Toolkit integration for state management
- Transfer thunks with proper error handling
- Transaction history and status tracking
- Loading/success/error UI states

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: dice_backend, openhouse_frontend"
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

**Branch:** `feature/ckusdt-transfers`
**Worktree:** `/home/theseus/alexandria/openhouse-ckusdt-transfers`

---

# Implementation Plan: ckUSDT Wallet Transfers (Alexandria-Quality)

## Current State Analysis

### Existing Infrastructure
- **ckUSDT Integration**: Already using ckUSDT (`cngnf-vqaaa-aaaar-qag4q-cai`) for all betting
- **Actor Hook**: Using `ic-use-actor` library with ckUSDT ledger actor
- **Accounting**: `dice_backend` has deposit/withdraw functions for ckUSDT
- **UI Components**: Basic deposit/withdraw in DiceAccountingPanel
- **Missing**: No external wallet transfers, no Redux, no transfer history

### Technical Stack
- **Frontend**: React 18.3, TypeScript, Vite, Tailwind CSS
- **Actor Management**: ic-use-actor 0.3.1
- **IC SDK**: @dfinity/agent 3.2.7, @dfinity/principal 3.2.7
- **Backend**: Rust with ICRC-2 token standard

## Phase 1: Redux State Management Layer

### 1.1 Install Redux Dependencies
**File**: `openhouse_frontend/package.json` (MODIFY)
```json
// PSEUDOCODE - Add to dependencies
{
  "dependencies": {
    // ... existing dependencies
    "@reduxjs/toolkit": "^2.0.1",
    "react-redux": "^9.1.0"
  },
  "devDependencies": {
    // ... existing devDependencies
    "@types/react-redux": "^7.1.33"
  }
}
```

**Run**: `npm install` after modifying package.json

### 1.2 Redux Store Configuration
**File**: `openhouse_frontend/src/store/index.ts` (NEW)
```typescript
// PSEUDOCODE
import { configureStore } from '@reduxjs/toolkit';
import transferReducer from './slices/transferSlice';
import walletReducer from './slices/walletSlice';

export const store = configureStore({
  reducer: {
    transfer: transferReducer,
    wallet: walletReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore BigInt serialization warnings
        ignoredActions: ['transfer/executeTransfer/fulfilled'],
        ignoredPaths: ['transfer.amount', 'wallet.balance'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 1.3 Redux Hooks
**File**: `openhouse_frontend/src/store/hooks.ts` (NEW)
```typescript
// PSEUDOCODE
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import type { RootState, AppDispatch } from './index';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
```

## Phase 2: Transfer State Management

### 2.1 Transfer Slice
**File**: `openhouse_frontend/src/store/slices/transferSlice.ts` (NEW)
```typescript
// PSEUDOCODE
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { transferCkUSDT } from '../thunks/transferThunks';

export interface TransferState {
  isTransferring: boolean;
  transferSuccess: boolean;
  transferError: string | null;
  lastTransferId: bigint | null;
  recentTransfers: TransferRecord[];
}

export interface TransferRecord {
  id: string;
  recipient: string;
  amount: bigint;
  fee: bigint;
  blockIndex: bigint;
  timestamp: Date;
  status: 'pending' | 'success' | 'failed';
}

const initialState: TransferState = {
  isTransferring: false,
  transferSuccess: false,
  transferError: null,
  lastTransferId: null,
  recentTransfers: [],
};

const transferSlice = createSlice({
  name: 'transfer',
  initialState,
  reducers: {
    resetTransferState: (state) => {
      state.transferSuccess = false;
      state.transferError = null;
      state.isTransferring = false;
    },
    addTransferRecord: (state, action: PayloadAction<TransferRecord>) => {
      state.recentTransfers.unshift(action.payload);
      // Keep only last 20 transfers
      if (state.recentTransfers.length > 20) {
        state.recentTransfers.pop();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(transferCkUSDT.pending, (state) => {
        state.isTransferring = true;
        state.transferError = null;
        state.transferSuccess = false;
      })
      .addCase(transferCkUSDT.fulfilled, (state, action) => {
        state.isTransferring = false;
        state.transferSuccess = true;
        state.lastTransferId = action.payload.blockIndex;
        // Add to recent transfers
        state.recentTransfers.unshift({
          id: action.payload.blockIndex.toString(),
          recipient: action.meta.arg.recipient,
          amount: action.meta.arg.amount,
          fee: BigInt(2), // ckUSDT fee
          blockIndex: action.payload.blockIndex,
          timestamp: new Date(),
          status: 'success',
        });
      })
      .addCase(transferCkUSDT.rejected, (state, action) => {
        state.isTransferring = false;
        state.transferError = action.payload || 'Transfer failed';
        // Add failed transfer to history
        state.recentTransfers.unshift({
          id: `failed-${Date.now()}`,
          recipient: action.meta.arg.recipient,
          amount: action.meta.arg.amount,
          fee: BigInt(2),
          blockIndex: BigInt(0),
          timestamp: new Date(),
          status: 'failed',
        });
      });
  },
});

export const { resetTransferState, addTransferRecord } = transferSlice.actions;
export default transferSlice.reducer;
```

### 2.2 Transfer Thunk (Alexandria Pattern)
**File**: `openhouse_frontend/src/store/thunks/transferThunks.ts` (NEW)
```typescript
// PSEUDOCODE
import { createAsyncThunk } from '@reduxjs/toolkit';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ICPLedgerService, TransferArg, TransferError } from '../../types/ledger';

interface TransferCkUSDTArgs {
  actor: ActorSubclass<ICPLedgerService>;
  amount: bigint;
  recipient: string;
  memo?: Uint8Array;
}

interface TransferResult {
  blockIndex: bigint;
  fee: bigint;
  timestamp: bigint;
}

export const transferCkUSDT = createAsyncThunk<
  TransferResult,
  TransferCkUSDTArgs,
  { rejectValue: string }
>(
  'transfer/executeCkUSDTTransfer',
  async ({ actor, amount, recipient, memo }, { rejectWithValue }) => {
    try {
      // Validate recipient principal
      let recipientPrincipal: Principal;
      try {
        recipientPrincipal = Principal.fromText(recipient);
      } catch {
        return rejectWithValue('Invalid recipient principal ID');
      }

      // Validate amount (minimum 1 USDT)
      if (amount < BigInt(1_000_000)) {
        return rejectWithValue('Minimum transfer is 1 USDT');
      }

      // Build ICRC-1 transfer args
      const transferArgs: TransferArg = {
        to: {
          owner: recipientPrincipal,
          subaccount: [],
        },
        amount: amount,
        fee: [], // Uses default fee
        memo: memo ? [Array.from(memo)] : [],
        from_subaccount: [],
        created_at_time: [],
      };

      // Execute transfer
      const result = await actor.icrc1_transfer(transferArgs);

      if ('Ok' in result) {
        return {
          blockIndex: result.Ok,
          fee: BigInt(2), // ckUSDT fee
          timestamp: BigInt(Date.now() * 1_000_000), // Nanoseconds
        };
      } else {
        // Handle specific error types
        const error = result.Err;
        if ('InsufficientFunds' in error) {
          return rejectWithValue(`Insufficient funds. Balance: ${error.InsufficientFunds.balance}`);
        } else if ('BadFee' in error) {
          return rejectWithValue(`Invalid fee. Expected: ${error.BadFee.expected_fee}`);
        } else if ('TooOld' in error) {
          return rejectWithValue('Transaction too old');
        } else if ('Duplicate' in error) {
          return rejectWithValue(`Duplicate transaction: ${error.Duplicate.duplicate_of}`);
        } else {
          return rejectWithValue('Transfer failed: Unknown error');
        }
      }
    } catch (error) {
      console.error('Transfer error:', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unexpected error occurred during transfer');
    }
  }
);

// Get transfer history from backend
export const fetchTransferHistory = createAsyncThunk<
  TransferRecord[],
  { actor: ActorSubclass<any> },
  { rejectValue: string }
>(
  'transfer/fetchHistory',
  async ({ actor }, { rejectWithValue }) => {
    try {
      const history = await actor.get_transfer_history(20);
      return history.map((record: any) => ({
        id: record.block_index.toString(),
        recipient: record.to.toString(),
        amount: record.amount,
        fee: record.fee,
        blockIndex: record.block_index,
        timestamp: new Date(Number(record.timestamp) / 1_000_000),
        status: 'success' as const,
      }));
    } catch (error) {
      console.error('Failed to fetch transfer history:', error);
      return rejectWithValue('Failed to load transfer history');
    }
  }
);
```

## Phase 3: Backend Transfer Support

### 3.1 Enhanced Transfer Functions
**File**: `dice_backend/src/defi_accounting/accounting.rs` (MODIFY)
```rust
// PSEUDOCODE - Add to existing file

use crate::types::{TransferArg, TransferError};

// Add transfer to external wallet (not just withdraw_all)
#[update]
pub async fn transfer_to_wallet(amount: u64, recipient: Principal) -> Result<u64, String> {
    let caller = ic_cdk::api::msg_caller();

    // Validate amount
    if amount < MIN_WITHDRAW {
        return Err(format!("Minimum transfer is {} USDT", MIN_WITHDRAW / 1_000_000));
    }

    // Check balance
    let balance = get_balance_internal(caller);
    if amount > balance {
        return Err("Insufficient balance".to_string());
    }

    // Deduct from user balance
    USER_BALANCES_STABLE.with(|balances| {
        let mut balances = balances.borrow_mut();
        let new_balance = balance - amount;
        balances.insert(caller, new_balance);
    });

    // Execute transfer to recipient
    match execute_ckusdt_transfer(recipient, amount).await {
        Ok(block_index) => {
            log_audit(AuditEvent::TransferToWallet {
                from: caller,
                to: recipient,
                amount
            });
            Ok(block_index)
        }
        Err(e) => {
            // Rollback balance on failure
            USER_BALANCES_STABLE.with(|balances| {
                balances.borrow_mut().insert(caller, balance);
            });
            Err(e)
        }
    }
}

// Helper function for ckUSDT transfers
async fn execute_ckusdt_transfer(recipient: Principal, amount: u64) -> Result<u64, String> {
    let ck_usdt_principal = Principal::from_text(CKUSDT_CANISTER_ID)
        .expect("Invalid ckUSDT canister ID");

    let transfer_args = TransferArg {
        to: Account::from(recipient),
        amount: Nat::from(amount - CKUSDT_TRANSFER_FEE),
        fee: Some(Nat::from(CKUSDT_TRANSFER_FEE)),
        memo: None,
        from_subaccount: None,
        created_at_time: Some(ic_cdk::api::time()),
    };

    let (result,): (Result<Nat, TransferError>,) =
        ic_cdk::api::call::call(ck_usdt_principal, "icrc1_transfer", (transfer_args,))
        .await
        .map_err(|(code, msg)| format!("Transfer call failed: {:?} {}", code, msg))?;

    match result {
        Ok(block_index) => {
            let block = u64::try_from(block_index)
                .map_err(|_| "Block index conversion error")?;
            Ok(block)
        }
        Err(e) => Err(format!("Transfer failed: {:?}", e))
    }
}

// Get transfer history
#[query]
pub fn get_transfer_history(limit: u32) -> Vec<TransferHistoryEntry> {
    let caller = ic_cdk::api::msg_caller();

    AUDIT_LOG.with(|log| {
        log.borrow()
            .iter()
            .filter_map(|entry| {
                match &entry.event {
                    AuditEvent::TransferToWallet { from, to, amount } if from == &caller => {
                        Some(TransferHistoryEntry {
                            timestamp: entry.timestamp,
                            recipient: *to,
                            amount: *amount,
                            block_index: 0, // Would need to store this
                        })
                    }
                    _ => None
                }
            })
            .take(limit as usize)
            .collect()
    })
}
```

### 3.2 Update Types
**File**: `dice_backend/src/types.rs` (MODIFY)
```rust
// PSEUDOCODE - Add to existing file

#[derive(CandidType, Deserialize)]
pub struct TransferHistoryEntry {
    pub timestamp: u64,
    pub recipient: Principal,
    pub amount: u64,
    pub block_index: u64,
}

// Add to AuditEvent enum
pub enum AuditEvent {
    // ... existing variants
    TransferToWallet { from: Principal, to: Principal, amount: u64 },
}
```

## Phase 4: UI Components

### 4.1 Transfer Modal Component
**File**: `openhouse_frontend/src/components/TransferModal.tsx` (NEW)
```typescript
// PSEUDOCODE
import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { transferCkUSDT } from '../store/thunks/transferThunks';
import { resetTransferState } from '../store/slices/transferSlice';
import useLedgerActor from '../hooks/actors/useLedgerActor';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '../types/balance';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameBalance: bigint;
  onTransferComplete: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  gameBalance,
  onTransferComplete,
}) => {
  const dispatch = useAppDispatch();
  const { actor: ledgerActor } = useLedgerActor();
  const { isTransferring, transferSuccess, transferError, lastTransferId } =
    useAppSelector(state => state.transfer);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [principalError, setPrincipalError] = useState('');

  // Validate principal
  const validatePrincipal = (value: string): boolean => {
    try {
      if (!value) {
        setPrincipalError('Recipient principal is required');
        return false;
      }
      Principal.fromText(value);
      setPrincipalError('');
      return true;
    } catch {
      setPrincipalError('Invalid Principal ID format');
      return false;
    }
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!validatePrincipal(recipient)) return;
    if (!ledgerActor) {
      setPrincipalError('Wallet not connected');
      return;
    }

    const amountBigInt = BigInt(Math.floor(parseFloat(amount) * DECIMALS_PER_CKUSDT));

    // Validate amount
    if (amountBigInt < BigInt(1_000_000)) {
      setPrincipalError('Minimum transfer is 1 USDT');
      return;
    }

    if (amountBigInt > gameBalance) {
      setPrincipalError('Insufficient game balance');
      return;
    }

    // Execute transfer via Redux thunk
    dispatch(transferCkUSDT({
      actor: ledgerActor,
      amount: amountBigInt,
      recipient: recipient,
    }));
  };

  // Handle success
  useEffect(() => {
    if (transferSuccess) {
      setTimeout(() => {
        onTransferComplete();
        onClose();
        dispatch(resetTransferState());
      }, 2000);
    }
  }, [transferSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Transfer ckUSDT</h2>

        {/* Success State */}
        {transferSuccess && (
          <div className="bg-green-100 text-green-800 p-4 rounded mb-4">
            ✅ Transfer successful!
            <div className="text-sm mt-2">
              Block: {lastTransferId?.toString()}
            </div>
          </div>
        )}

        {/* Error State */}
        {(transferError || principalError) && (
          <div className="bg-red-100 text-red-800 p-4 rounded mb-4">
            ❌ {transferError || principalError}
          </div>
        )}

        {/* Form */}
        {!transferSuccess && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Recipient Principal ID
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  validatePrincipal(e.target.value);
                }}
                className="w-full p-2 border rounded"
                placeholder="xxxxx-xxxxx-xxxxx..."
                disabled={isTransferring}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="0.00"
                min="1"
                step="0.01"
                disabled={isTransferring}
              />
              <div className="text-sm text-gray-500 mt-1">
                Available: {formatUSDT(gameBalance)} USDT
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              Transfer fee: 0.000002 USDT
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTransfer}
                disabled={isTransferring || !recipient || !amount}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isTransferring ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Transferring...
                  </span>
                ) : (
                  'Transfer'
                )}
              </button>

              <button
                onClick={() => {
                  onClose();
                  dispatch(resetTransferState());
                }}
                disabled={isTransferring}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

### 4.2 Transfer History Component
**File**: `openhouse_frontend/src/components/TransferHistory.tsx` (NEW)
```typescript
// PSEUDOCODE
import React from 'react';
import { useAppSelector } from '../store/hooks';
import { formatUSDT } from '../types/balance';

export const TransferHistory: React.FC = () => {
  const { recentTransfers } = useAppSelector(state => state.transfer);

  if (recentTransfers.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No recent transfers
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold mb-3">Recent Transfers</h3>
      {recentTransfers.map((transfer) => (
        <div
          key={transfer.id}
          className={`p-3 rounded border ${
            transfer.status === 'success'
              ? 'border-green-200 bg-green-50'
              : transfer.status === 'failed'
              ? 'border-red-200 bg-red-50'
              : 'border-yellow-200 bg-yellow-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium">
                {formatUSDT(transfer.amount)} USDT
              </div>
              <div className="text-sm text-gray-600 truncate">
                To: {transfer.recipient.slice(0, 8)}...{transfer.recipient.slice(-5)}
              </div>
              <div className="text-xs text-gray-500">
                {transfer.timestamp.toLocaleString()}
              </div>
            </div>
            <div className="text-sm">
              {transfer.status === 'success' && (
                <span className="text-green-600">✓</span>
              )}
              {transfer.status === 'failed' && (
                <span className="text-red-600">✗</span>
              )}
              {transfer.status === 'pending' && (
                <span className="text-yellow-600">⏳</span>
              )}
            </div>
          </div>
          {transfer.blockIndex > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Block: {transfer.blockIndex.toString()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
```

### 4.3 Update DiceAccountingPanel
**File**: `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Add to existing component

import { TransferModal } from '../../TransferModal';
import { TransferHistory } from '../../TransferHistory';
import { useAppSelector } from '../../../store/hooks';

export const DiceAccountingPanel: React.FC<DiceAccountingPanelProps> = ({...}) => {
  // Existing code...

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Add Redux state
  const transferState = useAppSelector(state => state.transfer);

  return (
    <div className="dice-accounting-panel">
      {/* Existing deposit/withdraw UI */}

      {/* Add transfer button */}
      <button
        onClick={() => setShowTransferModal(true)}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 mt-3"
      >
        💸 Send to Wallet
      </button>

      {/* Add history toggle */}
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full border border-gray-300 py-2 px-4 rounded hover:bg-gray-50 mt-2"
      >
        📜 {showHistory ? 'Hide' : 'Show'} Transfer History
      </button>

      {/* Show transfer history */}
      {showHistory && (
        <div className="mt-4">
          <TransferHistory />
        </div>
      )}

      {/* Transfer Modal */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        gameBalance={gameBalance}
        onTransferComplete={() => {
          onBalanceChange();
          setShowTransferModal(false);
        }}
      />
    </div>
  );
};
```

### 4.4 App Provider Setup
**File**: `openhouse_frontend/src/main.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Wrap app with Redux provider

import { Provider } from 'react-redux';
import { store } from './store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <AuthProvider>
        <BalanceProvider>
          <GameBalanceProvider>
            <App />
          </GameBalanceProvider>
        </BalanceProvider>
      </AuthProvider>
    </Provider>
  </React.StrictMode>
);
```

## Phase 5: Type Definitions

### 5.1 Update Ledger Types
**File**: `openhouse_frontend/src/types/ledger.ts` (MODIFY)
```typescript
// PSEUDOCODE - Add transfer types

export interface TransferArg {
  to: Account;
  amount: bigint;
  fee: [] | [bigint];
  memo: [] | [Uint8Array];
  from_subaccount: [] | [Uint8Array];
  created_at_time: [] | [bigint];
}

export type TransferError =
  | { BadFee: { expected_fee: bigint } }
  | { InsufficientFunds: { balance: bigint } }
  | { TooOld: null }
  | { CreatedInFuture: { ledger_time: bigint } }
  | { Duplicate: { duplicate_of: bigint } }
  | { TemporarilyUnavailable: null }
  | { GenericError: { error_code: bigint; message: string } };

export interface ICPLedgerService {
  // Existing methods...
  icrc1_transfer: (args: TransferArg) => Promise<{ Ok: bigint } | { Err: TransferError }>;
  icrc1_balance_of: (account: Account) => Promise<bigint>;
}
```

### 5.2 Update Candid Interface
**File**: `dice_backend.did` (MODIFY)
```candid
// PSEUDOCODE - Add to service interface

type TransferHistoryEntry = record {
  timestamp: nat64;
  recipient: principal;
  amount: nat64;
  block_index: nat64;
};

service : {
  // Existing methods...

  // New transfer methods
  transfer_to_wallet: (nat64, principal) -> (variant { Ok: nat64; Err: text });
  get_transfer_history: (nat32) -> (vec TransferHistoryEntry) query;
};
```

## Testing Checklist

### Backend Tests
```bash
# Test transfer endpoint
dfx canister --network ic call dice_backend transfer_to_wallet '(1000000, principal "xxxxx-xxxxx")'

# Test history retrieval
dfx canister --network ic call dice_backend get_transfer_history '(10)'
```

### Frontend Tests
1. ✅ Redux store initializes correctly
2. ✅ Transfer modal validates principal IDs
3. ✅ Transfer thunk executes properly
4. ✅ Success/error states display correctly
5. ✅ Transfer history updates after transfers
6. ✅ Loading states show during transfers
7. ✅ Balance updates after successful transfer

## Security Considerations

1. **Principal Validation**: Always validate recipient principals before transfers
2. **Amount Validation**: Enforce minimum transfer amounts (1 USDT)
3. **Balance Checks**: Verify sufficient balance before deducting
4. **Atomic Operations**: Use proper rollback on transfer failures
5. **Audit Trail**: Log all transfers with timestamps and principals
6. **Rate Limiting**: Consider adding daily transfer limits in future

## Performance Optimizations

1. **Memoized Selectors**: Use Redux Toolkit's createSelector for expensive computations
2. **Lazy Loading**: Load transfer history only when requested
3. **Pagination**: Limit transfer history to recent 20 entries
4. **Debouncing**: Debounce principal validation on input
5. **Caching**: Cache successful transfers in Redux store

## Deployment Notes

### NPM Install & Build
```bash
cd openhouse_frontend
npm install
npm run build
cd ..
```

### Deploy to Mainnet
```bash
cargo build --target wasm32-unknown-unknown --release
./deploy.sh
```

### Affected Canisters
- **dice_backend**: Transfer functions and history
- **openhouse_frontend**: Complete UI overhaul with Redux

---

**Implementation Note**: This plan provides Alexandria-quality implementation with proper state management, error handling, and UI/UX patterns. The Redux integration ensures scalable state management while the thunk pattern provides clean async operations.