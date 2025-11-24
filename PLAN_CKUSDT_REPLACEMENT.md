# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-ckusdt"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-ckusdt`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build all backends
   cargo build --target wasm32-unknown-unknown --release

   # Build frontend
   cd openhouse_frontend && npm run build && cd ..

   # Deploy everything
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
   git commit -m "feat: Replace ICP with ckUSDT for stable-value betting"
   git push -u origin feature/replace-icp-with-ckusdt
   gh pr create --title "Replace ICP with ckUSDT for Stable Value Casino" --body "Implements PLAN_CKUSDT_REPLACEMENT.md

Replaces ICP with ckUSDT across entire casino for:
- Stable USD-based betting (no price volatility)
- 1000x cheaper transfer fees
- Better user experience with dollar-based thinking

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Dice Backend: whchi-hyaaa-aaaao-a4ruq-cai
- Crash Backend: fws6k-tyaaa-aaaap-qqc7q-cai
- Plinko Backend: weupr-2qaaa-aaaap-abl3q-cai"
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

**Branch:** `feature/replace-icp-with-ckusdt`
**Worktree:** `/home/theseus/alexandria/openhouse-ckusdt`

---

# Implementation Plan: Replace ICP with ckUSDT

## Current State Documentation

### Affected Canisters and Scope
- **Dice Backend**: Full financial integration (deposits, withdrawals, LP system)
- **Crash Backend**: Minimal (only display strings)
- **Plinko Backend**: Minimal (only display strings)
- **Frontend**: Ledger integration, display components

### Key Technical Changes

#### 1. Decimal Precision Change
- **FROM**: ICP uses 8 decimals (e8s = 10^-8)
- **TO**: ckUSDT uses 6 decimals (10^-6)
- **Impact**: All amount calculations need updating

#### 2. Ledger Canister IDs
- **ICP Ledger**: `ryjl3-tyaaa-aaaaa-aaaba-cai`
- **ckUSDT Ledger**: `cngnf-vqaaa-aaaar-qag4q-cai` (mainnet)

#### 3. Transfer Fees
- **ICP**: 10,000 e8s (0.0001 ICP)
- **ckUSDT**: 2 (0.000002 USDT) - 1000x cheaper!

## Implementation Details

### Backend: Constants and Type Updates

#### File: `dice_backend/src/types.rs` (MODIFY)
```rust
// PSEUDOCODE
// Change constants from ICP to ckUSDT
pub const DECIMALS_PER_CKUSDT: u64 = 1_000_000;  // Was E8S_PER_ICP = 100_000_000
pub const MIN_BET: u64 = 10_000;  // 0.01 USDT (was 1_000_000 = 0.01 ICP)

// Update display strings in error messages
// Replace all "ICP" with "USDT" in string literals
```

#### File: `dice_backend/src/defi_accounting/accounting.rs` (MODIFY)
```rust
// PSEUDOCODE
use ic_ledger_types::MAINNET_LEDGER_CANISTER_ID;

// Replace with ckUSDT canister
const CKUSDT_CANISTER_ID: Principal = Principal::from_text("cngnf-vqaaa-aaaar-qag4q-cai");

// Update fee constants
const CKUSDT_TRANSFER_FEE: u64 = 2;  // Was ICP_TRANSFER_FEE = 10_000
const MIN_DEPOSIT: u64 = 10_000_000;  // 10 USDT (was 0.1 ICP)
const MIN_WITHDRAW: u64 = 1_000_000;  // 1 USDT (was 0.1 ICP)

// In deposit() function:
pub async fn deposit(amount: u64) -> Result<u64, String> {
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} USDT", MIN_DEPOSIT / DECIMALS_PER_CKUSDT));
    }

    // Update transfer_from args to use CKUSDT_CANISTER_ID
    // Update fee to CKUSDT_TRANSFER_FEE
    let args = TransferFromArgs {
        fee: Some(Nat::from(CKUSDT_TRANSFER_FEE)),
        // ... rest of args
    };

    // Call ckUSDT ledger instead
    ic_cdk::api::call::call(CKUSDT_CANISTER_ID, "icrc2_transfer_from", (args,))

    // Update amount received calculation
    let amount_received = amount + CKUSDT_TRANSFER_FEE;
}

// In withdraw functions:
// Update transfer args to use CKUSDT_TRANSFER_FEE
// Update ledger calls to use CKUSDT_CANISTER_ID

// In refresh_canister_balance():
// Update to call ckUSDT ledger
let ledger = Principal::from_text("cngnf-vqaaa-aaaar-qag4q-cai");

// Replace all "ICP" strings with "USDT" in error messages
```

