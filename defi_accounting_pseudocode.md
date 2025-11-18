# DeFi Accounting System - YAML-Style Pseudocode

## 🎯 System Overview

```yaml
system: DeFi Accounting for Dice Game
modes:
  - Legacy: Traditional house balance (canister balance - user deposits)
  - LiquidityPool: LP providers stake ICP for shares, handle game payouts

security_model: Checks-Effects-Interactions Pattern
  - No reentrancy guards needed
  - IC guarantees sequential execution
  - State updates happen BEFORE async transfers
  - Rollback on transfer failure
```

---

## 📁 Module Structure (mod.rs)

```yaml
public_exports:
  from_accounting:
    - deposit(amount) -> Result<balance>
    - withdraw(amount) -> Result<balance>
    - withdraw_all() -> Result<balance>
    - get_balance(user) -> u64
    - get_my_balance() -> u64
    - get_house_balance() -> u64
    - get_house_mode() -> HouseMode
    - get_max_allowed_payout() -> u64
    - refresh_canister_balance() -> u64
    - audit_balances() -> Result<String>

  from_liquidity_pool:
    - deposit_liquidity(amount) -> Result<shares>
    - withdraw_all_liquidity() -> Result<icp_amount>
    - get_lp_position(user) -> LPPosition
    - get_pool_stats() -> PoolStats
    - update_pool_on_win(payout)
    - update_pool_on_loss(bet)
```

---

## 🔢 Math Utilities (nat_helpers.rs)

```yaml
purpose: Safe arbitrary-precision arithmetic for large numbers

types:
  Nat:
    description: Candid arbitrary precision natural number
    internal: BigUint from num_bigint

  StorableNat:
    description: Wrapper around Nat for stable storage
    implements: Storable trait for StableBTreeMap
    serialization:
      - Stores length as 4-byte big-endian prefix
      - Followed by BigUint bytes in big-endian format

operations:
  nat_zero() -> Nat:
    return: Nat(0)

  nat_one() -> Nat:
    return: Nat(1)

  nat_is_zero(n):
    return: n == 0

  nat_add(a, b):
    return: Nat(a.bigint + b.bigint)

  nat_subtract(a, b):
    if: a < b
      return: None  # Cannot go negative
    else:
      return: Some(Nat(a.bigint - b.bigint))

  nat_multiply(a, b):
    return: Nat(a.bigint * b.bigint)

  nat_divide(numerator, denominator):
    if: denominator == 0
      return: None  # Division by zero
    else:
      return: Some(Nat(numerator.bigint / denominator.bigint))
      note: Always rounds down

  nat_sqrt(n):
    return: Nat(n.bigint.sqrt())

  u64_to_nat(n):
    return: Nat::from(n)

  nat_to_u64(n):
    if: n > u64::MAX
      return: None
    else:
      return: Some(n as u64)

storable_nat_serialization:
  to_bytes:
    step_1: length = bigint_bytes.len()
    step_2: result = [length as 4 bytes big-endian]
    step_3: result.append(bigint_bytes)
    return: result

  from_bytes:
    step_1: length = first_4_bytes as u32
    step_2: bigint_bytes = next_length_bytes
    step_3: bigint = BigUint::from_bytes_be(bigint_bytes)
    return: StorableNat(Nat(bigint))
```

---

## 💰 Core Accounting (accounting.rs)

