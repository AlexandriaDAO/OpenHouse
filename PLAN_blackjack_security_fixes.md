# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-blackjack-security-fixes"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-blackjack-security-fixes`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build blackjack backend
   cargo build --target wasm32-unknown-unknown --release

   # Deploy to mainnet
   ./deploy.sh
   ```
4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status blackjack_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(blackjack): critical security fixes for RNG, settlement, and house limits"
   git push -u origin feature/blackjack-security-fixes
   gh pr create --title "fix(blackjack): Critical Security Fixes for PR #120" --body "$(cat <<'EOF'
## Summary
- Fix RNG provable fairness (P0): Store client_seed in game state, use for all card draws
- Fix settlement order (P0): Transfer from pool BEFORE crediting user to prevent double-payout
- Enforce house limits on double_down/split (P0): Verify max payout before increasing wager
- Fix split blackjack payout (P1): Track split origin, award 1:1 instead of 3:2
- Document infinite shoe (P1): Add comments explaining random-with-replacement behavior

## Test plan
- [ ] Manual test: Start game, verify client_seed stored and used for subsequent moves
- [ ] Manual test: Double down on high bet, verify house limit enforced
- [ ] Manual test: Split aces, get 21 on split hand, verify 1:1 payout (not 3:2)
- [ ] Verify build: `cargo build --target wasm32-unknown-unknown --release`

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: blackjack_backend (wvrcw-3aaaa-aaaah-arm4a-cai)

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- MAINNET DEPLOYMENT: All changes go directly to production
- After sleep: IMMEDIATELY continue (no pause)
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/blackjack-security-fixes`
**Worktree:** `/home/theseus/alexandria/openhouse-blackjack-security-fixes`

---

# Implementation Plan: Blackjack Backend Security Fixes

## Current State Analysis

### Files Affected
| File | Purpose | Issues Found |
|------|---------|--------------|
| `blackjack_backend/src/game.rs` | Core game logic | P0-1, P0-2, P0-3, P1-4 |
| `blackjack_backend/src/types.rs` | Type definitions | P1-4 (Hand struct needs split tracking) |

### Issue Details with Line Numbers

#### P0-1: RNG Security (Provable Fairness)
**Location:** `game.rs:142` (start_game), `game.rs:291` (hit), `game.rs:383` (double_down), `game.rs:428` (split), `game.rs:470` (resolve_game dealer draw)

**Current Behavior:**
```rust
// game.rs:142 - client_seed accepted but NOT stored
pub async fn start_game(bet_amount: u64, client_seed: String, caller: Principal) -> Result<GameStartResult, String> {
    // ...
    let (seed_bytes, _, _) = generate_shuffle_seed(&client_seed)?;  // Used once, then forgotten
    // ...
}

// game.rs:291 - Hardcoded "HIT" instead of original client_seed
let (seed_bytes, _, _) = generate_shuffle_seed("HIT")?;

// game.rs:383 - Hardcoded "DOUBLE"
let (seed_bytes, _, _) = generate_shuffle_seed("DOUBLE")?;

// game.rs:428 - Hardcoded "SPLIT"
let (seed_bytes, _, _) = generate_shuffle_seed("SPLIT")?;
```

**Bug:** Makes subsequent moves deterministic - players can predict cards.

---

#### P0-2: Payout Settlement Order
**Location:** `game.rs:519-537` (resolve_game)

**Current Behavior:**
```rust
// game.rs:519-524 - Credits user FIRST
if total_payout > 0 {
    let current_bal = accounting::get_balance(caller);
    let new_bal = current_bal + total_payout;
    accounting::update_balance(caller, new_bal)?;  // User credited!
}

// game.rs:529-537 - THEN settles with pool
if let Err(e) = liquidity_pool::settle_bet(total_bet, total_payout) {
    let refund = total_bet;
    let bal = accounting::get_balance(caller);
    accounting::update_balance(caller, bal + refund)?;  // DOUBLE MONEY!
}
```

**Bug:** If pool can't afford payout, user gets: total_payout (already credited) + total_bet (refund) = INFINITE MONEY GLITCH!

**Reference:** Dice does it correctly at `dice_backend/src/game.rs:147-172`

