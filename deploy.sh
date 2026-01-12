#!/bin/bash
# OpenHouse Frontend Deployment Script - Mainnet Only
# Usage: ./deploy.sh [--test]

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Parse arguments
RUN_TESTS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --test)
            RUN_TESTS=true
            shift
            ;;
        --help)
            echo "OpenHouse Frontend Deployment Script - Mainnet Only"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --test             Run post-deployment tests"
            echo "  --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./deploy.sh                    # Deploy frontend to mainnet"
            echo "  ./deploy.sh --test             # Deploy and run tests"
            echo ""
            echo "IMPORTANT: This script ALWAYS deploys to MAINNET"
            echo "There is no local testing environment - all testing happens on mainnet"
            echo ""
            echo "NOTE: Backend canisters are deployed separately from the OpenHouse-backend repo"
            echo "      https://github.com/AlexandriaDAO/OpenHouse-backend"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Display deployment configuration
echo "================================================"
echo "OpenHouse Frontend Deployment - MAINNET ONLY"
echo "================================================"
echo "Network: IC (Mainnet)"
echo "Working from: $SCRIPT_DIR"
echo ""
echo "Canister ID:"
echo "  Frontend:  pezw3-laaaa-aaaal-qssoa-cai"
echo "================================================"
echo ""

# Change to script directory for all operations
cd "$SCRIPT_DIR"

# Function to check if DFX is available
check_dfx() {
    if ! command -v dfx &> /dev/null; then
        echo "ERROR: dfx is not installed"
        echo "Please install dfx: sh -c '\$(curl -fsSL https://sdk.dfinity.org/install.sh)'"
        exit 1
    fi
}

# Function to switch to daopad identity
use_daopad_identity() {
    echo "Switching to daopad identity for mainnet deployment..."
    export DFX_WARNING=-mainnet_plaintext_identity
    dfx identity use daopad
    echo "Using identity: daopad"
    echo ""
}

# Function to deploy frontend
deploy_frontend() {
    echo "=================================================="
    echo "Deploying OpenHouse Frontend Canister"
    echo "=================================================="

    # Build frontend
    echo "Building frontend..."
    if [ -d "openhouse_frontend" ]; then
        cd openhouse_frontend

        if [ -f "package.json" ]; then
            echo "Installing frontend dependencies..."
            npm install

            echo "Building frontend assets..."
            npm run build
        else
            echo "Using static frontend assets..."
        fi

        cd ..
    fi

    # Deploy frontend to mainnet
    echo "Deploying frontend to mainnet..."
    dfx deploy openhouse_frontend --network ic

    echo "Frontend deployment completed!"
    echo "Access at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
    echo ""
}

# Function to run tests
run_tests() {
    echo "=================================================="
    echo "Running Post-Deployment Tests"
    echo "=================================================="

    # Check frontend is accessible
    echo "Checking frontend accessibility..."
    curl -s -o /dev/null -w "Frontend HTTP Status: %{http_code}\n" https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io

    echo "Tests completed!"
    echo ""
}

# Main deployment flow
main() {
    check_dfx
    use_daopad_identity
    deploy_frontend

    if [ "$RUN_TESTS" = true ]; then
        run_tests
    fi

    echo "=================================================="
    echo "Deployment Complete!"
    echo "=================================================="
    echo "Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
    echo ""
    echo "Remember: All changes are live on mainnet immediately!"
    echo ""
    echo "NOTE: Backend canisters are deployed separately from:"
    echo "      https://github.com/AlexandriaDAO/OpenHouse-backend"
}

# Run main function
main