```yaml
constants:
  ICP_TRANSFER_FEE: 10_000  # 0.0001 ICP in e8s
  MIN_DEPOSIT: 10_000_000  # 0.1 ICP
  MIN_WITHDRAW: 10_000_000  # 0.1 ICP
  MAX_PAYOUT_PERCENTAGE: 0.10  # 10% of house balance
  ICP_LEDGER_CANISTER_ID: "ryjl3-tyaaa-aaaaa-aaaba-cai"
  USER_BALANCES_MEMORY_ID: 10  # Stable storage ID

types:
  HouseMode:
    variants:
      - Legacy: Traditional house balance
      - LiquidityPool: LP-based system

  Account:
    owner: Principal
    subaccount: Option<Vec<u8>>

  AccountingStats:
    total_user_deposits: u64
    house_balance: u64
    canister_balance: u64
    unique_depositors: u64

storage:
  USER_BALANCES_STABLE:
    type: StableBTreeMap<Principal, u64>
    memory_id: 10
    persistence: Survives canister upgrades

  CACHED_CANISTER_BALANCE:
    type: RefCell<u64>
    purpose: Avoid 500ms ledger query on every balance check
    refresh: Hourly via heartbeat

functions:
  deposit(amount):
    """
    Player deposits ICP into their account
    Flow: Player -> Canister ledger transfer -> Update balance
    """
    validate:
      - amount >= MIN_DEPOSIT

    transfer:
      from: caller's ICP account
      to: canister's ICP account
      amount: amount
      fee: ICP_TRANSFER_FEE
      method: icrc1_transfer (ICRC-1 standard)

    on_success:
      - current_balance = USER_BALANCES[caller] or 0
      - new_balance = current_balance + amount
      - USER_BALANCES[caller] = new_balance
      - return: new_balance

    on_failure:
      - return: Error with transfer failure reason

  withdraw(amount):
    """
    Player withdraws ICP from their account
    Flow: Check balance -> Update state -> Transfer -> Rollback on failure
    """
    validate:
      - amount >= MIN_WITHDRAW
      - user_balance = USER_BALANCES[caller]
      - user_balance >= amount

    effects_before_interaction:
      - new_balance = user_balance - amount
      - USER_BALANCES[caller] = new_balance
      note: State updated BEFORE transfer (reentrancy protection)

    interaction:
      from: canister's ICP account
      to: caller's ICP account
      amount: amount - ICP_TRANSFER_FEE  # User receives net amount
      fee: ICP_TRANSFER_FEE
      method: icrc1_transfer

    on_success:
      - return: new_balance

    on_failure:
      rollback:
        - USER_BALANCES[caller] = user_balance  # Restore original
      return: Error with transfer failure reason

  withdraw_all():
    """
    Convenience function to withdraw entire balance
    """
    steps:
      - user_balance = get_balance(caller)
      - validate: user_balance > 0
      - validate: user_balance >= MIN_WITHDRAW
      - call: withdraw(user_balance)

  get_balance(user):
    """
    Query user's account balance (no ledger call)
    """
    return: USER_BALANCES[user] or 0

  get_house_balance():
    """
    Determines house balance based on current mode
    Auto-detects: LP mode if pool initialized and has reserves
    """
    if: liquidity_pool.is_initialized() AND liquidity_pool.reserve > 0
      return: liquidity_pool.reserve  # LP mode
    else:
      return: get_legacy_house_balance()  # Legacy mode

  get_legacy_house_balance():
    """
    Legacy calculation: Total canister balance minus user deposits
    """
    calculation:
      - canister_balance = CACHED_CANISTER_BALANCE
      - total_user_deposits = sum(USER_BALANCES.values())
      - house_balance = canister_balance - total_user_deposits
      - return: max(house_balance, 0)  # Never negative

  get_house_mode():
    """
    Type-safe mode detection using enum (prevents typos)
    """
    if: liquidity_pool.is_initialized() AND liquidity_pool.reserve > 0
      return: HouseMode::LiquidityPool
    else:
      return: HouseMode::Legacy

  get_max_allowed_payout():
    """
    Fast query - uses cached balance, no ledger call
    Returns 10% of current house/pool balance
    """
    calculation:
      - house_balance = get_house_balance()
      - max_payout = house_balance * 0.10
      - return: max_payout as u64

  refresh_canister_balance():
    """
    Updates cached balance from ICP ledger
    Called hourly via heartbeat to keep cache fresh
    """
    query_ledger:
      - account = {owner: canister_id, subaccount: None}
      - balance = icrc1_balance_of(account) from ICP_LEDGER

    on_success:
      - CACHED_CANISTER_BALANCE = balance
      - log: "Balance cache refreshed"
      - return: balance

    on_failure:
      - log: "Failed to refresh, using cache"
      - return: CACHED_CANISTER_BALANCE  # Return stale cache

  audit_balances():
    """
    Sanity check: house + deposits = canister balance
    """
    calculate:
      - total_deposits = sum(USER_BALANCES.values())
      - canister_balance = CACHED_CANISTER_BALANCE
      - house_balance = max(canister_balance - total_deposits, 0)
      - calculated_total = house_balance + total_deposits

    verify:
      if: calculated_total == canister_balance
        return: "✅ Audit passed"
      else:
        return: "❌ Audit FAILED - mismatch detected"

  update_balance(user, new_balance):
    """
    Internal function called by game logic
    Updates user balance after game outcome
    """
    effect:
      - USER_BALANCES[user] = new_balance
      - return: Ok()
```

---

## 🏊 Liquidity Pool System (liquidity_pool.rs)

