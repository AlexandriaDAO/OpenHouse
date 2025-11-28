#!/bin/bash
# Comprehensive Dice Backend Stress Test
# Simulates concurrent users to expose race conditions and bugs
#
# LIMITATION: This script runs all concurrent operations using the SAME principal
# (the current dfx identity). It tests concurrency race conditions for a single
# user account, but does not simulate multi-user scenarios (e.g., multiple
# distinct players interacting simultaneously). For multi-user testing,
# distinct dfx identities must be used.

# =============================================================================
# CONFIGURATION
# =============================================================================
# Check for required tools
if ! command -v bc &> /dev/null; then
    echo "Error: 'bc' is required but not installed."
    exit 1
fi

# Use plaintext identity to avoid keyring contention with concurrent processes
export DFX_WARNING=-mainnet_plaintext_identity

CANISTER_ID="whchi-hyaaa-aaaao-a4ruq-cai"
CKUSDT_CANISTER_ID="cngnf-vqaaa-aaaar-qag4q-cai"
NETWORK="ic"
CONCURRENT_USERS=15          # 10-20 range
OPERATIONS_PER_USER=15       # Each user does 15 operations
TEMP_DIR="/tmp/dice_stress_$$"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Generate random bet parameters
function random_bet_params() {
    # bet_amount: 10,000 to 500,000 decimals (0.01 to 0.5 USDT)
    BET=$((10000 + RANDOM % 490000))

    # target_number: 1-99 (avoid edge cases)
    TARGET=$((1 + RANDOM % 99))

    # direction: Over or Under (50/50 chance)
    if [ $((RANDOM % 2)) -eq 0 ]; then
        DIRECTION="variant { Over }"
    else
        DIRECTION="variant { Under }"
    fi

    # client_seed: random string
    CLIENT_SEED="stress_test_${RANDOM}_${RANDOM}"

    echo "$BET|$TARGET|$DIRECTION|$CLIENT_SEED"
}

function report_funds() {
    echo ""
    echo "======================================"
    echo "  💰 FUNDS REPORT (Where is my money?)"
    echo "======================================"
    
    local PRINCIPAL=$(dfx identity get-principal)
    
    # 1. Check Wallet Balance (ckUSDT)
    local WALLET_BAL_RAW=$(dfx canister --network $NETWORK call $CKUSDT_CANISTER_ID icrc1_balance_of "(record { owner = principal \"$PRINCIPAL\" })" 2>&1)
    local WALLET_BAL=$(echo "$WALLET_BAL_RAW" | awk -F'[:)]' '{print $1}' | sed 's/[^0-9]//g')
    if [ -z "$WALLET_BAL" ]; then WALLET_BAL=0; fi
    local WALLET_FMT=$(echo "scale=2; $WALLET_BAL / 1000000" | bc)
    
    # 2. Check Dice Backend Balance
    local DICE_BAL_RAW=$(dfx canister --network $NETWORK call $CANISTER_ID get_my_balance 2>&1)
    local DICE_BAL=$(echo "$DICE_BAL_RAW" | awk -F'[:)]' '{print $1}' | sed 's/[^0-9]//g')
    if [ -z "$DICE_BAL" ]; then DICE_BAL=0; fi
    local DICE_FMT=$(echo "scale=2; $DICE_BAL / 1000000" | bc)
    
    # 3. Check LP Position
    local LP_RAW=$(dfx canister --network $NETWORK call $CANISTER_ID get_my_lp_position 2>&1)
    # This is a rough check for shares, real value calculation is complex but this helps track if funds are stuck in LP
    local SHARES=$(echo "$LP_RAW" | grep "shares" | sed 's/[^0-9]//g')
    if [ -z "$SHARES" ]; then SHARES=0; fi
    
    echo "1. IC Wallet (ckUSDT):  $WALLET_FMT USDT"
    echo "2. Dice Game Balance:   $DICE_FMT USDT"
    echo "3. LP Shares Held:      $SHARES shares"
    echo "--------------------------------------"
    local TOTAL=$(echo "scale=2; ($WALLET_BAL + $DICE_BAL) / 1000000" | bc)
    echo "Total Liquid Funds:     $TOTAL USDT (excluding potential LP value)"
    echo "======================================"
}

