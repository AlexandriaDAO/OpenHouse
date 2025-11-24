# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-wallet-transfers"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-wallet-transfers`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     ```bash
     # Build affected backend(s)
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     ```
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```
   - Both backend + frontend:
     ```bash
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
   git commit -m "feat(wallet): Add ICP and multi-asset transfer support

- Add wallet transfer functionality for ICP withdrawals
- Add support for ckUSDT and other ICRC-2 tokens
- Create unified transfer management system
- Add multi-token accounting support
- Update frontend with transfer UI components"
   git push -u origin feature/wallet-transfers
   gh pr create --title "Feature: Add Wallet Transfer Support for ICP and Multi-Assets" --body "Implements PLAN_WALLET_TRANSFERS.md

## Summary
- Added comprehensive wallet transfer functionality
- Support for ICP withdrawals to external wallets
- Multi-asset support (ckUSDT, ckBTC ready)
- Unified token management system
- Frontend wallet management UI

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

**Branch:** `feature/wallet-transfers`
**Worktree:** `/home/theseus/alexandria/openhouse-wallet-transfers`

---

# Implementation Plan

## Current State Documentation

### Existing Architecture
- **ICP Handling**: Only dice_backend has deposit/withdraw functionality via `defi_accounting` module
- **Transfer Method**: Uses ICRC-2 `transfer_from` for deposits (approval flow)
- **Withdrawal**: Currently only supports `withdraw_all()` - withdraws entire balance to caller
- **Token Support**: Only ICP currently supported (no multi-token)
- **Other Games**: crash_backend, plinko_backend, mines_backend have no accounting/transfer system
- **Frontend**: DiceAccountingPanel handles deposits with ICRC-2 approval flow

### Key Files to Modify
1. `dice_backend/src/defi_accounting/accounting.rs` - Core accounting logic
2. `dice_backend/src/defi_accounting/types.rs` - Type definitions
3. `dice_backend/src/lib.rs` - API endpoints
4. `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` - UI component
5. NEW: `dice_backend/src/wallet/mod.rs` - Wallet transfer module
6. NEW: `dice_backend/src/wallet/tokens.rs` - Multi-token support

### Canister References
- **ICP Ledger**: `ryjl3-tyaaa-aaaaa-aaaba-cai`
- **ckUSDT**: `cngnf-vqaaa-aaaag-qcqmq-cai`
- **ckBTC**: `mxzaz-hqaaa-aaaar-qaada-cai`

## Implementation Plan

### Phase 1: Core Transfer Infrastructure

#### 1. Create Wallet Transfer Module
**File**: `dice_backend/src/wallet/mod.rs` (NEW)
```rust
// PSEUDOCODE
pub mod tokens;
pub mod transfer;

use candid::{CandidType, Deserialize, Principal};

#[derive(CandidType, Deserialize)]
pub struct TransferRequest {
    pub recipient: Principal,
    pub amount: u64,
    pub token: TokenType,
    pub memo: Option<Vec<u8>>,
}

#[derive(CandidType, Deserialize)]
pub enum TokenType {
    ICP,
    ckUSDT,
    ckBTC,
}

#[derive(CandidType, Deserialize)]
pub struct TransferResult {
    pub block_index: u64,
    pub fee: u64,
    pub final_amount: u64,
}
```

#### 2. Token Configuration Module
**File**: `dice_backend/src/wallet/tokens.rs` (NEW)
```rust
// PSEUDOCODE
use candid::Principal;
use std::collections::HashMap;

pub struct TokenConfig {
    pub canister_id: Principal,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u64,
    pub min_transfer: u64,
}

pub fn get_token_configs() -> HashMap<TokenType, TokenConfig> {
    let mut configs = HashMap::new();

    // ICP
    configs.insert(TokenType::ICP, TokenConfig {
        canister_id: Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai"),
        symbol: "ICP",
        decimals: 8,
        fee: 10_000,
        min_transfer: 10_000_000, // 0.1 ICP
    });

    // ckUSDT
    configs.insert(TokenType::ckUSDT, TokenConfig {
        canister_id: Principal::from_text("cngnf-vqaaa-aaaag-qcqmq-cai"),
        symbol: "ckUSDT",
        decimals: 6,
        fee: 1_000, // 0.001 USDT
        min_transfer: 1_000_000, // 1 USDT
    });

    // ckBTC
    configs.insert(TokenType::ckBTC, TokenConfig {
        canister_id: Principal::from_text("mxzaz-hqaaa-aaaar-qaada-cai"),
        symbol: "ckBTC",
        decimals: 8,
        fee: 10, // 0.0000001 BTC
        min_transfer: 10_000, // 0.0001 BTC
    });

    configs
}
```

### Phase 2: Update Accounting Module

#### 3. Enhanced Accounting with Multi-Token Support
**File**: `dice_backend/src/defi_accounting/accounting.rs` (MODIFY)
```rust
// PSEUDOCODE - Add to existing file