```yaml
constants:
  MIN_DEPOSIT: 100_000_000  # 1 ICP minimum (prevents attacks)
  MIN_WITHDRAWAL: 100_000  # 0.001 ICP
  MIN_OPERATING_BALANCE: 1_000_000_000  # 10 ICP to run games
  MINIMUM_LIQUIDITY: 1000  # Burned shares on first deposit
  TRANSFER_FEE: 10_000  # 0.0001 ICP

types:
  PoolState:
    reserve: Nat  # Total ICP in pool
    initialized: bool  # Has first deposit happened?

  LPPosition:
    shares: Nat  # LP tokens owned
    pool_ownership_percent: f64  # % of pool owned
    redeemable_icp: Nat  # ICP value if withdrew now

  PoolStats:
    total_shares: Nat  # All LP shares in circulation
    pool_reserve: Nat  # Total ICP backing shares
    share_price: Nat  # ICP per share
    total_liquidity_providers: u64  # Number of active LPs
    minimum_liquidity_burned: Nat  # 1000 shares (first deposit)
    is_initialized: bool

storage:
  LP_SHARES:
    type: StableBTreeMap<Principal, StorableNat>
    memory_id: 11
    description: Maps each LP to their share balance
    special_entry:
      Principal::anonymous() -> MINIMUM_LIQUIDITY
      purpose: Burned shares from first deposit

  POOL_STATE:
    type: StableCell<PoolState>
    memory_id: 13
    description: Single pool state (reserve + initialized flag)

security_pattern:
  name: Checks-Effects-Interactions (CEI)
  why_no_guards_needed:
    - "IC guarantees sequential execution"
    - "All state changes happen BEFORE await points"
    - "Rollback on transfer failure"
    - "No reentrancy possible within canister"

  comparison_with_icp_swap:
    icp_swap:
      pattern: Multiple awaits with state changes between
      needs_guards: Yes
    this_code:
      pattern: State updates complete before transfer
      needs_guards: No

functions:
  deposit_liquidity(amount):
    """
    LP stakes ICP, receives proportional shares
    Uses ICRC-2 approval: Frontend calls icrc2_approve first
    """
    validate:
      - amount >= MIN_DEPOSIT  # 1 ICP minimum

    transfer_from_user:
      method: icrc2_transfer_from
      from: caller's approved ICP
      to: canister
      amount: amount

      on_insufficient_allowance:
        return: "Your ICP approval has expired. Please approve again."

      on_insufficient_funds:
        return: "Insufficient ICP balance"

    calculate_shares:
      total_shares = sum(LP_SHARES.values())
      current_reserve = POOL_STATE.reserve

      if: total_shares == 0  # First deposit
        initial_shares = amount
        burned_shares = MINIMUM_LIQUIDITY

        mint_burned:
          - LP_SHARES[Principal::anonymous()] = burned_shares
          note: Prevents share manipulation attacks

        shares_to_mint = initial_shares - burned_shares

        security_note: |
          Burning minimum liquidity protects against:
          1. First depositor front-running attacks
          2. Share price manipulation with tiny deposits
          3. Precision loss in share calculations

      else:  # Subsequent deposits
        formula: shares = (amount * total_shares) / current_reserve
        shares_to_mint = (amount * total_shares) / current_reserve

    effects:
      - user_shares = LP_SHARES[caller] or 0
      - LP_SHARES[caller] = user_shares + shares_to_mint
      - POOL_STATE.reserve += amount
      - POOL_STATE.initialized = true

    return: shares_to_mint

  withdraw_all_liquidity():
    """
    LP burns ALL shares, receives proportional ICP
    No partial withdrawals (simplicity + security)
    """
    get_shares:
      - user_shares = LP_SHARES[caller]
      - validate: user_shares > 0

    call: withdraw_liquidity(user_shares)

  withdraw_liquidity(shares_to_burn):
    """
    Internal: Burns shares, returns proportional ICP
    Follows CEI pattern strictly
    """
    checks:
      - shares_to_burn > 0
      - user_shares = LP_SHARES[caller]
      - user_shares >= shares_to_burn
      - total_shares = sum(LP_SHARES.values())
      - current_reserve = POOL_STATE.reserve

    calculate_payout:
      formula: payout = (shares_to_burn * current_reserve) / total_shares
      payout = (shares_to_burn * current_reserve) / total_shares
      new_reserve = current_reserve - payout

      validate: payout >= MIN_WITHDRAWAL

    effects_before_interaction:
      update_shares:
        - new_user_shares = user_shares - shares_to_burn
        - if: new_user_shares == 0
            LP_SHARES.remove(caller)
          else:
            LP_SHARES[caller] = new_user_shares

      update_pool:
        - POOL_STATE.reserve = new_reserve

      note: All state changes BEFORE transfer (reentrancy protection)

    interaction:
      transfer:
        from: canister
        to: caller
        amount: payout
        method: icrc1_transfer

      on_success:
        return: payout

      on_failure:
        rollback:
          - LP_SHARES[caller] = user_shares  # Restore shares
          - POOL_STATE.reserve = current_reserve  # Restore reserve
        return: Error with rollback confirmation

  get_lp_position(user):
    """
    Query LP's current position and value
    """
    calculate:
      - user_shares = LP_SHARES[user] or 0
      - total_shares = sum(LP_SHARES.values())
      - pool_reserve = POOL_STATE.reserve

    if: total_shares == 0
      return:
        shares: user_shares
        pool_ownership_percent: 0
        redeemable_icp: 0

    else:
      ownership_percent = (user_shares / total_shares) * 100
      redeemable_icp = (user_shares * pool_reserve) / total_shares

      return:
        shares: user_shares
        pool_ownership_percent: ownership_percent
        redeemable_icp: redeemable_icp

  get_pool_stats():
    """
    Query comprehensive pool metrics
    """
    calculate:
      - total_shares = sum(LP_SHARES.values())
      - pool_reserve = POOL_STATE.reserve

      share_price:
        if: total_shares == 0
          = 100_000_000  # 1 ICP initial
        else if: pool_reserve == 0
          = 1  # Minimum if drained
        else:
          = pool_reserve / total_shares

      total_lps = count(LP_SHARES where principal != anonymous and shares > 0)

    return:
      total_shares: total_shares
      pool_reserve: pool_reserve
      share_price: share_price
      total_liquidity_providers: total_lps
      minimum_liquidity_burned: MINIMUM_LIQUIDITY if initialized else 0
      is_initialized: POOL_STATE.initialized

  can_accept_bets():
    """
    Check if pool OR legacy house can handle bets
    """
    check_pool:
      if: POOL_STATE.reserve >= MIN_OPERATING_BALANCE
        return: true

    fallback_legacy:
      - legacy_balance = accounting.get_legacy_house_balance()
      - return: legacy_balance >= MIN_OPERATING_BALANCE

  update_pool_on_win(payout):
    """
    Player won - deduct from pool reserve
    Called by game logic after outcome determined
    """
    effects:
      - current_reserve = POOL_STATE.reserve
      - new_reserve = current_reserve - payout

      validate:
        if: new_reserve < 0  # Pool insolvent
          trap: "CRITICAL: Pool insolvent. Halting to protect LPs."
          note: Prevents overdraft, entire canister stops
        else:
          POOL_STATE.reserve = new_reserve

    security_note: |
      Game logic MUST check max payout BEFORE accepting bet
      This is a safety check only - should never trap in practice

  update_pool_on_loss(bet):
    """
    Player lost - add bet to pool reserve
    Called by game logic after outcome determined
    """
    effects:
      - POOL_STATE.reserve += bet

    note: No validation needed, addition always safe

  is_pool_initialized():
    return: POOL_STATE.initialized

  get_pool_reserve():
    return: POOL_STATE.reserve as u64

icrc2_transfer_helpers:
  transfer_from_user(user, amount):
    """
    Uses ICRC-2 transfer_from (requires prior approval)
    """
    args:
      from: {owner: user, subaccount: None}
      to: {owner: canister_id, subaccount: None}
      amount: amount
      fee: TRANSFER_FEE
      spender_subaccount: None

    call: ICP_LEDGER.icrc2_transfer_from(args)

    errors:
      InsufficientAllowance: "Approval expired or consumed"
      InsufficientFunds: "Not enough ICP balance"

  transfer_to_user(user, amount):
    """
    Standard ICRC-1 transfer from canister to user
    Reuses accounting module's implementation
    """
    delegate_to: accounting::transfer_to_user(user, amount)
```