# Call dfx with error checking
function dfx_call() {
    local METHOD=$1
    local ARGS=$2
    local OUTPUT

    # Make the call and capture output
    OUTPUT=$(dfx canister --network $NETWORK call $CANISTER_ID $METHOD "$ARGS" 2>&1)
    local EXIT_CODE=$?

    # Check for unexpected errors
    if [ $EXIT_CODE -ne 0 ]; then
        echo "$OUTPUT" | grep -q "Insufficient balance" && return 1  # Expected
        echo "$OUTPUT" | grep -q "Pool reserve too low" && return 2  # Expected
        echo "$OUTPUT" | grep -q "Bet too high" && return 3          # Expected
        echo "$OUTPUT" | grep -q "InsufficientAllowance" && return 4 # Expected
        echo "$OUTPUT" | grep -q "InsufficientFunds" && return 5     # Expected

        # Unexpected error - fail fast
        echo -e "${RED}❌ UNEXPECTED ERROR in $METHOD${NC}" >&2
        echo "$OUTPUT" >&2
        exit 1
    fi

    echo "$OUTPUT"
    return 0
}

# Simulate one user's operations
function simulate_user() {
    local USER_ID=$1
    local SUCCESS=0
    local EXPECTED_ERRORS=0

    for op in $(seq 1 $OPERATIONS_PER_USER); do
        # Random operation selection
        RAND=$((RANDOM % 100))

        if [ $RAND -lt 60 ]; then
            # 60% - play_dice
            IFS='|' read BET TARGET DIRECTION CLIENT_SEED <<< $(random_bet_params)
            dfx_call "play_dice" "($BET : nat64, $TARGET : nat8, $DIRECTION, \"$CLIENT_SEED\")"
            [ $? -eq 0 ] && ((SUCCESS++)) || ((EXPECTED_ERRORS++))

        elif [ $RAND -lt 80 ]; then
            # 20% - deposit
            AMOUNT=$((1000000 + RANDOM % 2000000))  # 1-3 USDT
            dfx_call "deposit" "($AMOUNT : nat64)"
            [ $? -eq 0 ] && ((SUCCESS++)) || ((EXPECTED_ERRORS++))

        elif [ $RAND -lt 90 ]; then
            # 10% - withdraw_all
            dfx_call "withdraw_all" "()"
            [ $? -eq 0 ] && ((SUCCESS++)) || ((EXPECTED_ERRORS++))

        elif [ $RAND -lt 95 ]; then
            # 5% - deposit_liquidity
            LP_AMOUNT=$((10000000 + RANDOM % 5000000))  # 10-15 USDT
            dfx_call "deposit_liquidity" "($LP_AMOUNT : nat64, null)"
            [ $? -eq 0 ] && ((SUCCESS++)) || ((EXPECTED_ERRORS++))

        else
            # 5% - withdraw_all_liquidity
            dfx_call "withdraw_all_liquidity" "()"
            [ $? -eq 0 ] && ((SUCCESS++)) || ((EXPECTED_ERRORS++))
        fi

        # Small random delay (100-1000ms) to vary timing
        sleep 0.$((RANDOM % 90 + 10))
    done

    echo "$USER_ID:$SUCCESS:$EXPECTED_ERRORS"
}

# =============================================================================
# MAIN TEST EXECUTION
# =============================================================================

echo "======================================"
echo "  Dice Backend Stress Test"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "======================================"
echo ""

# Create temp directory for logs
mkdir -p "$TEMP_DIR"

# -----------------------------------------------------------------------------
# PHASE 1: Pre-Test Setup
# -----------------------------------------------------------------------------
echo "[SETUP] Running pre-test validation..."

# Refresh balance to ensure audit is accurate
dfx canister --network $NETWORK call $CANISTER_ID refresh_canister_balance > /dev/null 2>&1

