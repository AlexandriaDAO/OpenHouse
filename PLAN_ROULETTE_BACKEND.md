# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-roulette"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-roulette`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ./deploy.sh --roulette-only
   ```
4. **Verify deployment**:
   ```bash
   dfx canister --network ic call roulette_backend greet '("Test")'
   dfx canister --network ic call roulette_backend spin '(vec { record { bet_type = variant { Straight = 17 : nat8 }; amount = 100 : nat64 } })'
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: implement European roulette backend game logic"
   git push -u origin feature/roulette-backend
   gh pr create --title "Feature: European Roulette Backend" --body "Implements PLAN_ROULETTE_BACKEND.md

   European roulette (37 numbers, 2.70% house edge) with:
   - All standard bet types (straight, split, street, corner, etc.)
   - Multiple bets per spin
   - VRF randomness with provable fairness hash

   Deployed to mainnet: wvrcw-3aaaa-aaaah-arm4a-cai"
   ```
6. **Iterate autonomously** on PR feedback

## CRITICAL RULES
- NO questions ("should I?", "want me to?")
- NO skipping PR creation
- MAINNET DEPLOYMENT: All changes go directly to production
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/roulette-backend`
**Worktree:** `/home/theseus/alexandria/openhouse-roulette`
**Canister:** `wvrcw-3aaaa-aaaah-arm4a-cai` (roulette_backend)

---

# European Roulette Backend - Implementation Plan

## Overview

Replace the placeholder roulette backend (formerly blackjack) with European roulette game logic:
- **37 numbers**: 0-36
- **House edge**: 2.70% (1/37)
- **Multiple bets per spin**
- **Stateless design**: Like crash_backend - immediate results, no persistent game state

## European Roulette Rules

### Wheel Layout
```
Numbers: 0-36 (37 total)
Green: 0
Red:   1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
Black: 2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35
```

### Bet Types & Payouts

| Bet Type | Coverage | Payout | Probability |
|----------|----------|--------|-------------|
| Straight | 1 number | 35:1 | 2.70% |
| Split | 2 adjacent | 17:1 | 5.41% |
| Street | 3 in row | 11:1 | 8.11% |
| Corner | 4 in square | 8:1 | 10.81% |
| Six Line | 6 (2 rows) | 5:1 | 16.22% |
| Column | 12 numbers | 2:1 | 32.43% |
| Dozen | 12 numbers | 2:1 | 32.43% |
| Red/Black | 18 numbers | 1:1 | 48.65% |
| Even/Odd | 18 numbers | 1:1 | 48.65% |
| Low/High | 18 numbers | 1:1 | 48.65% |

**Note**: All outside bets lose when 0 hits.

---

## File Changes

### 1. DELETE existing files (clean slate)
```bash
rm roulette_backend/src/game.rs      # Old blackjack logic
rm roulette_backend/src/seed.rs      # Not needed for stateless design
```

### 2. CREATE `roulette_backend/src/board.rs` (NEW)

```rust
// PSEUDOCODE - Board layout and validation

const RED_NUMBERS: [u8; 18] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

pub enum Color { Green, Red, Black }

pub fn get_color(n: u8) -> Color {
    if n == 0 { Color::Green }
    else if RED_NUMBERS.contains(&n) { Color::Red }
    else { Color::Black }
}

pub fn get_column(n: u8) -> Option<u8> {
    // 0 has no column
    // Column 1: 1,4,7,10,13,16,19,22,25,28,31,34
    // Column 2: 2,5,8,11,14,17,20,23,26,29,32,35
    // Column 3: 3,6,9,12,15,18,21,24,27,30,33,36
    if n == 0 { None }
    else { Some(((n - 1) % 3) + 1) }
}

pub fn get_dozen(n: u8) -> Option<u8> {
    // 0 has no dozen
    // Dozen 1: 1-12, Dozen 2: 13-24, Dozen 3: 25-36
    if n == 0 { None }
    else { Some(((n - 1) / 12) + 1) }
}

// Validation functions for complex bets
pub fn is_valid_split(a: u8, b: u8) -> bool {
    // Two numbers are adjacent horizontally or vertically on the board
    // Horizontal: consecutive numbers in same row (differ by 1, same row)
    // Vertical: same column, differ by 3
    // Special cases for 0
}

pub fn is_valid_street(start: u8) -> bool {
    // Must be 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, or 34
    start >= 1 && start <= 34 && (start - 1) % 3 == 0
}

pub fn is_valid_corner(top_left: u8) -> bool {
    // Top-left of a 2x2 square
    // Valid: 1,2,4,5,7,8,10,11,13,14,16,17,19,20,22,23,25,26,28,29,31,32
}

pub fn is_valid_six_line(start: u8) -> bool {
    // First number of two consecutive rows
    // Valid: 1,4,7,10,13,16,19,22,25,28,31
    start >= 1 && start <= 31 && (start - 1) % 3 == 0
}

pub fn get_street_numbers(start: u8) -> [u8; 3] {
    [start, start + 1, start + 2]
}

pub fn get_corner_numbers(top_left: u8) -> [u8; 4] {
    [top_left, top_left + 1, top_left + 3, top_left + 4]
}

pub fn get_six_line_numbers(start: u8) -> [u8; 6] {
    [start, start+1, start+2, start+3, start+4, start+5]
}

pub fn get_column_numbers(col: u8) -> [u8; 12] {
    // Column 1: 1,4,7,...,34
    // Column 2: 2,5,8,...,35
    // Column 3: 3,6,9,...,36
    let mut nums = [0u8; 12];
    for i in 0..12 {
        nums[i] = col + (i as u8 * 3);
    }
    nums
}

pub fn get_dozen_numbers(dozen: u8) -> [u8; 12] {
    let start = (dozen - 1) * 12 + 1;
    let mut nums = [0u8; 12];
    for i in 0..12 {
        nums[i] = start + i as u8;
    }
    nums
}
```