---

## 🎮 Game Integration Flow

```yaml
game_play_flow:
  step_1_before_bet:
    check_mode:
      - mode = get_house_mode()

    calculate_max_bet:
      - max_payout = get_max_allowed_payout()  # 10% of house/pool
      - if: potential_payout > max_payout
          reject: "Bet exceeds maximum payout limit"

    check_can_accept:
      - if: NOT can_accept_bets()
          reject: "Insufficient liquidity to accept bets"

    check_player_balance:
      - player_balance = get_balance(player)
      - if: player_balance < bet_amount
          reject: "Insufficient player balance"

  step_2_deduct_bet:
    - new_player_balance = player_balance - bet_amount
    - update_balance(player, new_player_balance)

  step_3_play_game:
    - outcome = play_game_logic()
    - determine: is_win, payout

  step_4_handle_outcome:
    if: is_win
      case: HouseMode::LiquidityPool
        - update_pool_on_win(payout)
        - new_player_balance += payout
        - update_balance(player, new_player_balance)

      case: HouseMode::Legacy
        - new_player_balance += payout
        - update_balance(player, new_player_balance)
        - note: House balance auto-calculated as canister - deposits

    else:  # Player lost
      case: HouseMode::LiquidityPool
        - update_pool_on_loss(bet_amount)
        - note: Bet already deducted from player

      case: HouseMode::Legacy
        - note: Bet already deducted, increases house balance

mode_transition_example:
  scenario: "Legacy -> LiquidityPool transition"

  initial_state:
    mode: Legacy
    canister_balance: 100 ICP
    user_deposits: 20 ICP
    house_balance: 80 ICP  # Calculated

  first_lp_deposit:
    action: deposit_liquidity(10 ICP)
    result:
      - pool_reserve: 10 ICP
      - pool_initialized: true
      - shares_minted: 10 ICP - 1000 burned
      - LP_SHARES[Principal::anonymous()]: 1000
      - LP_SHARES[depositor]: 10 ICP - 1000

  after_first_lp:
    mode: LiquidityPool  # Auto-switches
    canister_balance: 110 ICP
    user_deposits: 20 ICP
    pool_reserve: 10 ICP
    house_balance: 10 ICP  # Now returns pool_reserve
    legacy_house: 90 ICP  # Still calculated but not used

  subsequent_bets:
    - All wins/losses affect pool_reserve
    - Legacy house balance no longer relevant
    - User deposits still tracked separately
```