---

#### P0-3: House Limits on Actions
**Location:** `game.rs:361` (double_down), `game.rs:406` (split)

**Current Behavior:**
- `start_game()` checks house limit at lines 154-161
- `double_down()` deducts extra bet at line 376-378 WITHOUT checking house limit
- `split()` deducts extra bet at line 420-422 WITHOUT checking house limit

**Bug:** Player can bypass house limits by starting with small bet, then doubling/splitting.

---

#### P1-4: Blackjack Payout on Splits
**Location:** `types.rs:58-116` (Hand struct), `game.rs:508-513` (payout calculation)

**Current Behavior:**
```rust
// types.rs:91-93
pub fn is_blackjack(&self) -> bool {
    self.cards.len() == 2 && self.value() == 21  // Doesn't check if split hand!
}
```

**Bug:** Split hand getting Ace+10 is incorrectly awarded 3:2 blackjack payout instead of 1:1.

---

#### P1-5: Document Infinite Shoe
**Location:** `game.rs:67-121` (draw_card function)

**Issue:** No documentation explaining random-with-replacement behavior.

---

## Implementation Plan (Pseudocode)

### Fix 1: Store client_seed in BlackjackGame (P0-1)

**File:** `blackjack_backend/src/types.rs`

```rust
// MODIFY: BlackjackGame struct (line ~135)
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct BlackjackGame {
    pub game_id: u64,
    pub player: Principal,
    pub bet_amount: u64,
    pub player_hands: Vec<Hand>,
    pub dealer_hand: Hand,
    pub dealer_hidden_card: Option<Card>,
    pub current_hand_index: u8,
    pub is_active: bool,
    pub is_doubled: Vec<bool>,
    pub results: Vec<Option<GameResult>>,
    pub payout: u64,
    pub timestamp: u64,
    // NEW FIELDS for provable fairness
    pub client_seed: String,           // Store original client seed
    pub card_draw_counter: u32,        // Nonce for card draws within this game
}
```

**File:** `blackjack_backend/src/game.rs`

```rust
// MODIFY: start_game (line ~142)
pub async fn start_game(bet_amount: u64, client_seed: String, caller: Principal) -> Result<GameStartResult, String> {
    // ... validation ...

    // PSEUDOCODE: Validate client_seed length (DoS protection)
    if client_seed.len() > 256 {
        return Err("Client seed too long (max 256 characters)".to_string());
    }

    // Generate initial seed
    let (seed_bytes, _, _) = generate_shuffle_seed(&client_seed)?;

    // Draw initial cards using counter
    let p_card1 = draw_card(&seed_bytes, 0);
    let d_card1 = draw_card(&seed_bytes, 1);
    let p_card2 = draw_card(&seed_bytes, 2);
    let d_card2 = draw_card(&seed_bytes, 3);

    // ... existing logic ...

    let game = BlackjackGame {
        game_id,
        player: caller,
        bet_amount,
        player_hands: vec![player_hand.clone()],
        dealer_hand: dealer_hand.clone(),
        dealer_hidden_card: if game_over { None } else { Some(d_card2) },
        current_hand_index: 0,
        is_active: !game_over,
        is_doubled: vec![false],
        results,
        payout,
        timestamp: ic_cdk::api::time(),
        // NEW: Store client_seed and initialize counter
        client_seed: client_seed.clone(),
        card_draw_counter: 4,  // Already drew 4 cards
    };

    // ...
}

// MODIFY: hit (line ~274)
pub async fn hit(game_id: u64, caller: Principal) -> Result<ActionResult, String> {
    let mut game = GAMES.with(|g| g.borrow().get(&game_id)).ok_or("Game not found")?;
    // ... validation ...

    // PSEUDOCODE: Use stored client_seed with incremented counter
    let (seed_bytes, _, _) = generate_shuffle_seed(&game.client_seed)?;
    let new_card = draw_card(&seed_bytes, game.card_draw_counter as usize);
    game.card_draw_counter += 1;

    // ... rest unchanged ...
}

// MODIFY: double_down (line ~361)
pub async fn double_down(game_id: u64, caller: Principal) -> Result<ActionResult, String> {
    // ... existing validation ...

    // PSEUDOCODE: Use stored client_seed
    let (seed_bytes, _, _) = generate_shuffle_seed(&game.client_seed)?;
    let new_card = draw_card(&seed_bytes, game.card_draw_counter as usize);
    game.card_draw_counter += 1;

    // ... rest unchanged ...
}

// MODIFY: split (line ~406)
pub async fn split(game_id: u64, caller: Principal) -> Result<ActionResult, String> {
    // ... existing validation ...

    // PSEUDOCODE: Use stored client_seed
    let (seed_bytes, _, _) = generate_shuffle_seed(&game.client_seed)?;
    let new_card1 = draw_card(&seed_bytes, game.card_draw_counter as usize);
    let new_card2 = draw_card(&seed_bytes, game.card_draw_counter as usize + 1);
    game.card_draw_counter += 2;

    // ... rest unchanged ...
}

// MODIFY: resolve_game (line ~459)
async fn resolve_game(mut game: BlackjackGame, caller: Principal) -> Result<ActionResult, String> {
    // ... reveal dealer card ...

    if any_not_bust {
        // PSEUDOCODE: Use stored client_seed for dealer draws
        let (mut seed_bytes, _, _) = generate_shuffle_seed(&game.client_seed)?;

        while game.dealer_hand.value() < 17 {
            let new_card = draw_card(&seed_bytes, game.card_draw_counter as usize);
            game.card_draw_counter += 1;
            game.dealer_hand.add_card(new_card);
        }
    }

    // ... rest unchanged ...
}
```