#### File: `dice_backend/src/defi_accounting/liquidity_pool.rs` (MODIFY)
```rust
// PSEUDOCODE
// Update constants
const MIN_DEPOSIT: u64 = 1_000_000;  // 1 USDT minimum for LP
const MIN_WITHDRAWAL: u64 = 100_000;  // 0.1 USDT
const MIN_OPERATING_BALANCE: u64 = 100_000_000;  // 100 USDT to operate games
const TRANSFER_FEE: u64 = 2;  // ckUSDT fee

// In deposit_liquidity():
if amount < MIN_DEPOSIT {
    return Err(format!("Minimum deposit is {} USDT", MIN_DEPOSIT / DECIMALS_PER_CKUSDT));
}

// Update transfer_from_user() to use ckUSDT
async fn transfer_from_user(user: Principal, amount: u64) -> Result<(), String> {
    let ledger = Principal::from_text("cngnf-vqaaa-aaaar-qag4q-cai");
    // Use TRANSFER_FEE = 2 instead of 10_000
    fee: Some(Nat::from(TRANSFER_FEE)),
}

// Replace all "ICP" strings with "USDT"
```

#### File: `dice_backend/src/game.rs` (MODIFY)
```rust
// PSEUDOCODE
use crate::types::{DECIMALS_PER_CKUSDT, MIN_BET};

// In play_dice():
if user_balance < bet_amount {
    let user_balance_usdt = user_balance as f64 / DECIMALS_PER_CKUSDT as f64;
    let needed_usdt = bet_amount as f64 / DECIMALS_PER_CKUSDT as f64;
    return Err(format!(
        "INSUFFICIENT_BALANCE|Your dice balance: {:.2} USDT|Bet amount: {:.2} USDT|...",
        user_balance_usdt, needed_usdt
    ));
}

if bet_amount < MIN_BET {
    return Err(format!("Minimum bet is {} USDT", MIN_BET as f64 / DECIMALS_PER_CKUSDT as f64));
}

// In error messages for max payout:
return Err(format!(
    "Max payout of {:.2} USDT exceeds house limit of {:.2} USDT (10% of house balance)",
    max_payout as f64 / DECIMALS_PER_CKUSDT as f64,
    max_allowed as f64 / DECIMALS_PER_CKUSDT as f64
));

// Similar updates for refund messages
```

#### File: `crash_backend/src/lib.rs` (MODIFY)
```rust
// PSEUDOCODE
// Minimal changes - mostly cosmetic
// In play_crash() payout calculation comment:
// Calculate payout (for now, simple 1 USDT bet)
let payout = if won {
    (target_multiplier * 1_000_000.0) as u64  // Convert to 6 decimals
} else {
    0
};

// Update greet function:
format!("Simple Crash: Transparent 1% edge, {} wins or loses fairly with USDT!", name)
```

#### File: `plinko_backend/src/lib.rs` (MODIFY)
```rust
// PSEUDOCODE
// Similar minimal changes as crash
// Update greet function:
format!("Pure Mathematical Plinko: Transparent odds, {} wins or loses fairly with USDT!", name)
```

### Frontend: Ledger Integration and Display Updates