---

## 🔒 Security Model

```yaml
reentrancy_protection:
  pattern: Checks-Effects-Interactions (CEI)

  example_withdraw:
    1_checks:
      - Validate: user has sufficient balance
      - Validate: amount meets minimums
      - Calculate: payout amounts

    2_effects:
      - UPDATE: USER_BALANCES[caller] -= amount
      - UPDATE: POOL_STATE.reserve -= payout
      note: All state changes BEFORE async call

    3_interactions:
      - AWAIT: ICP ledger transfer
      - IF transfer fails: ROLLBACK all effects

  why_safe_without_guards:
    - "IC executes update calls sequentially"
    - "State visible to next call only after completion"
    - "No concurrent modifications possible"
    - "Explicit rollback handles transfer failures"

attack_prevention:
  share_manipulation:
    attack: "Tiny first deposit, then large deposit to steal shares"
    defense:
      - Minimum 1 ICP deposit required
      - 1000 shares burned on first deposit
      - Makes attack economically infeasible

  reentrancy:
    attack: "Call deposit/withdraw during pending transfer"
    defense:
      - CEI pattern: state updated before await
      - IC sequential execution prevents concurrent calls
      - Explicit rollback on transfer failure

  precision_loss:
    attack: "Rounding errors favor attacker"
    defense:
      - Uses Nat (arbitrary precision)
      - Division always rounds down (favors pool)
      - 1 ICP minimum prevents dust amounts

  pool_insolvency:
    attack: "Bet exceeds pool reserve"
    defense:
      - 10% max payout limit enforced before bet
      - Trap (halt canister) if payout exceeds reserve
      - Protects LP funds at all costs

upgrade_safety:
  stable_storage:
    - USER_BALANCES_STABLE: Persists across upgrades
    - LP_SHARES: Persists across upgrades
    - POOL_STATE: Persists across upgrades

  cached_values:
    - CACHED_CANISTER_BALANCE: Cleared on upgrade, refreshed hourly
    note: Stale cache acceptable, refreshes automatically

audit_trail:
  balance_equation:
    legacy_mode: canister_balance = house_balance + user_deposits
    pool_mode: canister_balance = pool_reserve + user_deposits

  verification:
    - audit_balances() checks equation holds
    - Returns "✅ Audit passed" or "❌ Audit FAILED"
```

---

## 📊 State Transitions