---

### Fix 2: Correct Settlement Order (P0-2)

**File:** `blackjack_backend/src/game.rs`

```rust
// MODIFY: resolve_game settlement section (line ~519-537)
async fn resolve_game(mut game: BlackjackGame, caller: Principal) -> Result<ActionResult, String> {
    // ... calculate total_payout and total_bet ...

    game.payout = total_payout;
    game.is_active = false;

    // PSEUDOCODE: Correct settlement order (matches dice_backend pattern)
    // 1. First, try to settle with pool (checks solvency)
    // 2. Only credit user if pool settlement succeeds
    // 3. If pool fails, refund original bet

    // Step 1: Attempt pool settlement FIRST (before crediting user)
    if let Err(e) = liquidity_pool::settle_bet(total_bet, total_payout) {
        // Pool cannot afford payout - refund ONLY the original bet, no payout
        let current_bal = accounting::get_balance(caller);
        let refund_bal = current_bal.checked_add(total_bet)
            .ok_or("Balance overflow on refund")?;
        accounting::update_balance(caller, refund_bal)?;

        ic_cdk::println!("CRITICAL: Payout failure for game {}. Refunded {} to {}",
            game.game_id, total_bet, caller);

        return Err(format!(
            "House cannot afford payout. Your bet of {} has been REFUNDED. {}",
            total_bet, e
        ));
    }

    // Step 2: Pool settlement succeeded - now credit user their payout
    if total_payout > 0 {
        let current_bal = accounting::get_balance(caller);
        let new_bal = current_bal.checked_add(total_payout)
            .ok_or("Balance overflow when adding winnings")?;
        accounting::update_balance(caller, new_bal)?;
    }

    // Update game state in storage
    GAMES.with(|g| g.borrow_mut().insert(game.game_id, game.clone()));

    // ... return ActionResult ...
}

// ALSO MODIFY: start_game instant blackjack settlement (line ~218-241)
// Same pattern: settle_bet FIRST, then credit user
if is_blackjack {
    // ... determine result ...

    if payout > 0 {
        // PSEUDOCODE: Settle with pool FIRST
        if let Err(e) = liquidity_pool::settle_bet(bet_amount, payout) {
            // Refund bet on failure
            let current_bal = accounting::get_balance(caller);
            accounting::update_balance(caller, current_bal + bet_amount)?;
            return Err(format!("House cannot afford blackjack payout: {}", e));
        }

        // Pool succeeded - credit user
        let new_bal = accounting::get_balance(caller) + payout;
        accounting::update_balance(caller, new_bal)?;
    } else {
        // Loss/push - just settle
        let _ = liquidity_pool::settle_bet(bet_amount, payout);
    }
    game_over = true;
}
```