// Add multi-token balance tracking
thread_local! {
    // Token balances: Map<(Principal, TokenType), u64>
    static TOKEN_BALANCES: RefCell<StableBTreeMap<(Principal, TokenType), u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(TOKEN_BALANCES_MEMORY_ID))),
        )
    );
}

// New function for partial withdrawals
#[update]
pub async fn withdraw(amount: u64, recipient: Option<Principal>) -> Result<u64, String> {
    let caller = ic_cdk::api::msg_caller();
    let target = recipient.unwrap_or(caller);

    // Validate amount
    if amount < MIN_WITHDRAW {
        return Err(format!("Minimum withdrawal is {} ICP", MIN_WITHDRAW / 100_000_000));
    }

    // Check balance
    let balance = get_balance_internal(caller);
    if amount > balance {
        return Err("Insufficient balance".to_string());
    }

    // Deduct from balance
    USER_BALANCES_STABLE.with(|balances| {
        let mut balances = balances.borrow_mut();
        let new_balance = balance - amount;
        balances.insert(caller, new_balance);
    });

    // Execute transfer
    let transfer_result = execute_transfer(target, amount, TokenType::ICP).await?;

    Ok(transfer_result.final_amount)
}

// New function for multi-token deposits
#[update]
pub async fn deposit_token(amount: u64, token_type: TokenType) -> Result<u64, String> {
    let caller = ic_cdk::api::msg_caller();
    let token_config = get_token_configs().get(&token_type)
        .ok_or("Unsupported token")?;

    // Validate minimum deposit
    if amount < token_config.min_transfer {
        return Err(format!("Minimum deposit is {}", token_config.min_transfer));
    }

    // Execute ICRC-2 transfer_from
    let transfer_result = execute_token_deposit(caller, amount, token_type).await?;

    // Update token balance
    TOKEN_BALANCES.with(|balances| {
        let key = (caller, token_type);
        let current = balances.borrow().get(&key).unwrap_or(0);
        balances.borrow_mut().insert(key, current + amount);
    });

    Ok(transfer_result)
}

// New function for multi-token withdrawals
#[update]
pub async fn withdraw_token(amount: u64, token_type: TokenType, recipient: Option<Principal>) -> Result<u64, String> {
    let caller = ic_cdk::api::msg_caller();
    let target = recipient.unwrap_or(caller);

    // Get token balance
    let balance = TOKEN_BALANCES.with(|balances| {
        balances.borrow().get(&(caller, token_type.clone())).unwrap_or(0)
    });

    if amount > balance {
        return Err("Insufficient token balance".to_string());
    }

    // Deduct from balance
    TOKEN_BALANCES.with(|balances| {
        let key = (caller, token_type.clone());
        let new_balance = balance - amount;
        balances.borrow_mut().insert(key, new_balance);
    });

    // Execute transfer
    let transfer_result = execute_transfer(target, amount, token_type).await?;

    Ok(transfer_result.final_amount)
}

// Helper to execute transfers for any token
async fn execute_transfer(recipient: Principal, amount: u64, token_type: TokenType) -> Result<TransferResult, String> {
    let token_config = get_token_configs().get(&token_type)
        .ok_or("Unsupported token")?;

    // Build transfer args based on token type
    let transfer_args = build_transfer_args(recipient, amount, token_config);

    // Call appropriate ledger canister
    let result = ic_cdk::api::call::call(
        token_config.canister_id,
        "icrc1_transfer",
        (transfer_args,)
    ).await
    .map_err(|(code, msg)| format!("Transfer failed: {:?} {}", code, msg))?;

    // Parse result and return
    parse_transfer_result(result, token_config.fee)
}
```

### Phase 3: API Endpoints

#### 4. Update lib.rs with New Endpoints
**File**: `dice_backend/src/lib.rs` (MODIFY)
```rust
// PSEUDOCODE - Add to existing file