```yaml
user_deposit:
  initial:
    user_balance: 0 ICP
    canister_balance: 100 ICP

  action: deposit(5 ICP)

  steps:
    1: Transfer 5 ICP from user to canister (ICRC-1)
    2: On success: USER_BALANCES[user] = 0 + 5 = 5 ICP
    3: Canister balance now: 105 ICP

  final:
    user_balance: 5 ICP
    canister_balance: 105 ICP

user_withdraw:
  initial:
    user_balance: 5 ICP
    canister_balance: 105 ICP

  action: withdraw(3 ICP)

  steps:
    1: Check: user_balance >= 3 ICP ✓
    2: UPDATE: USER_BALANCES[user] = 5 - 3 = 2 ICP (BEFORE transfer)
    3: Transfer 3 ICP - fee from canister to user
    4: On success: Keep new balance
    5: On failure: ROLLBACK USER_BALANCES[user] = 5 ICP

  final_success:
    user_balance: 2 ICP
    canister_balance: 102 ICP

lp_deposit:
  initial:
    pool_reserve: 0 ICP
    total_shares: 0

  action: deposit_liquidity(10 ICP)

  steps:
    1: Transfer 10 ICP from LP to canister (ICRC-2 transfer_from)
    2: Calculate shares: first deposit = 10 ICP worth
    3: Burn 1000 shares to Principal::anonymous()
    4: Mint (10 ICP - 1000) shares to LP
    5: POOL_STATE.reserve = 10 ICP
    6: POOL_STATE.initialized = true

  final:
    pool_reserve: 10 ICP (in e8s: 1_000_000_000)
    total_shares: 10 ICP (in e8s: 1_000_000_000)
    burned_shares: 1000
    lp_shares: 1_000_000_000 - 1000 = 999_999_000
    share_price: 10 ICP / 10 ICP = 1.0

subsequent_lp_deposit:
  initial:
    pool_reserve: 10 ICP
    total_shares: 10 ICP (1_000_000_000)

  action: deposit_liquidity(5 ICP)

  steps:
    1: Transfer 5 ICP from new LP
    2: Calculate: shares = (5 * 10) / 10 = 5 ICP worth
    3: Mint 5 ICP shares to new LP
    4: POOL_STATE.reserve = 15 ICP

  final:
    pool_reserve: 15 ICP
    total_shares: 15 ICP
    new_lp_shares: 5 ICP
    share_price: 15 / 15 = 1.0

player_wins_from_pool:
  initial:
    pool_reserve: 15 ICP
    player_balance: 5 ICP

  action:
    bet: 2 ICP
    multiplier: 3x
    outcome: WIN
    payout: 6 ICP

  steps:
    1: Deduct bet: player_balance = 5 - 2 = 3 ICP
    2: Game plays, player wins
    3: update_pool_on_win(6 ICP)
    4: POOL_STATE.reserve = 15 - 6 = 9 ICP
    5: player_balance = 3 + 6 = 9 ICP

  final:
    pool_reserve: 9 ICP (LPs absorbed loss)
    player_balance: 9 ICP (net +4 ICP)
    total_shares: 15 ICP (unchanged)
    share_price: 9 / 15 = 0.6 ICP per share (decreased)

player_loses_to_pool:
  initial:
    pool_reserve: 9 ICP
    player_balance: 9 ICP

  action:
    bet: 3 ICP
    outcome: LOSS

  steps:
    1: Deduct bet: player_balance = 9 - 3 = 6 ICP
    2: Game plays, player loses
    3: update_pool_on_loss(3 ICP)
    4: POOL_STATE.reserve = 9 + 3 = 12 ICP

  final:
    pool_reserve: 12 ICP (LPs gained profit)
    player_balance: 6 ICP (lost bet)
    total_shares: 15 ICP (unchanged)
    share_price: 12 / 15 = 0.8 ICP per share (increased)

lp_withdraw:
  initial:
    pool_reserve: 12 ICP
    total_shares: 15 ICP
    lp_shares: 5 ICP

  action: withdraw_all_liquidity()

  steps:
    1: Get LP shares: 5 ICP worth
    2: Calculate payout: (5 * 12) / 15 = 4 ICP
    3: UPDATE: LP_SHARES.remove(lp)
    4: UPDATE: POOL_STATE.reserve = 12 - 4 = 8 ICP
    5: Transfer 4 ICP to LP
    6: On failure: ROLLBACK shares and reserve

  final_success:
    pool_reserve: 8 ICP
    total_shares: 10 ICP (5 ICP burned)
    lp_received: 4 ICP
    lp_profit/loss: Deposited 5 ICP, withdrew 4 ICP = -1 ICP loss
```

---

## 🧮 Mathematical Formulas

```yaml
share_pricing:
  initial_deposit:
    shares_to_mint: amount - MINIMUM_LIQUIDITY
    burned_shares: MINIMUM_LIQUIDITY (to anonymous)
    initial_price: 1 ICP per share

  subsequent_deposits:
    formula: shares = (deposit_amount * total_shares) / pool_reserve
    example:
      deposit: 5 ICP
      total_shares: 10 ICP
      pool_reserve: 10 ICP
      shares_minted: (5 * 10) / 10 = 5 ICP worth of shares

  withdrawal_calculation:
    formula: payout = (shares_to_burn * pool_reserve) / total_shares
    example:
      shares_to_burn: 5 ICP worth
      pool_reserve: 12 ICP
      total_shares: 15 ICP
      payout: (5 * 12) / 15 = 4 ICP

  share_price:
    formula: price = pool_reserve / total_shares
    example:
      pool_reserve: 12 ICP
      total_shares: 15 ICP
      price: 12 / 15 = 0.8 ICP per share

max_payout_calculation:
  legacy_mode:
    house_balance: canister_balance - total_user_deposits
    max_payout: house_balance * 0.10

  pool_mode:
    house_balance: pool_reserve
    max_payout: pool_reserve * 0.10

  example:
    pool_reserve: 100 ICP
    max_payout: 100 * 0.10 = 10 ICP

    if_player_bets: 2 ICP at 6x multiplier
    potential_payout: 12 ICP
    result: REJECTED (exceeds 10 ICP limit)

ownership_percentage:
  formula: ownership = (user_shares / total_shares) * 100

  example:
    user_shares: 5 ICP worth
    total_shares: 15 ICP worth
    ownership: (5 / 15) * 100 = 33.33%

redeemable_icp:
  formula: redeemable = (user_shares * pool_reserve) / total_shares

  example:
    user_shares: 5 ICP worth
    pool_reserve: 12 ICP
    total_shares: 15 ICP
    redeemable: (5 * 12) / 15 = 4 ICP
```

---

## 🔄 Complete User Journey

