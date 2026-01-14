#!/bin/bash

# Ralph Loop Runner
# Usage:
#   ./loop.sh              # auto-detects from script location
#   ./loop.sh roulette     # runs .ralph-roulette/
#   ./loop.sh life         # runs .ralph-life/
#   ./loop.sh --attended   # with pauses between iterations
#   ./loop.sh roulette --attended

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_RALPH_DIR="$(basename "$SCRIPT_DIR")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Parse arguments
PROJECT=""
ATTENDED=false

for arg in "$@"; do
    if [[ "$arg" == "--attended" ]]; then
        ATTENDED=true
    else
        PROJECT="$arg"
    fi
done

# Determine ralph folder
# If no PROJECT arg, auto-detect from the directory this script lives in
if [[ -z "$PROJECT" ]]; then
    if [[ "$SCRIPT_RALPH_DIR" == ".ralph" ]]; then
        RALPH_DIR=".ralph"
    elif [[ "$SCRIPT_RALPH_DIR" == .ralph-* ]]; then
        # Script is in .ralph-{name}/, use that directory
        RALPH_DIR="$SCRIPT_RALPH_DIR"
    else
        RALPH_DIR=".ralph"
    fi
elif [[ -d ".ralph-$PROJECT" ]]; then
    RALPH_DIR=".ralph-$PROJECT"
else
    echo "Error: .ralph-$PROJECT/ not found"
    echo "Available:"
    ls -d .ralph* 2>/dev/null | sed 's/.ralph-/  /'
    exit 1
fi

PROMPT_FILE="$RALPH_DIR/prompt.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

echo "========================================"
echo "  RALPH LOOP"
echo "  Project: $RALPH_DIR"
echo "  Attended: $ATTENDED"
echo "========================================"

ITERATION=1

while true; do
    echo ""
    echo "--- Iteration $ITERATION | $(date +%H:%M:%S) ---"
    echo ""

    OUTPUT=$(cat "$PROMPT_FILE" | claude -p --dangerously-skip-permissions)
    echo "$OUTPUT"

    # Check if all tasks complete
    if echo "$OUTPUT" | grep -q "RALPH_COMPLETE"; then
        echo ""
        echo "========================================"
        echo "  ALL TASKS COMPLETE"
        echo "  Total iterations: $ITERATION"
        echo "========================================"
        exit 0
    fi

    echo ""
    echo "--- Iteration $ITERATION complete ---"

    if $ATTENDED; then
        echo "Press ENTER to continue, Ctrl+C to stop..."
        read -r
    else
        sleep 2
    fi

    ((ITERATION++))
done
