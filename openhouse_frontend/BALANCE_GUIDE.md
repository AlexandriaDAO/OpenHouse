# ICP Balance Management Guide

## Overview

The OpenHouse frontend now has a centralized ICP balance management system that persists across all routes. This guide explains how it works and how to use it.

## Architecture

### Components

1. **ICP Ledger Actor Hook** (`src/hooks/actors/useLedgerActor.ts`)
   - Connects to the ICP Ledger canister (`ryjl3-tyaaa-aaaaa-aaaba-cai`)
   - Provides typed access to ICRC-1 balance methods
   - Automatically authenticates with current identity

2. **BalanceProvider** (`src/providers/BalanceProvider.tsx`)
   - Centralized context for balance state
   - Automatically fetches balance when user logs in
   - Caches balance to avoid redundant queries
   - Provides refresh mechanism

3. **useBalance Hook**
   - Custom hook to access balance from any component
   - Returns: `{ balance, isLoading, error, refreshBalance }`

4. **Enhanced AuthButton** (`src/components/AuthButton.tsx`)
   - Displays ICP balance with formatting
   - Shows principal with copy-to-clipboard functionality
   - Refresh button for manual balance updates
   - Consistent across all routes

## Features

### ✅ Copy Principal
- Click the copy icon next to your principal
- Principal is copied to clipboard
- Visual feedback with checkmark icon

### ✅ ICP Balance Display
- Automatically fetched on login
- Formatted with proper decimals (e8s → ICP)
- Shows loading state during fetch
- Persists across route changes

### ✅ Refresh Balance
- Click the refresh icon to manually update balance
- Useful after transactions
- Shows spinning animation during refresh

### ✅ Centralized State
- Balance is stored in BalanceProvider context
- Shared across all pages
- No redundant queries when navigating

## Usage in Components

### Accessing Balance

```typescript
import { useBalance } from '../providers/BalanceProvider';

function MyComponent() {
  const { balance, isLoading, error, refreshBalance } = useBalance();

  if (isLoading) return <div>Loading balance...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Your balance: {balance !== null ? formatIcp(balance) : 'N/A'} ICP</p>
      <button onClick={refreshBalance}>Refresh</button>
    </div>
  );
}
```

### Formatting Balance

```typescript
import { formatIcp, e8sToIcp } from '../types/ledger';

// Format for display
const formatted = formatIcp(balanceE8s); // "1.23456789 ICP"

// Convert to number
const icpAmount = e8sToIcp(balanceE8s); // 1.23456789
```

### Copying Principal

```typescript
import { useAuth } from '../providers/AuthProvider';

function MyComponent() {
  const { principal } = useAuth();

  const handleCopy = async () => {
    if (principal) {
      await navigator.clipboard.writeText(principal);
      alert('Copied!');
    }
  };

  return <button onClick={handleCopy}>Copy Principal</button>;
}
```

## Balance Refresh Triggers

The balance is automatically refreshed when:
1. ✅ User logs in with Internet Identity
2. ✅ User manually clicks refresh button
3. ✅ Identity changes

To manually refresh after a transaction:

```typescript
const { refreshBalance } = useBalance();

async function placeBet() {
  // Place bet...
  await actor.place_bet(amount);

  // Refresh balance to show updated amount
  await refreshBalance();
}
```

## Technical Details

### ICP Ledger Integration

- **Canister ID**: `ryjl3-tyaaa-aaaaa-aaaba-cai`
- **Standard**: ICRC-1 (`icrc1_balance_of`)
- **Query Method**: No state changes, fast read
- **Balance Unit**: e8s (1 ICP = 100,000,000 e8s)

### Account Structure

```typescript
interface Account {
  owner: Principal;      // User's principal
  subaccount: [] | [Uint8Array]; // Default: [] (main account)
}
```

### Type Definitions

```typescript
// Balance in e8s (bigint)
balance: bigint | null

// Loading state
isLoading: boolean

// Error message
error: string | null

// Refresh function
refreshBalance: () => Promise<void>
```

## Provider Hierarchy

```
<Router>
  <AuthProvider>           // Manages identity
    <ActorProvider>        // Initializes all actors
      <BalanceProvider>    // Manages ICP balance
        <Layout>           // Shows AuthButton with balance
          <Routes>         // All pages have access to balance
```

## Best Practices

### 1. Always check authentication
```typescript
const { isAuthenticated } = useAuth();
const { balance } = useBalance();

if (!isAuthenticated) {
  return <div>Please log in</div>;
}

// Now safe to use balance
```

### 2. Handle loading states
```typescript
if (isLoading) {
  return <Spinner />;
}
```

### 3. Refresh after transactions
```typescript
await actor.play_game(bet);
await refreshBalance(); // Update balance after bet
```

### 4. Format for display
```typescript
// Don't show raw e8s
<div>Balance: {balance?.toString()}</div> // ❌ Bad

// Use formatter
<div>Balance: {formatIcp(balance)}</div> // ✅ Good
```

## Error Handling

The BalanceProvider handles errors gracefully:

```typescript
const { balance, error } = useBalance();

if (error) {
  // Balance query failed
  // User can click refresh to retry
  console.error('Balance error:', error);
}
```

Common errors:
- Network timeout
- Ledger canister unavailable
- Invalid principal (shouldn't happen)

## Future Enhancements

Potential additions:
- [ ] Transaction history
- [ ] Balance notifications
- [ ] Multiple token support (SNS tokens)
- [ ] Automatic refresh interval
- [ ] Optimistic updates after transactions

## Example: Game with Balance Check

```typescript
import { useBalance } from '../providers/BalanceProvider';
import { useAuth } from '../providers/AuthProvider';
import { e8sToIcp } from '../types/ledger';
import useCrashActor from '../hooks/actors/useCrashActor';

function CrashGame() {
  const { isAuthenticated } = useAuth();
  const { balance, refreshBalance } = useBalance();
  const { actor } = useCrashActor();

  const [betAmount, setBetAmount] = useState(1);

  const handlePlaceBet = async () => {
    if (!actor || !balance) return;

    // Check sufficient balance
    const betE8s = BigInt(betAmount * 100_000_000);
    if (balance < betE8s) {
      alert('Insufficient balance');
      return;
    }

    try {
      // Place bet
      await actor.place_bet(betE8s);

      // Refresh balance
      await refreshBalance();

      alert('Bet placed!');
    } catch (error) {
      alert('Bet failed: ' + error);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to play</div>;
  }

  return (
    <div>
      <p>Balance: {balance !== null ? e8sToIcp(balance) : 'Loading...'} ICP</p>
      <input
        type="number"
        value={betAmount}
        onChange={(e) => setBetAmount(Number(e.target.value))}
      />
      <button onClick={handlePlaceBet}>Place Bet</button>
    </div>
  );
}
```

---

**Note**: Balance state persists across all routes. You don't need to implement balance fetching in individual game components - just use the `useBalance()` hook!