```yaml
new_player_journey:
  step_1_deposit:
    action: deposit(10 ICP)
    result:
      user_balance: 10 ICP
      canister_balance: +10 ICP

  step_2_place_bet:
    action: play_dice(2 ICP, target=50, direction=Over)
    validations:
      - user_balance >= 2 ICP ✓
      - max_payout calculated from house/pool ✓
      - 2 ICP * multiplier <= max_payout ✓
    result:
      user_balance: 8 ICP (bet deducted)

  step_3a_player_wins:
    outcome: roll=75, target=50, direction=Over
    payout: 4 ICP (2x multiplier example)

    if: HouseMode::LiquidityPool
      - update_pool_on_win(4 ICP)
      - pool_reserve: -4 ICP
      - user_balance: 8 + 4 = 12 ICP

    if: HouseMode::Legacy
      - user_balance: 8 + 4 = 12 ICP
      - house_balance: auto-recalculated

  step_3b_player_loses:
    outcome: roll=25, target=50, direction=Over

    if: HouseMode::LiquidityPool
      - update_pool_on_loss(2 ICP)
      - pool_reserve: +2 ICP
      - user_balance: 8 ICP (no change)

    if: HouseMode::Legacy
      - user_balance: 8 ICP (no change)
      - house_balance: auto-increases

  step_4_withdraw:
    action: withdraw_all()
    user_balance: 8 ICP
    result:
      - Transfer 8 ICP to player
      - user_balance: 0 ICP
      - canister_balance: -8 ICP

liquidity_provider_journey:
  step_1_approve_icp:
    frontend_action: icrc2_approve(canister, 100 ICP)
    result: Allowance set for canister to spend

  step_2_deposit_liquidity:
    action: deposit_liquidity(100 ICP)

    if: first_depositor
      result:
        - pool_reserve: 100 ICP
        - shares_minted: 100 ICP - 1000 burned
        - LP_SHARES[lp]: 99_999_000 shares
        - LP_SHARES[anonymous]: 1000 shares
        - share_price: 1.0 ICP

    else:
      result:
        - shares = (100 * total_shares) / pool_reserve
        - LP_SHARES[lp]: += shares
        - pool_reserve: += 100 ICP

  step_3_earn_from_losses:
    player_loses: 10 ICP
    effect:
      - pool_reserve: +10 ICP
      - total_shares: unchanged
      - share_price: increases
      - lp_position_value: increases

  step_4_lose_from_wins:
    player_wins: 20 ICP
    effect:
      - pool_reserve: -20 ICP
      - total_shares: unchanged
      - share_price: decreases
      - lp_position_value: decreases

  step_5_check_position:
    action: get_lp_position(lp)
    result:
      shares: 99_999_000
      pool_ownership_percent: 85.5%
      redeemable_icp: 95 ICP (example after net losses)

  step_6_withdraw:
    action: withdraw_all_liquidity()
    result:
      - payout = (shares * pool_reserve) / total_shares
      - Transfer payout to LP
      - LP_SHARES.remove(lp)
      - pool_reserve: -= payout

    lp_profit_loss:
      deposited: 100 ICP
      withdrawn: 95 ICP
      result: -5 ICP loss (players won more than they lost)
```

---

## 🎯 Key Design Decisions

```yaml
why_dual_mode:
  problem: "Need smooth transition from traditional house to LP system"
  solution: "Auto-detect mode based on pool state"
  benefit: "No breaking changes, seamless migration"

why_1_icp_minimum:
  problem: "Share manipulation attacks with tiny deposits"
  solution: "Require 1 ICP minimum for LP deposits"
  benefit: "Makes attacks economically infeasible"

why_burn_minimum_liquidity:
  problem: "First depositor can manipulate share price"
  solution: "Burn 1000 shares on first deposit to anonymous"
  benefit: "Permanent minimum liquidity, prevents manipulation"

why_full_withdrawal_only:
  problem: "Partial withdrawals add complexity"
  solution: "Only allow withdraw_all_liquidity()"
  benefit: "Simpler code, easier to audit, prevents gaming"

why_no_admin_control:
  problem: "Centralization risk with admin powers"
  solution: "Fully decentralized pool, no special privileges"
  benefit: "Trustless system, can't be manipulated by admin"

why_cei_pattern:
  problem: "Reentrancy attacks possible with async transfers"
  solution: "Update state BEFORE transfers, rollback on failure"
  benefit: "No guards needed, simple and secure"

why_10_percent_limit:
  problem: "Single bet could drain entire pool"
  solution: "Limit max payout to 10% of house/pool"
  benefit: "Protects liquidity, ensures sustainability"

why_cached_balance:
  problem: "Ledger queries take 500ms each"
  solution: "Cache balance, refresh hourly"
  benefit: "Fast queries, good UX, acceptable staleness"
```

---

## 🚨 Error Handling

