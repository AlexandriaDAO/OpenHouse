#!/bin/bash
# OpenHouse Security Scan Script
# Systematic vulnerability discovery for IC Rust canisters
#
# Usage: ./scripts/security-scan.sh [backend_dir]
# Example: ./scripts/security-scan.sh crash_backend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Target directory (default: all backends)
TARGET="${1:-*/src}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}OpenHouse Security Vulnerability Scanner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Scanning: $TARGET"
echo ""

# =============================================================================
# SCAN 1: TOCTOU (Time-of-Check-Time-of-Use)
# =============================================================================
echo -e "${YELLOW}=== SCAN 1: TOCTOU Analysis ===${NC}"
echo "Looking for: state reads before await points"

echo ""
echo "1.1 All async functions:"
grep -rn "pub async fn\|async fn" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   async functions found"

echo ""
echo "1.2 All await points:"
grep -rn "\.await" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   await points found"

echo ""
echo "1.3 Balance reads before await (POTENTIAL TOCTOU):"
grep -B20 "\.await" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | grep "get_balance\|borrow().get" | head -10 || echo "   None found (good!)"

echo ""
echo "1.4 Safe pattern (try_deduct_balance after await):"
grep -A5 "\.await" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | grep "try_deduct_balance" | wc -l
echo "   instances using safe atomic deduction"

# =============================================================================
# SCAN 2: Rollback Consistency
# =============================================================================
echo ""
echo -e "${YELLOW}=== SCAN 2: Rollback Consistency ===${NC}"
echo "Looking for: state changes before await without rollback"

echo ""
echo "2.1 Functions with state mutations + await:"
for file in $(find $PROJECT_ROOT -path "$PROJECT_ROOT/$TARGET/**/*.rs" -type f 2>/dev/null | grep -v test); do
    if grep -q "\.await" "$file" && grep -q "\.borrow_mut\|\.insert\|\.remove" "$file"; then
        echo "   - $file"
    fi
done 2>/dev/null | head -10

echo ""
echo "2.2 Rollback patterns found:"
grep -rn "rollback_withdrawal\|restore_lp_position" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   rollback handlers found"

# =============================================================================
# SCAN 3: Arithmetic Safety
# =============================================================================
echo ""
echo -e "${YELLOW}=== SCAN 3: Arithmetic Safety ===${NC}"
echo "Looking for: unprotected arithmetic on financial values"

echo ""
echo "3.1 Protected arithmetic (checked_*/saturating_*):"
grep -rn "checked_add\|checked_sub\|checked_mul\|saturating_add\|saturating_sub\|saturating_mul" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   protected operations found"

echo ""
echo "3.2 Potential unprotected operations (manual review needed):"
grep -rn " \+ \| - \| \* " $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | grep -v checked_ | grep -v saturating_ | grep "amount\|balance\|payout" | head -5 || echo "   None found"

echo ""
echo "3.3 Division operations (check for zero divisor):"
grep -rn " / " $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | grep -v "// " | head -5 || echo "   None found"

# =============================================================================
# SCAN 4: Access Control
# =============================================================================
echo ""
echo -e "${YELLOW}=== SCAN 4: Access Control ===${NC}"
echo "Looking for: update functions without caller verification"

echo ""
echo "4.1 All #[update] functions:"
grep -rn "#\[update\]" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   update endpoints found"

echo ""
echo "4.2 Functions with caller verification:"
grep -rn "msg_caller\|require_admin" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   caller checks found"

echo ""
echo "4.3 Admin functions with protection:"
grep -B5 "require_admin" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep "pub fn\|pub async fn" | head -10 || echo "   None found"

# =============================================================================
# SCAN 5: IC-Specific Vulnerabilities
# =============================================================================
echo ""
echo -e "${YELLOW}=== SCAN 5: IC-Specific Vulnerabilities ===${NC}"

echo ""
echo "5.1 Vec<T> arguments (DoS via large vectors):"
grep -rn "Vec<" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep "pub fn\|pub async fn" | grep -v test | head -5 || echo "   None found"

echo ""
echo "5.2 Unbounded iteration in queries:"
grep -A20 "#\[query\]" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep "\.iter\|for .*in" | head -5 || echo "   None found"

echo ""
echo "5.3 Pre/post upgrade hooks:"
grep -rn "pre_upgrade\|post_upgrade" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | head -5 || echo "   None found"

echo ""
echo "5.4 Inter-canister calls:"
grep -rn "ic_cdk::api::call::call\|ic_cdk::call" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | wc -l
echo "   inter-canister calls found"

# =============================================================================
# SCAN 6: Concurrency Patterns
# =============================================================================
echo ""
echo -e "${YELLOW}=== SCAN 6: Concurrency Patterns ===${NC}"

echo ""
echo "6.1 Pending state guards:"
grep -rn "contains_key\|is_some" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | grep -i "pending\|withdrawal" | head -5 || echo "   None found"

echo ""
echo "6.2 Anonymous principal checks:"
grep -rn "Principal::anonymous" $PROJECT_ROOT/$TARGET/**/*.rs 2>/dev/null | grep -v test | head -5 || echo "   None found"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Scan Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Review flagged items manually"
echo "2. Check TOCTOU patterns in async functions"
echo "3. Verify all arithmetic uses checked/saturating operations"
echo "4. Ensure admin functions have proper access control"
echo "5. Test concurrent operations"
echo ""
echo "For detailed analysis, run:"
echo "  grep -B20 -A10 '.await' <file> | less"