### 3. REWRITE `roulette_backend/src/types.rs`

```rust
// PSEUDOCODE - Type definitions

use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq)]
pub enum Color {
    Green,
    Red,
    Black,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub enum BetType {
    // Inside bets
    Straight(u8),           // Single number 0-36
    Split(u8, u8),          // Two adjacent numbers
    Street(u8),             // Row of 3 (start number: 1,4,7,...)
    Corner(u8),             // Square of 4 (top-left number)
    SixLine(u8),            // Two rows of 3 (start number)

    // Outside bets
    Column(u8),             // Column 1, 2, or 3
    Dozen(u8),              // Dozen 1, 2, or 3
    Red,
    Black,
    Even,
    Odd,
    Low,                    // 1-18
    High,                   // 19-36
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct Bet {
    pub bet_type: BetType,
    pub amount: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct BetResult {
    pub bet_type: BetType,
    pub amount: u64,
    pub won: bool,
    pub payout: u64,        // 0 if lost, includes original bet if won
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SpinResult {
    pub winning_number: u8,
    pub color: Color,
    pub bets: Vec<BetResult>,
    pub total_bet: u64,
    pub total_payout: u64,
    pub net_result: i64,    // total_payout - total_bet (can be negative)
    pub randomness_hash: String,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct BoardLayout {
    pub red_numbers: Vec<u8>,
    pub black_numbers: Vec<u8>,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct PayoutInfo {
    pub bet_type: String,
    pub payout_multiplier: u8,
    pub description: String,
}
```

### 4. CREATE `roulette_backend/src/game.rs` (NEW)