```yaml
deposit_errors:
  insufficient_funds:
    trigger: User doesn't have enough ICP
    message: "Insufficient ICP balance. You need {amount} e8s plus transfer fee."

  insufficient_allowance:
    trigger: ICRC-2 approval expired or consumed
    message: "Your ICP approval has expired. Please approve {amount} e8s again."

  below_minimum:
    trigger: amount < MIN_DEPOSIT
    message: "Minimum deposit is {MIN_DEPOSIT} ICP"

withdraw_errors:
  insufficient_balance:
    trigger: user_balance < amount
    message: "Insufficient balance. You have {balance} e8s, trying to withdraw {amount} e8s"

  below_minimum:
    trigger: amount < MIN_WITHDRAW
    message: "Minimum withdrawal is {MIN_WITHDRAW} ICP"

  transfer_failed:
    trigger: ICP ledger transfer fails
    action: Rollback user balance
    message: "Transfer failed: {error}. State rolled back."

liquidity_pool_errors:
  pool_insolvency:
    trigger: Payout exceeds pool reserve
    action: Trap entire canister (halt execution)
    message: "CRITICAL: Pool insolvent. Attempted payout {payout} exceeds reserve {reserve}"
    note: Should never happen if max payout enforced

  no_shares:
    trigger: User tries to withdraw with 0 shares
    message: "No liquidity to withdraw"

  insufficient_shares:
    trigger: User tries to withdraw more than owned
    message: "Insufficient shares"

  division_error:
    trigger: Math operation fails (shouldn't happen with Nat)
    message: "Division error"

game_integration_errors:
  exceeds_max_payout:
    trigger: potential_payout > get_max_allowed_payout()
    action: Reject bet before deducting
    message: "Bet exceeds maximum payout limit"

  insufficient_liquidity:
    trigger: NOT can_accept_bets()
    action: Reject bet
    message: "Insufficient liquidity to accept bets"
```

---

## 📈 Monitoring & Observability

```yaml
key_metrics:
  player_metrics:
    - total_user_deposits: Sum of all player balances
    - unique_depositors: Count of players with balance > 0
    - largest_balance: Max player balance
    - total_bets_volume: Track separately in game logic

  pool_metrics:
    - pool_reserve: Total ICP backing LP shares
    - total_shares: All LP tokens in circulation
    - share_price: pool_reserve / total_shares
    - total_liquidity_providers: Count of LPs with shares > 0
    - burned_shares: Always 1000 (if initialized)

  house_metrics:
    - house_balance: Auto-calculated based on mode
    - max_allowed_payout: 10% of house/pool
    - canister_balance: Total ICP in canister
    - mode: Legacy or LiquidityPool

query_functions:
  get_accounting_stats():
    returns:
      total_user_deposits: u64
      house_balance: u64
      canister_balance: u64
      unique_depositors: u64

  get_pool_stats():
    returns:
      total_shares: Nat
      pool_reserve: Nat
      share_price: Nat
      total_liquidity_providers: u64
      minimum_liquidity_burned: Nat
      is_initialized: bool

  get_lp_position(principal):
    returns:
      shares: Nat
      pool_ownership_percent: f64
      redeemable_icp: Nat

  audit_balances():
    verifies: house + deposits = canister_balance
    returns: "✅ Audit passed" or "❌ Audit FAILED"

health_checks:
  balance_audit:
    frequency: On-demand
    check: canister_balance == house_balance + user_deposits
    alert: If audit fails

  pool_solvency:
    frequency: Every bet
    check: potential_payout <= max_allowed_payout
    action: Reject bet if exceeds

  cache_freshness:
    frequency: Hourly
    action: refresh_canister_balance()
    tolerance: Stale cache acceptable for queries
```

---

## 🔐 Security Checklist

```yaml
auditor_checklist:
  math_safety:
    - ✓ Uses Nat for all calculations (no overflow)
    - ✓ Division by zero checked before operations
    - ✓ Subtraction returns None if would go negative
    - ✓ All formulas documented and tested

  state_management:
    - ✓ All balances in stable storage (survives upgrades)
    - ✓ State updates atomic (no partial updates possible)
    - ✓ CEI pattern followed (state before transfers)
    - ✓ Explicit rollback on transfer failures

  access_control:
    - ✓ Only caller can withdraw their balance
    - ✓ Only caller can withdraw their LP shares
    - ✓ No admin privileges (fully decentralized)
    - ✓ Game logic can only update after validating caller

  economic_security:
    - ✓ 1 ICP minimum prevents share manipulation
    - ✓ Burned liquidity prevents first depositor attacks
    - ✓ 10% max payout protects pool sustainability
    - ✓ Full withdrawal prevents gaming partial withdrawals

  reentrancy_protection:
    - ✓ State updated before await points
    - ✓ Rollback on transfer failure
    - ✓ IC sequential execution prevents concurrency
    - ✓ No guards needed (by design)

  edge_cases:
    - ✓ First depositor handled (minimum liquidity burned)
    - ✓ Zero balance withdrawals rejected
    - ✓ Pool insolvency traps canister (protects LPs)
    - ✓ Empty pool returns sensible defaults
```

This comprehensive pseudocode document covers the entire DeFi accounting system in an easy-to-read YAML format. It explains all the logic, security patterns, state transitions, and mathematical formulas used throughout the codebase.