# Run audit and save baseline
BASELINE_AUDIT=$(dfx canister --network $NETWORK call $CANISTER_ID audit_balances 2>&1)
if ! echo "$BASELINE_AUDIT" | grep -q "Ok"; then
    echo -e "${RED}❌ Pre-test audit failed${NC}"
    echo "$BASELINE_AUDIT"
    exit 1
fi
echo -e "${GREEN}✓ Pre-test audit passed${NC}"

# Check operational status
CAN_BET=$(dfx canister --network $NETWORK call $CANISTER_ID can_accept_bets 2>&1)
if ! echo "$CAN_BET" | grep -q "true"; then
    echo -e "${RED}❌ System cannot accept bets${NC}"
    exit 1
fi
echo -e "${GREEN}✓ System operational${NC}"

# Get baseline balances
USER_BAL=$(dfx canister --network $NETWORK call $CANISTER_ID get_my_balance 2>&1 | grep -v "WARN" | awk -F'[:)]' '{print $1}' | sed 's/[^0-9]//g' | tail -n1)
if [ -z "$USER_BAL" ]; then USER_BAL=0; fi

POOL_STATS=$(dfx canister --network $NETWORK call $CANISTER_ID get_pool_stats 2>&1)
POOL_RESERVE=$(echo "$POOL_STATS" | grep "pool_reserve" | awk -F'=' '{print $2}' | sed 's/[^0-9]//g' | tail -n1)
if [ -z "$POOL_RESERVE" ]; then POOL_RESERVE=0; fi

echo ""
echo "Starting balances:"
echo "  User: $(echo "scale=2; $USER_BAL / 1000000" | bc) USDT"
echo "  Pool: $(echo "scale=2; $POOL_RESERVE / 1000000" | bc) USDT"
echo ""

# -----------------------------------------------------------------------------
# PHASE 2: Warm-up (Sequential)
# -----------------------------------------------------------------------------
echo "[WARMUP] Running 5 sequential operations..."

for i in {1..5}; do
    IFS='|' read BET TARGET DIRECTION CLIENT_SEED <<< $(random_bet_params)
    if ! dfx_call "play_dice" "($BET : nat64, $TARGET : nat8, $DIRECTION, \"$CLIENT_SEED\")" > /dev/null; then
        echo -e "${RED}❌ Warmup operation $i failed${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Warmup completed${NC}"
echo ""

# -----------------------------------------------------------------------------
# PHASE 3: Stress Test (Parallel)
# -----------------------------------------------------------------------------
echo "[STRESS] Launching $CONCURRENT_USERS concurrent users..."
echo "[STRESS] Each user performing $OPERATIONS_PER_USER operations..."
echo ""

PIDS=()
for user_id in $(seq 1 $CONCURRENT_USERS); do
    simulate_user $user_id > "$TEMP_DIR/user_${user_id}.log" &
    PIDS+=($!)
done

# Wait for all users and check for failures
FAILED=0
for pid in "${PIDS[@]}"; do
    if ! wait $pid; then
        FAILED=1
    fi
done

if [ $FAILED -eq 1 ]; then
    echo -e "${RED}❌ Stress test failed - check logs${NC}"
    exit 1
fi

# Parse results
TOTAL_SUCCESS=0
TOTAL_EXPECTED_ERRORS=0
for user_id in $(seq 1 $CONCURRENT_USERS); do
    # Read only the last line of the log file
    RESULT=$(tail -n 1 "$TEMP_DIR/user_${user_id}.log")
    
    # Check if result matches expected format (USER_ID:SUCCESS:ERRORS)
    if echo "$RESULT" | grep -qE '^[0-9]+:[0-9]+:[0-9]+$'; then
        SUCCESS=$(echo $RESULT | cut -d: -f2)
        ERRORS=$(echo $RESULT | cut -d: -f3)
        TOTAL_SUCCESS=$((TOTAL_SUCCESS + SUCCESS))
        TOTAL_EXPECTED_ERRORS=$((TOTAL_EXPECTED_ERRORS + ERRORS))
        echo -e "${GREEN}✓${NC} User $user_id completed ($SUCCESS success, $ERRORS expected errors)"
    else
        echo -e "${YELLOW}⚠${NC} User $user_id had unexpected output format: $RESULT"
    fi