```rust
// PSEUDOCODE - Game logic

use crate::types::*;
use crate::board::*;
use ic_cdk::api::management_canister::main::raw_rand;
use sha2::{Sha256, Digest};

const MAX_BETS_PER_SPIN: usize = 20;

pub async fn spin(bets: Vec<Bet>) -> Result<SpinResult, String> {
    // 1. Validate inputs
    if bets.is_empty() {
        return Err("No bets placed".to_string());
    }
    if bets.len() > MAX_BETS_PER_SPIN {
        return Err(format!("Maximum {} bets per spin", MAX_BETS_PER_SPIN));
    }

    // 2. Validate each bet
    for bet in &bets {
        validate_bet(bet)?;
    }

    // 3. Get VRF randomness
    let random_bytes = raw_rand().await
        .map_err(|e| format!("Randomness failed: {:?}", e))?.0;

    // 4. Generate randomness hash for verification
    let mut hasher = Sha256::new();
    hasher.update(&random_bytes);
    let hash = hasher.finalize();
    let randomness_hash = hex::encode(hash);

    // 5. Convert to winning number (0-36)
    let winning_number = bytes_to_number(&random_bytes);
    let color = get_color(winning_number);

    // 6. Evaluate each bet
    let bet_results: Vec<BetResult> = bets.iter()
        .map(|bet| evaluate_bet(bet, winning_number))
        .collect();

    // 7. Calculate totals
    let total_bet: u64 = bets.iter().map(|b| b.amount).sum();
    let total_payout: u64 = bet_results.iter().map(|r| r.payout).sum();
    let net_result = total_payout as i64 - total_bet as i64;

    Ok(SpinResult {
        winning_number,
        color,
        bets: bet_results,
        total_bet,
        total_payout,
        net_result,
        randomness_hash,
    })
}

fn validate_bet(bet: &Bet) -> Result<(), String> {
    if bet.amount == 0 {
        return Err("Bet amount must be > 0".to_string());
    }

    match &bet.bet_type {
        BetType::Straight(n) => {
            if *n > 36 {
                return Err(format!("Invalid number: {} (must be 0-36)", n));
            }
        }
        BetType::Split(a, b) => {
            if *a > 36 || *b > 36 {
                return Err("Split numbers must be 0-36".to_string());
            }
            if !is_valid_split(*a, *b) {
                return Err(format!("Invalid split: {} and {} are not adjacent", a, b));
            }
        }
        BetType::Street(start) => {
            if !is_valid_street(*start) {
                return Err(format!("Invalid street start: {}", start));
            }
        }
        BetType::Corner(top_left) => {
            if !is_valid_corner(*top_left) {
                return Err(format!("Invalid corner: {}", top_left));
            }
        }
        BetType::SixLine(start) => {
            if !is_valid_six_line(*start) {
                return Err(format!("Invalid six line start: {}", start));
            }
        }
        BetType::Column(col) => {
            if *col < 1 || *col > 3 {
                return Err(format!("Invalid column: {} (must be 1-3)", col));
            }
        }
        BetType::Dozen(dozen) => {
            if *dozen < 1 || *dozen > 3 {
                return Err(format!("Invalid dozen: {} (must be 1-3)", dozen));
            }
        }
        // Red, Black, Even, Odd, Low, High - always valid
        _ => {}
    }

    Ok(())
}

fn bytes_to_number(bytes: &[u8]) -> u8 {
    // Use first 8 bytes as u64, mod 37 for fair distribution
    // Bias is negligible: 37 divides into 2^64 almost evenly
    let val = u64::from_be_bytes(bytes[0..8].try_into().unwrap());
    (val % 37) as u8
}

fn evaluate_bet(bet: &Bet, winning: u8) -> BetResult {
    let (won, multiplier) = match &bet.bet_type {
        BetType::Straight(n) => (*n == winning, 35u64),
        BetType::Split(a, b) => (*a == winning || *b == winning, 17),
        BetType::Street(start) => {
            let nums = get_street_numbers(*start);
            (nums.contains(&winning), 11)
        }
        BetType::Corner(top_left) => {
            let nums = get_corner_numbers(*top_left);
            (nums.contains(&winning), 8)
        }
        BetType::SixLine(start) => {
            let nums = get_six_line_numbers(*start);
            (nums.contains(&winning), 5)
        }
        BetType::Column(col) => {
            let nums = get_column_numbers(*col);
            (nums.contains(&winning), 2)
        }
        BetType::Dozen(dozen) => {
            let nums = get_dozen_numbers(*dozen);
            (nums.contains(&winning), 2)
        }
        BetType::Red => (get_color(winning) == Color::Red, 1),
        BetType::Black => (get_color(winning) == Color::Black, 1),
        BetType::Even => (winning != 0 && winning % 2 == 0, 1),
        BetType::Odd => (winning != 0 && winning % 2 == 1, 1),
        BetType::Low => (winning >= 1 && winning <= 18, 1),
        BetType::High => (winning >= 19 && winning <= 36, 1),
    };

    // Payout includes original bet back (e.g., 35:1 means bet + 35*bet)
    let payout = if won { bet.amount + bet.amount * multiplier } else { 0 };

    BetResult {
        bet_type: bet.bet_type.clone(),
        amount: bet.amount,
        won,
        payout,
    }
}
```

### 5. REWRITE `roulette_backend/src/lib.rs`