---

### Fix 3: Enforce House Limits on Double/Split (P0-3)

**File:** `blackjack_backend/src/game.rs`

```rust
// MODIFY: double_down (after line ~370)
pub async fn double_down(game_id: u64, caller: Principal) -> Result<ActionResult, String> {
    let mut game = GAMES.with(|g| g.borrow().get(&game_id)).ok_or("Game not found")?;
    if game.player != caller { return Err("Not your game".to_string()); }
    if !game.is_active { return Err("Game ended".to_string()); }

    let hand_idx = game.current_hand_index as usize;
    if game.player_hands[hand_idx].cards.len() != 2 {
        return Err("Can only double on first two cards".to_string());
    }

    // PSEUDOCODE: Check house limit BEFORE deducting extra bet
    let extra_bet = game.bet_amount;

    // Calculate new total potential payout after double
    // Total wager = original bet * (2 if this hand doubled else 1) for each hand
    let mut total_wager_after_double = 0u64;
    for (i, is_dbl) in game.is_doubled.iter().enumerate() {
        if i == hand_idx {
            total_wager_after_double += game.bet_amount * 2;  // This hand will be doubled
        } else {
            total_wager_after_double += if *is_dbl { game.bet_amount * 2 } else { game.bet_amount };
        }
    }

    let max_payout = (total_wager_after_double as f64 * 2.0) as u64;  // 2x for win
    let max_allowed = accounting::get_max_allowed_payout();
    if max_payout > max_allowed {
        return Err(format!(
            "Double would exceed house limit. Max payout {} exceeds limit {}",
            max_payout, max_allowed
        ));
    }

    // Verify user has balance
    let user_balance = accounting::get_balance(caller);
    if user_balance < extra_bet {
        return Err("Insufficient balance for double".to_string());
    }

    // ... proceed with deduction and game logic ...
}

// MODIFY: split (after line ~413)
pub async fn split(game_id: u64, caller: Principal) -> Result<ActionResult, String> {
    let mut game = GAMES.with(|g| g.borrow().get(&game_id)).ok_or("Game not found")?;
    if game.player != caller { return Err("Not your game".to_string()); }
    if !game.is_active { return Err("Game ended".to_string()); }

    let hand_idx = game.current_hand_index as usize;
    let hand = &game.player_hands[hand_idx];
    if !hand.can_split() { return Err("Cannot split".to_string()); }

    // PSEUDOCODE: Check house limit BEFORE deducting extra bet
    let extra_bet = game.bet_amount;

    // Calculate new total potential payout after split
    // After split, we have one more hand at base bet
    let current_hands = game.player_hands.len();
    let new_hands = current_hands + 1;

    // Worst case: all hands win (2x each)
    let mut total_wager_after_split = 0u64;
    for is_dbl in &game.is_doubled {
        total_wager_after_split += if *is_dbl { game.bet_amount * 2 } else { game.bet_amount };
    }
    total_wager_after_split += game.bet_amount;  // New split hand

    let max_payout = (total_wager_after_split as f64 * 2.0) as u64;  // 2x for win
    let max_allowed = accounting::get_max_allowed_payout();
    if max_payout > max_allowed {
        return Err(format!(
            "Split would exceed house limit. Max payout {} exceeds limit {}",
            max_payout, max_allowed
        ));
    }

    // Verify user has balance
    let user_balance = accounting::get_balance(caller);
    if user_balance < extra_bet {
        return Err("Insufficient balance for split".to_string());
    }

    // ... proceed with deduction and game logic ...
}
```

---

### Fix 4: Track Split Hands for Blackjack Payout (P1-4)

**File:** `blackjack_backend/src/types.rs`

