# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-health-dashboard"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-health-dashboard`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cd openhouse_frontend
   npm install
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```
4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice/liquidity"
   echo "Click 'Show System Health Check' button"
   echo "Verify all stats display correctly"
   ```
5. **Update PR** (use existing PR #85):
   ```bash
   git add .
   git commit -m "Polish health dashboard implementation"
   git push
   ```
6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view 85 --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR updates - push changes to existing PR #85
- ❌ NO stopping after implementation - verify and iterate
- ⚠️ MAINNET DEPLOYMENT: All changes go directly to production
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/health-dashboard`
**Worktree:** `/home/theseus/alexandria/openhouse-health-dashboard`
**Existing PR:** https://github.com/AlexandriaDAO/OpenHouse/pull/85

---

# Implementation Plan: Health Dashboard & Balance Check Script

## Task Classification
**NEW FEATURE** - Adding monitoring tools for LP owners

## Current State (What Exists)

### Backend Query Functions (All Available)
Located in `dice_backend/src/`:

**Accounting Queries:**
- `get_balance(user: Principal) -> u64` - User's ICP balance
- `get_my_balance() -> u64` - Caller's balance
- `get_accounting_stats() -> AccountingStats` - Total deposits, house balance, canister balance
- `audit_balances() -> Result<String, String>` - Verify accounting integrity
- `get_withdrawal_status() -> Option<PendingWithdrawal>` - Check pending withdrawals
- `get_audit_log(offset: usize, limit: usize) -> Vec<AuditEntry>` - Audit trail

**Pool Queries:**
- `get_pool_stats() -> PoolStats` - Total shares, reserve, share price, LP count
- `get_lp_position(user: Principal) -> LPPosition` - User's LP shares and value
- `get_my_lp_position() -> LPPosition` - Caller's LP position
- `can_accept_bets() -> bool` - Operational status (pool >= 10 ICP)

**Game Queries:**
- `get_stats() -> GameStats` - Total games, volume, profit, win rate
- `get_recent_games(limit: u32) -> Vec<DiceResult>` - Recent game results
- `get_game(game_id: u64) -> Option<DiceResult>` - Specific game details
- `get_detailed_history(limit: u32) -> Vec<DetailedGameHistory>` - Extended analytics

### Frontend Structure
- Owner page: `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx`
- LP Panel component: `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx`
- Currently shows: Pool stats, user position, deposit/withdraw controls

### What's Been Done (PR #85)
✅ Created initial HealthDashboard component
✅ Created scripts/check_balance.sh
✅ Basic integration into DiceLiquidity page
✅ Deployed to mainnet

---

## Implementation Tasks

### Task 1: Polish Balance Check Script

**File:** `scripts/check_balance.sh` (MODIFY)

**Current Issues to Fix:**
- May have parsing issues with audit output format
- Could add more visual formatting
- Missing timestamp in output

**PSEUDOCODE:**
```bash
#!/bin/bash
# Comprehensive Dice Backend Health Check
# Version: 1.0

CANISTER_ID="whchi-hyaaa-aaaao-a4ruq-cai"
NETWORK="ic"

# Add timestamp to output
echo "======================================"
echo "  Dice Backend Health Check"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================"

# 1. Refresh canister balance (capture result properly)
# 2. Run audit_balances (parse correctly)
# 3. Get all stats (format nicely)
# 4. Calculate excess (handle edge cases)
# 5. Display health status with colored output if supported
# 6. Show recent audit log (last 10 entries, formatted)
# 7. Add summary section at end

# Error handling: if any call fails, show graceful error
# Output formatting: align numbers, use visual separators
```

### Task 2: Enhance Health Dashboard Component

**File:** `openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx` (MODIFY)

**Current Issues to Fix:**
- Component needs better error handling
- Loading state could be more user-friendly
- Stats should auto-refresh when dashboard is visible
- Could add more visual polish (icons, colors)
- Missing some TypeScript types from backend

**PSEUDOCODE:**
```typescript
// Enhanced version with improvements

interface HealthDashboardProps {}

export const HealthDashboard: React.FC<HealthDashboardProps> = () => {
  // State management
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All stats states (existing)
  const [accounting, setAccounting] = useState<AccountingStats | null>(null);
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [auditStatus, setAuditStatus] = useState<string>('');
  const [canAcceptBets, setCanAcceptBets] = useState<boolean | null>(null);

  // Auto-refresh when visible (every 30 seconds)
  useEffect(() => {
    if (showHealthCheck && !accounting) {
      fetchHealthMetrics();
    }

    if (showHealthCheck) {
      const interval = setInterval(fetchHealthMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [showHealthCheck]);

  // Fetch all metrics with error handling
  async function fetchHealthMetrics() {
    if (!diceActor) {
      setError("Actor not available");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Parallel fetch all stats
      const results = await Promise.all([
        diceActor.get_accounting_stats(),
        diceActor.get_pool_stats(),
        diceActor.get_stats(),
        diceActor.audit_balances(),
        diceActor.can_accept_bets()
      ]);

      // Update all state
      // Add error handling for each result
      // Format and validate data
    } catch (err) {
      setError("Failed to fetch stats: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Helper functions for formatting
  const formatICP = (e8s: bigint) => {
    // Format with proper decimals
  };

  const calculateExcess = () => {
    // Calculate excess balance
    // Return: { excess, excessICP, orphanedFees, isHealthy }
  };

  const calculateWinRate = () => {
    // Calculate player win rate percentage
  };

  // Render with improved UI
  return (
    <div className="card p-4 mt-6 bg-gray-900/30 border border-gray-700">
      {/* Toggle Button - more prominent */}
      <button
        onClick={() => setShowHealthCheck(!showHealthCheck)}
        className="..."
      >
        📊 {showHealthCheck ? 'Hide' : 'Show'} System Health Check
      </button>

      {showHealthCheck && (
        <div className="mt-4">
          {/* Error display */}
          {error && <div className="error-message">{error}</div>}

          {/* Refresh button with last updated time */}
          <button onClick={fetchHealthMetrics} disabled={isLoading}>
            {isLoading ? '⏳ Loading...' : '🔄 Refresh Stats'}
          </button>

          {/* Stats grid with improved layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* System Health section */}
            <section>
              <h3>🏥 System Health</h3>
              {/* Audit status with visual indicator */}
              {/* Operational status */}
              {/* Excess balance tracking */}
            </section>

            {/* Accounting section */}
            <section>
              <h3>💰 Accounting</h3>
              {/* All accounting stats */}
            </section>

            {/* Pool section */}
            <section>
              <h3>🏊 Liquidity Pool</h3>
              {/* All pool stats */}
            </section>

            {/* Game Performance section */}
            <section>
              <h3>🎲 Game Performance</h3>
              {/* All game stats with win/loss breakdown */}
            </section>
          </div>

          {/* Help text */}
          <div className="text-xs text-gray-400 mt-4">
            💡 Stats auto-refresh every 30 seconds while visible
          </div>
        </div>
      )}
    </div>
  );
};
```

### Task 3: TypeScript Type Safety

**File:** Create `openhouse_frontend/src/types/dice-backend.ts` (NEW)

**PSEUDOCODE:**
```typescript
// Type definitions matching backend responses

export interface AccountingStats {
  total_user_deposits: bigint;
  unique_depositors: bigint;
  house_balance: bigint;
  canister_balance: bigint;
}

export interface PoolStats {
  total_shares: bigint;
  pool_reserve: bigint;
  share_price: bigint;
  total_liquidity_providers: bigint;
  minimum_liquidity_burned: bigint;
  is_initialized: boolean;
}

export interface GameStats {
  total_games: bigint;
  total_volume: bigint;
  house_profit: bigint;
  games_won: bigint;
  games_lost: bigint;
}

// Import and use these types in HealthDashboard component
```

### Task 4: Test Script Locally

**Manual Testing:**
```bash
# In worktree
./scripts/check_balance.sh

# Verify output shows:
# - Balance refreshed successfully
# - Audit status (pass/fail)
# - All accounting numbers
# - Pool stats
# - Game stats
# - Operational status
# - Audit log entries
# - Health summary
```

### Task 5: Test Frontend Deployment

**Manual Verification:**
```bash
# Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice/liquidity

# Test checklist:
# 1. Click "Show System Health Check" button
# 2. Verify dashboard expands
# 3. Click "Refresh Stats" button
# 4. Verify all 4 sections display:
#    - System Health (with audit status)
#    - Accounting (4 metrics)
#    - Liquidity Pool (4 metrics)
#    - Game Performance (6 metrics)
# 5. Wait 30 seconds, verify auto-refresh works
# 6. Click "Hide System Health Check"
# 7. Verify dashboard collapses
```

---

## Files to Create/Modify

### Created:
- ✅ `scripts/check_balance.sh` - Balance verification script
- ✅ `openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx` - Dashboard component

### Modified:
- ✅ `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx` - Add HealthDashboard
- ✅ `openhouse_frontend/src/components/game-specific/dice/index.ts` - Export HealthDashboard

### To Polish:
- `scripts/check_balance.sh` - Add better formatting, error handling, timestamps
- `openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx` - Add auto-refresh, better error handling
- Create type definitions file (optional but recommended)

---

## Deployment Notes

**Affected Canisters:**
- Frontend: `pezw3-laaaa-aaaal-qssoa-cai` (UI additions only)
- Dice Backend: `whchi-hyaaa-aaaao-a4ruq-cai` (query functions only - no backend changes)

**Deployment Command:**
```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

**Already Deployed:** Initial version is live at https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice/liquidity

---

## Polish & Improvements Needed

### Script Improvements:
1. Add timestamp to output header
2. Better error handling for dfx calls
3. Color-coded output (if terminal supports it)
4. Add summary section at end with health recommendations
5. Handle edge cases (canister not responding, etc.)

### Dashboard Improvements:
1. Add auto-refresh (every 30s when visible)
2. Better error state handling
3. Add "Last Updated" timestamp
4. Improve TypeScript type safety
5. Better visual hierarchy in stats grid
6. Add loading skeleton for better UX
7. Tooltip explanations for each metric
8. Mobile-responsive grid layout

### Testing Improvements:
1. Test with zero balances
2. Test with large numbers (formatting)
3. Test error states (canister offline)
4. Test auto-refresh behavior
5. Test toggle animation

---

## Expected Outcome

**Script Output Example:**
```
======================================
  Dice Backend Health Check
  2025-11-24 12:34:56
======================================

🔍 Running accounting audit...
✅ Audit passed: pool_reserve (100) + deposits (20) = canister (120)

====================================
  Accounting Breakdown
====================================
Pool Reserve:     10000000000 e8s
User Deposits:    2000000000 e8s
Calculated Total: 12000000000 e8s
Actual Balance:   12000030000 e8s
--------------------------------------
EXCESS:           30000 e8s (0.00030000 ICP)
Orphaned Fees:    3 (@ 0.0001 ICP each)

✅ HEALTH STATUS: HEALTHY (excess < 1 ICP)

[... rest of stats ...]
```

**Dashboard Display:**
- Collapsible section with purple button
- 4 stat sections in responsive grid
- Color-coded health indicators
- Auto-refreshing data
- Professional, clean UI matching existing design

---

## Success Criteria

✅ Script runs without errors and displays all metrics
✅ Dashboard toggles smoothly
✅ All 23 backend query functions accessible via UI or script
✅ Stats auto-refresh every 30 seconds
✅ Mobile responsive layout
✅ Deployed to mainnet and functional
✅ PR #85 updated with polished implementation
✅ Code passes TypeScript compilation
✅ No console errors in browser

---

## Notes for Implementing Agent

- Initial implementation is DONE but needs polish
- PR #85 already exists - push updates to it
- Focus on error handling, auto-refresh, and visual polish
- Don't over-engineer - keep it simple and functional
- Test thoroughly before updating PR
- This is for LP owners to monitor their investment