mod wallet;
use wallet::{TransferRequest, TransferResult, TokenType};

// Existing endpoints remain...

// New endpoints for wallet transfers
#[update]
async fn transfer_to_wallet(request: TransferRequest) -> Result<TransferResult, String> {
    // Validate caller has balance
    let caller = ic_cdk::api::msg_caller();

    match request.token {
        TokenType::ICP => {
            // Use existing ICP withdrawal with recipient
            let result = defi_accounting::accounting::withdraw(
                request.amount,
                Some(request.recipient)
            ).await?;

            Ok(TransferResult {
                block_index: 0, // Get from actual transfer
                fee: 10_000,
                final_amount: result,
            })
        },
        other_token => {
            // Use new multi-token withdrawal
            defi_accounting::accounting::withdraw_token(
                request.amount,
                other_token,
                Some(request.recipient)
            ).await
        }
    }
}

#[query]
fn get_token_balance(token: TokenType) -> u64 {
    let caller = ic_cdk::api::msg_caller();
    defi_accounting::accounting::get_token_balance(caller, token)
}

#[query]
fn get_all_balances() -> Vec<(TokenType, u64)> {
    let caller = ic_cdk::api::msg_caller();
    // Return ICP balance and all token balances
    vec![
        (TokenType::ICP, defi_accounting::accounting::get_balance(caller)),
        (TokenType::ckUSDT, defi_accounting::accounting::get_token_balance(caller, TokenType::ckUSDT)),
        (TokenType::ckBTC, defi_accounting::accounting::get_token_balance(caller, TokenType::ckBTC)),
    ]
}

#[query]
fn get_supported_tokens() -> Vec<TokenInfo> {
    // Return list of supported tokens with their configs
    wallet::tokens::get_token_configs()
        .iter()
        .map(|(token_type, config)| TokenInfo {
            token_type: token_type.clone(),
            symbol: config.symbol.clone(),
            decimals: config.decimals,
            fee: config.fee,
            min_transfer: config.min_transfer,
            canister_id: config.canister_id.to_text(),
        })
        .collect()
}
```

### Phase 4: Frontend Implementation

#### 5. Create Wallet Management Component
**File**: `openhouse_frontend/src/components/WalletTransferPanel.tsx` (NEW)
```typescript
// PSEUDOCODE
import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import useDiceActor from '../hooks/actors/useDiceActor';

interface WalletTransferPanelProps {
  onTransferComplete?: () => void;
}

export const WalletTransferPanel: React.FC<WalletTransferPanelProps> = ({ onTransferComplete }) => {
  const { actor } = useDiceActor();
  const [selectedToken, setSelectedToken] = useState<'ICP' | 'ckUSDT' | 'ckBTC'>('ICP');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [balances, setBalances] = useState<Record<string, bigint>>({});
  const [isTransferring, setIsTransferring] = useState(false);
  const [supportedTokens, setSupportedTokens] = useState([]);

  useEffect(() => {
    loadBalances();
    loadSupportedTokens();
  }, [actor]);

  const loadBalances = async () => {
    if (!actor) return;

    try {
      const allBalances = await actor.get_all_balances();
      // Convert to map
      const balanceMap = {};
      allBalances.forEach(([token, balance]) => {
        balanceMap[token] = balance;
      });
      setBalances(balanceMap);
    } catch (error) {
      console.error('Failed to load balances:', error);
    }
  };

  const loadSupportedTokens = async () => {
    if (!actor) return;

    try {
      const tokens = await actor.get_supported_tokens();
      setSupportedTokens(tokens);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  };

  const handleTransfer = async () => {
    if (!actor || !recipientAddress || !amount) return;

    setIsTransferring(true);

    try {
      // Validate recipient principal
      const recipient = Principal.fromText(recipientAddress);

      // Convert amount to appropriate decimals
      const tokenConfig = supportedTokens.find(t => t.token_type === selectedToken);
      const amountE8s = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, tokenConfig.decimals)));

      // Execute transfer
      const transferRequest = {
        recipient: recipient,
        amount: amountE8s,
        token: { [selectedToken]: null },
        memo: [],
      };

      const result = await actor.transfer_to_wallet(transferRequest);

      if ('Ok' in result) {
        // Success
        alert(`Transfer successful! Block: ${result.Ok.block_index}`);
        setAmount('');
        setRecipientAddress('');
        await loadBalances();
        onTransferComplete?.();
      } else {
        alert(`Transfer failed: ${result.Err}`);
      }
    } catch (error) {
      console.error('Transfer error:', error);
      alert(`Transfer failed: ${error.message}`);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="wallet-transfer-panel">
      <h3>Transfer to External Wallet</h3>

      {/* Token selector */}
      <div className="token-selector">
        <label>Select Token:</label>
        <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value as any)}>
          {supportedTokens.map(token => (
            <option key={token.symbol} value={token.token_type}>
              {token.symbol} (Balance: {formatBalance(balances[token.token_type], token.decimals)})
            </option>
          ))}
        </select>
      </div>

      {/* Recipient input */}
      <div className="recipient-input">
        <label>Recipient Principal:</label>
        <input
          type="text"
          placeholder="xxxx-xxxx-xxxx..."
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
        />
      </div>

      {/* Amount input */}
      <div className="amount-input">
        <label>Amount:</label>
        <input
          type="number"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <span className="token-symbol">{selectedToken}</span>
      </div>

      {/* Fee display */}
      <div className="fee-info">
        <small>
          Transfer fee: {formatFee(supportedTokens.find(t => t.token_type === selectedToken))}
        </small>
      </div>

      {/* Transfer button */}
      <button
        onClick={handleTransfer}
        disabled={isTransferring || !recipientAddress || !amount}
        className="transfer-button"
      >
        {isTransferring ? 'Transferring...' : 'Transfer'}
      </button>
    </div>
  );
};