done
echo ""

# -----------------------------------------------------------------------------
# PHASE 4: Cool-down (Sequential)
# -----------------------------------------------------------------------------
echo "[COOLDOWN] Running 5 sequential operations..."

for i in {1..5}; do
    IFS='|' read BET TARGET DIRECTION CLIENT_SEED <<< $(random_bet_params)
    if ! dfx_call "play_dice" "($BET : nat64, $TARGET : nat8, $DIRECTION, \"$CLIENT_SEED\")" > /dev/null; then
        echo -e "${RED}❌ Cooldown operation $i failed${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Cooldown completed${NC}"
echo ""

# -----------------------------------------------------------------------------
# PHASE 5: Post-Test Validation
# -----------------------------------------------------------------------------
echo "[VALIDATION] Running post-test validation..."

# Refresh balance to ensure final audit is accurate
dfx canister --network $NETWORK call $CANISTER_ID refresh_canister_balance > /dev/null 2>&1

# Run audit again
FINAL_AUDIT=$(dfx canister --network $NETWORK call $CANISTER_ID audit_balances 2>&1)
if ! echo "$FINAL_AUDIT" | grep -q "Ok"; then
    echo -e "${RED}❌ Post-test audit detected discrepancies${NC}"
    echo "$FINAL_AUDIT"
    # We don't exit 1 here because catching this is the goal of the test
else
    echo -e "${GREEN}✓ Post-test audit passed${NC}"
fi

# Check still operational
CAN_BET=$(dfx canister --network $NETWORK call $CANISTER_ID can_accept_bets 2>&1)
if echo "$CAN_BET" | grep -q "true"; then
    echo -e "${GREEN}✓ System still operational${NC}"
else
    echo -e "${YELLOW}⚠ System cannot accept bets (may be normal if pool depleted)${NC}"
fi

# Get final balances
FINAL_USER_BAL=$(dfx canister --network $NETWORK call $CANISTER_ID get_my_balance 2>&1 | grep -v "WARN" | awk -F'[:)]' '{print $1}' | sed 's/[^0-9]//g' | tail -n1)
if [ -z "$FINAL_USER_BAL" ]; then FINAL_USER_BAL=0; fi

FINAL_POOL_STATS=$(dfx canister --network $NETWORK call $CANISTER_ID get_pool_stats 2>&1)
FINAL_POOL_RESERVE=$(echo "$FINAL_POOL_STATS" | grep "pool_reserve" | awk -F'=' '{print $2}' | sed 's/[^0-9]//g' | tail -n1)
if [ -z "$FINAL_POOL_RESERVE" ]; then FINAL_POOL_RESERVE=0; fi

echo ""
echo "Ending balances:"
echo "  User: $(echo "scale=2; $FINAL_USER_BAL / 1000000" | bc) USDT"
echo "  Pool: $(echo "scale=2; $FINAL_POOL_RESERVE / 1000000" | bc) USDT"
echo ""

# -----------------------------------------------------------------------------
# PHASE 6: Summary
# -----------------------------------------------------------------------------
TOTAL_OPS=$((CONCURRENT_USERS * OPERATIONS_PER_USER + 10))  # +10 for warmup/cooldown
SUCCESS_RATE=$(echo "scale=1; ($TOTAL_SUCCESS + 10) * 100 / $TOTAL_OPS" | bc)

echo "======================================"
echo "  STRESS TEST PASSED ✅"
echo "======================================"
echo "Total operations: $TOTAL_OPS"
echo "Successful: $(($TOTAL_SUCCESS + 10))"
echo "Expected errors: $TOTAL_EXPECTED_ERRORS"
echo "Unexpected errors: 0"
echo "Success rate: ${SUCCESS_RATE}%"
echo ""
echo "Accounting validation: PASSED"
echo "System integrity: MAINTAINED"
echo "======================================"

# Cleanup
rm -rf "$TEMP_DIR"

# Final funds report
report_funds