```rust
// MODIFY: Hand struct (line ~58)
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct Hand {
    pub cards: Vec<Card>,
    pub is_from_split: bool,  // NEW: Track if this hand resulted from a split
}

// MODIFY: Hand::new() (line ~64)
impl Hand {
    pub fn new() -> Self {
        Self {
            cards: Vec::new(),
            is_from_split: false,  // Default: not from split
        }
    }

    // NEW: Constructor for split hands
    pub fn new_split() -> Self {
        Self {
            cards: Vec::new(),
            is_from_split: true,
        }
    }

    // MODIFY: is_blackjack (line ~91)
    pub fn is_blackjack(&self) -> bool {
        // PSEUDOCODE: Natural blackjack requires:
        // 1. Exactly 2 cards
        // 2. Value of 21
        // 3. NOT from a split (split 21 is just 21, not blackjack)
        self.cards.len() == 2 && self.value() == 21 && !self.is_from_split
    }

    // ... rest unchanged ...
}
```

**File:** `blackjack_backend/src/game.rs`

```rust
// MODIFY: split function (line ~432-438)
// When creating split hands, mark them as split hands
let mut hand1 = Hand::new_split();  // Mark as split hand
hand1.add_card(card1);
hand1.add_card(new_card1);

let mut hand2 = Hand::new_split();  // Mark as split hand
hand2.add_card(card2);
hand2.add_card(new_card2);

// MODIFY: resolve_game payout calculation (line ~508)
// The existing is_blackjack() check will now correctly return false for split hands
// because of the is_from_split field, so 3:2 payout only applies to natural blackjack
```

---

### Fix 5: Document Infinite Shoe (P1-5)

**File:** `blackjack_backend/src/game.rs`

```rust
// ADD: Documentation comment above draw_card function (line ~67)

/// Draw a card from an "infinite shoe" using cryptographic randomness.
///
/// # Infinite Shoe Implementation
/// This implementation uses random-with-replacement card generation,
/// meaning each card is drawn independently with equal probability.
/// This is equivalent to an infinite deck where previously drawn cards
/// do not affect future draws.
///
/// ## House Edge Impact
/// Using an infinite shoe slightly increases the house edge compared to
/// finite deck blackjack:
/// - Single deck: ~0.17% house edge
/// - 8-deck shoe: ~0.46% house edge
/// - Infinite shoe: ~0.47% house edge
///
/// The difference is minimal (~0.01%) and acceptable for this implementation.
/// The infinite shoe simplifies implementation and ensures provable fairness
/// without needing to track card removal.
///
/// ## Fairness Guarantee
/// Cards are generated using SHA-256 hash of:
/// - Server seed (from IC VRF)
/// - Client seed (provided by player)
/// - Card index (incremented per draw)
///
/// This ensures:
/// 1. Cards cannot be predicted without knowing the server seed
/// 2. Players can verify fairness after seed rotation
/// 3. No bias in card distribution (uniform across 52 cards)
fn draw_card(seed_bytes: &[u8; 32], index: usize) -> Card {
    // ... existing implementation ...
}
```

---

## Deployment Notes

### Affected Canister
- **Blackjack Backend**: `wvrcw-3aaaa-aaaah-arm4a-cai`

### Build Command
```bash
cargo build --target wasm32-unknown-unknown --release
```

### Deploy Command
```bash
./deploy.sh  # Deploys all canisters including blackjack_backend
```

### Verification Steps
1. Start a blackjack game with a known client_seed
2. Verify hit/double/split use the same seed (check seed hash consistency)
3. Test double_down with bet that would exceed house limit
4. Test split with bet that would exceed house limit
5. Verify split hand getting 21 pays 1:1, not 3:2

---

## Summary of Changes

| Issue | Severity | Fix | Files Modified |
|-------|----------|-----|----------------|
| RNG predictability | P0 | Store client_seed in game state, use for all draws | types.rs, game.rs |
| Double-payout bug | P0 | Settle with pool BEFORE crediting user | game.rs |
| House limit bypass | P0 | Add limit checks to double_down and split | game.rs |
| Split blackjack payout | P1 | Track is_from_split in Hand struct | types.rs, game.rs |
| Undocumented infinite shoe | P1 | Add comprehensive doc comment | game.rs |

---

## Checklist

- [x] Worktree created first
- [x] Orchestrator header EMBEDDED at top of plan
- [x] Current state documented with line numbers
- [x] Affected games/canisters identified
- [x] Implementation in pseudocode
- [x] Deployment strategy noted
- [ ] Plan committed to feature branch
- [ ] Handoff command provided with PR creation reminder