// Helper functions
function formatBalance(balance: bigint | undefined, decimals: number): string {
  if (!balance) return '0';
  return (Number(balance) / Math.pow(10, decimals)).toFixed(4);
}

function formatFee(tokenConfig: any): string {
  if (!tokenConfig) return 'N/A';
  return `${Number(tokenConfig.fee) / Math.pow(10, tokenConfig.decimals)} ${tokenConfig.symbol}`;
}
```

#### 6. Update DiceAccountingPanel
**File**: `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Add to existing component

import { WalletTransferPanel } from '../../WalletTransferPanel';

export const DiceAccountingPanel: React.FC<DiceAccountingPanelProps> = ({...}) => {
  // Existing code...

  const [showTransferModal, setShowTransferModal] = useState(false);

  // Add withdraw to external wallet button
  const handleExternalTransfer = () => {
    setShowTransferModal(true);
  };

  return (
    <div className="dice-accounting-panel">
      {/* Existing deposit/withdraw UI */}

      {/* Add new transfer button */}
      <button onClick={handleExternalTransfer} className="external-transfer-btn">
        📤 Transfer to Wallet
      </button>

      {/* Transfer modal */}
      {showTransferModal && (
        <div className="modal">
          <div className="modal-content">
            <button onClick={() => setShowTransferModal(false)} className="close-btn">×</button>
            <WalletTransferPanel
              onTransferComplete={() => {
                setShowTransferModal(false);
                onBalanceChange();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
```

### Phase 5: Type Definitions

#### 7. Update Types
**File**: `dice_backend/src/types.rs` (MODIFY)
```rust
// PSEUDOCODE - Add to existing file

use crate::wallet::TokenType;

#[derive(CandidType, Deserialize, Clone)]
pub struct TokenInfo {
    pub token_type: TokenType,
    pub symbol: String,
    pub decimals: u8,
    pub fee: u64,
    pub min_transfer: u64,
    pub canister_id: String,
}

#[derive(CandidType, Deserialize)]
pub struct MultiTokenBalance {
    pub icp: u64,
    pub token_balances: Vec<(TokenType, u64)>,
}
```

#### 8. Update Candid Interface
**File**: `dice_backend.did` (MODIFY)
```candid
// PSEUDOCODE - Add to existing .did file

type TokenType = variant {
    ICP;
    ckUSDT;
    ckBTC;
};

type TransferRequest = record {
    recipient: principal;
    amount: nat64;
    token: TokenType;
    memo: opt blob;
};

type TransferResult = record {
    block_index: nat64;
    fee: nat64;
    final_amount: nat64;
};

type TokenInfo = record {
    token_type: TokenType;
    symbol: text;
    decimals: nat8;
    fee: nat64;
    min_transfer: nat64;
    canister_id: text;
};

service : {
    // Existing methods...

    // New wallet transfer methods
    transfer_to_wallet: (TransferRequest) -> (variant { Ok: TransferResult; Err: text });
    withdraw: (nat64, opt principal) -> (variant { Ok: nat64; Err: text });
    deposit_token: (nat64, TokenType) -> (variant { Ok: nat64; Err: text });
    withdraw_token: (nat64, TokenType, opt principal) -> (variant { Ok: nat64; Err: text });

    // Query methods
    get_token_balance: (TokenType) -> (nat64) query;
    get_all_balances: () -> (vec tuple(TokenType, nat64)) query;
    get_supported_tokens: () -> (vec TokenInfo) query;
};
```

### Phase 6: Frontend Integration

#### 9. Create Token Hooks
**File**: `openhouse_frontend/src/hooks/useTokenBalances.ts` (NEW)
```typescript
// PSEUDOCODE
import { useState, useEffect } from 'react';
import useDiceActor from './actors/useDiceActor';

export interface TokenBalance {
  token: string;
  balance: bigint;
  symbol: string;
  decimals: number;
}

export const useTokenBalances = () => {
  const { actor } = useDiceActor();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalances = async () => {
    if (!actor) return;

    setIsLoading(true);
    try {
      const [allBalances, tokenInfo] = await Promise.all([
        actor.get_all_balances(),
        actor.get_supported_tokens()
      ]);

      // Combine balance data with token info
      const combinedBalances = allBalances.map(([tokenType, balance]) => {
        const info = tokenInfo.find(t => t.token_type === tokenType);
        return {
          token: tokenType,
          balance: balance,
          symbol: info?.symbol || tokenType,
          decimals: info?.decimals || 8,
        };
      });

      setBalances(combinedBalances);
    } catch (error) {
      console.error('Failed to load token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshBalances();
  }, [actor]);

  return {
    balances,
    isLoading,
    refreshBalances,
  };
};
```

#### 10. Add to Main Navigation
**File**: `openhouse_frontend/src/components/navigation/MainNav.tsx` (MODIFY/CREATE)
```typescript
// PSEUDOCODE
import { WalletTransferPanel } from '../WalletTransferPanel';

export const MainNav = () => {
  const [showWallet, setShowWallet] = useState(false);

  return (
    <nav className="main-nav">
      {/* Existing navigation items */}

      {/* Add wallet button */}
      <button onClick={() => setShowWallet(!showWallet)} className="wallet-btn">
        💳 Wallet
      </button>

      {/* Wallet panel dropdown */}
      {showWallet && (
        <div className="wallet-dropdown">
          <WalletTransferPanel />
        </div>
      )}
    </nav>
  );
};
```

## Deployment Notes

### Affected Canisters
- **dice_backend**: Major changes - new wallet transfer system
- **openhouse_frontend**: New UI components for wallet management

### Deployment Command
```bash
# Build and deploy everything
cargo build --target wasm32-unknown-unknown --release
cd openhouse_frontend && npm run build && cd ..
./deploy.sh
```

### Testing After Deployment
```bash
# Test new endpoints
dfx canister --network ic call dice_backend get_supported_tokens
dfx canister --network ic call dice_backend get_all_balances

# Test transfer (example)
dfx canister --network ic call dice_backend transfer_to_wallet '(record {
  recipient = principal "xxxxx-xxxxx-xxxxx";
  amount = 10_000_000;
  token = variant { ICP };
  memo = null;
})'
```

## Security Considerations

1. **Transfer Limits**: Implement daily/weekly transfer limits to prevent drain attacks
2. **Recipient Validation**: Validate Principal format before transfers
3. **Audit Trail**: All transfers logged with timestamps and amounts
4. **Multi-Sig Option**: Consider adding multi-sig for large transfers in future
5. **Token Allowances**: Use ICRC-2 approval pattern for token deposits

## Future Enhancements

1. **Transfer History**: Add query endpoint to retrieve transfer history
2. **Batch Transfers**: Support multiple transfers in single transaction
3. **Exchange Integration**: Add swap functionality between tokens
4. **Notifications**: Send notifications on successful transfers
5. **Mobile Support**: Optimize UI for mobile devices

---

**Implementation Note**: This plan adds comprehensive wallet transfer functionality with multi-asset support. The implementer should follow the pseudocode structure and adapt to actual IC SDK requirements.