#### File: `openhouse_frontend/src/hooks/actors/useLedgerActor.ts` (MODIFY)
```typescript
// PSEUDOCODE
// Update ledger canister ID
const CKUSDT_CANISTER_ID = "cngnf-vqaaa-aaaar-qag4q-cai";

// In createLedgerActor():
const agent = await createAgent();
return Actor.createActor(ledgerIdl, {
  agent,
  canisterId: CKUSDT_CANISTER_ID,  // Was ICP ledger
});
```

#### File: `openhouse_frontend/src/types/balance.ts` (NEW/MODIFY)
```typescript
// PSEUDOCODE
export const DECIMALS_PER_CKUSDT = 1_000_000;  // Was E8S_PER_ICP
export const TRANSFER_FEE = 2;  // Was 10_000

export function formatUSDT(amount: bigint): string {
  const usdt = Number(amount) / DECIMALS_PER_CKUSDT;
  return `$${usdt.toFixed(2)}`;  // Format as dollars
}
```

#### File: `openhouse_frontend/src/pages/dice/DiceGame.tsx` (MODIFY)
```typescript
// PSEUDOCODE
// Import updated constants
import { DECIMALS_PER_CKUSDT, formatUSDT } from '../../types/balance';

// Update all display strings
// Replace "ICP" with "USDT"
// Use formatUSDT() for amount displays

// In bet amount input:
placeholder="Enter bet amount in USDT"

// In balance display:
<span>Balance: {formatUSDT(balance)}</span>

// In payout display:
<span>Payout: {formatUSDT(payout)}</span>
```

#### File: `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx` (MODIFY)
```typescript
// PSEUDOCODE
// Similar updates as DiceGame
// Replace all "ICP" with "USDT"
// Update minimum deposit displays
const MIN_LP_DEPOSIT = 1_000_000;  // 1 USDT

// Format all amounts with formatUSDT()
```

#### File: `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` (MODIFY)
```typescript
// PSEUDOCODE
// Update balance displays
// Replace "ICP" with "USDT"
// Use formatUSDT() for all amount formatting
```

#### File: `openhouse_frontend/src/components/game-ui/BetAmountInput.tsx` (MODIFY)
```typescript
// PSEUDOCODE
// Update placeholder text
placeholder="Amount in USDT"

// Update min/max validations
const MIN_BET = 0.01;  // USDT
```

#### File: `openhouse_frontend/src/components/GameCard.tsx` (MODIFY)
```typescript
// PSEUDOCODE
// Update minimum bet displays
<span>Min Bet: 0.01 USDT</span>
```

### Configuration Updates

#### File: `dice_backend/Cargo.toml` (NO CHANGES NEEDED)
The `ic-ledger-types` dependency already supports ICRC standards used by ckUSDT.

#### File: `CLAUDE.md` (MODIFY)
```markdown
// PSEUDOCODE
// Update all references to ICP with USDT
// Update minimum amounts:
- Min Bet: 0.01 USDT
- Min LP Deposit: 1 USDT
- Min Withdrawal: 0.1 USDT

// Update canister IDs section to include ckUSDT ledger
```

## Deployment Strategy

All backends need redeployment due to constant changes:
```bash
# Build all backends with new constants
cargo build --target wasm32-unknown-unknown --release

# Build frontend with updated displays
cd openhouse_frontend
npm run build
cd ..

# Deploy everything at once
./deploy.sh
```

## Verification Steps

1. Test deposit with ckUSDT approval
2. Place a 0.01 USDT bet on dice
3. Verify payout calculations with 6 decimal precision
4. Test LP deposit/withdrawal
5. Check all display strings show "$" and "USDT"

## Risk Mitigation

- **Decimal precision**: Test with small amounts first (0.01 USDT)
- **Ledger compatibility**: ckUSDT uses same ICRC-2 standard
- **No migration needed**: Fresh deployment, no existing balances

## Success Criteria

- [ ] All games accept USDT bets
- [ ] Deposits/withdrawals work with ckUSDT
- [ ] Display shows dollar amounts clearly
- [ ] Transfer fees are 0.000002 USDT
- [ ] Dice LP system works with 6 decimals