```rust
// PSEUDOCODE - Canister endpoints

use ic_cdk::{query, update, init};
use candid::Principal;

mod types;
mod game;
mod board;

pub use types::*;
use board::RED_NUMBERS;

const BLACK_NUMBERS: [u8; 18] = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

#[init]
fn init() {
    ic_cdk::println!("Roulette Backend Initialized - European Roulette (2.70% house edge)");
}

#[update]
async fn spin(bets: Vec<Bet>) -> Result<SpinResult, String> {
    game::spin(bets).await
}

#[query]
fn get_board_layout() -> BoardLayout {
    BoardLayout {
        red_numbers: RED_NUMBERS.to_vec(),
        black_numbers: BLACK_NUMBERS.to_vec(),
    }
}

#[query]
fn get_payouts() -> Vec<PayoutInfo> {
    vec![
        PayoutInfo { bet_type: "Straight".into(), payout_multiplier: 35, description: "Single number".into() },
        PayoutInfo { bet_type: "Split".into(), payout_multiplier: 17, description: "Two adjacent numbers".into() },
        PayoutInfo { bet_type: "Street".into(), payout_multiplier: 11, description: "Three numbers in a row".into() },
        PayoutInfo { bet_type: "Corner".into(), payout_multiplier: 8, description: "Four numbers in a square".into() },
        PayoutInfo { bet_type: "Six Line".into(), payout_multiplier: 5, description: "Six numbers (two rows)".into() },
        PayoutInfo { bet_type: "Column".into(), payout_multiplier: 2, description: "12 numbers in a column".into() },
        PayoutInfo { bet_type: "Dozen".into(), payout_multiplier: 2, description: "12 numbers (1-12, 13-24, 25-36)".into() },
        PayoutInfo { bet_type: "Red/Black".into(), payout_multiplier: 1, description: "18 numbers by color".into() },
        PayoutInfo { bet_type: "Even/Odd".into(), payout_multiplier: 1, description: "18 numbers by parity".into() },
        PayoutInfo { bet_type: "Low/High".into(), payout_multiplier: 1, description: "1-18 or 19-36".into() },
    ]
}

#[query]
fn greet(name: String) -> String {
    format!("Welcome to OpenHouse Roulette, {}! Place your bets - European rules, 2.70% house edge.", name)
}

ic_cdk::export_candid!();
```

### 6. UPDATE `roulette_backend/roulette_backend.did`

```candid
type Color = variant { Green; Red; Black };

type BetType = variant {
    Straight: nat8;
    Split: record { nat8; nat8 };
    Street: nat8;
    Corner: nat8;
    SixLine: nat8;
    Column: nat8;
    Dozen: nat8;
    Red;
    Black;
    Even;
    Odd;
    Low;
    High;
};

type Bet = record {
    bet_type: BetType;
    amount: nat64;
};

type BetResult = record {
    bet_type: BetType;
    amount: nat64;
    won: bool;
    payout: nat64;
};

type SpinResult = record {
    winning_number: nat8;
    color: Color;
    bets: vec BetResult;
    total_bet: nat64;
    total_payout: nat64;
    net_result: int64;
    randomness_hash: text;
};

type BoardLayout = record {
    red_numbers: vec nat8;
    black_numbers: vec nat8;
};

type PayoutInfo = record {
    bet_type: text;
    payout_multiplier: nat8;
    description: text;
};

service : {
    spin: (vec Bet) -> (variant { Ok: SpinResult; Err: text });
    get_board_layout: () -> (BoardLayout) query;
    get_payouts: () -> (vec PayoutInfo) query;
    greet: (text) -> (text) query;
}
```

### 7. UPDATE `roulette_backend/Cargo.toml`

```toml
[package]
name = "roulette_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
candid = "0.10"
ic-cdk = "0.13"
ic-cdk-macros = "0.13"
serde = { version = "1.0", features = ["derive"] }
sha2 = "0.10"
hex = "0.4"
```

---

## Testing Commands (Post-Deployment)

```bash
# Test greet
dfx canister --network ic call roulette_backend greet '("Player")'

# Test single straight bet
dfx canister --network ic call roulette_backend spin '(vec { record { bet_type = variant { Straight = 17 : nat8 }; amount = 100 : nat64 } })'

# Test red bet
dfx canister --network ic call roulette_backend spin '(vec { record { bet_type = variant { Red }; amount = 100 : nat64 } })'

# Test multiple bets
dfx canister --network ic call roulette_backend spin '(vec {
  record { bet_type = variant { Red }; amount = 100 : nat64 };
  record { bet_type = variant { Straight = 0 : nat8 }; amount = 10 : nat64 };
  record { bet_type = variant { Column = 1 : nat8 }; amount = 50 : nat64 }
})'

# Get board layout
dfx canister --network ic call roulette_backend get_board_layout

# Get payout info
dfx canister --network ic call roulette_backend get_payouts
```

---

## Future Enhancements (Not in scope)

- [ ] defi_accounting integration (deposits, withdrawals, balances)
- [ ] Liquidity pool integration (settle_bet)
- [ ] Game history storage
- [ ] Statistics tracking
- [ ] Neighbor bets (voisins, orphelins, tiers)
- [ ] Call bets / announced bets
