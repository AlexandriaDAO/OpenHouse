# OpenHouse Canister Verification

Verify that deployed canisters match this open-source code.

## Deployed Module Hashes

| Game | Canister ID | Module Hash |
|------|-------------|-------------|
| Plinko | `weupr-2qaaa-aaaap-abl3q-cai` | `9a55f67401ca119308a02fc0fd8ce0e26e005ccb99f4cea420fc9d00326a66b0` |
| Crash | `fws6k-tyaaa-aaaap-qqc7q-cai` | `1c6b9aceeafeaaa3038d3c66e6d956861a2d1649620665bafcacd0f0a1d5773b` |
| Blackjack | `wvrcw-3aaaa-aaaah-arm4a-cai` | `11829c7099b7a29e255179fcb37faded45d4e7318252c8d948a9d1f665f8d6b5` |
| Dice | `whchi-hyaaa-aaaao-a4ruq-cai` | `25c41b51cd48b98c73972138b34bfc3ac8a3699db734d6c4143eca5a06730721` |

## How to Verify

### Step 1: Check Deployed Hash

```bash
# Replace CANISTER_ID with any canister from the table above
dfx canister --network ic info CANISTER_ID
```

### Step 2: Build from Source

Prerequisites:
- Rust 1.91.1 (`rustup install 1.91.1 && rustup default 1.91.1`)
- wasm32 target (`rustup target add wasm32-unknown-unknown`)

```bash
git clone https://github.com/AlexandriaDAO/alexandria.git
cd alexandria/openhouse

# Build any backend (plinko_backend, crash_backend, blackjack_backend, dice_backend)
cargo build --release --target wasm32-unknown-unknown --package plinko_backend
```

### Step 3: Compare Hashes

```bash
sha256sum target/wasm32-unknown-unknown/release/plinko_backend.wasm
```

The output should match the module hash in the table above (without `0x` prefix).

## Build Requirements

For reproducible builds, these settings are required:

- **Rust**: 1.91.1
- **Cargo.lock**: Committed to repo (locks dependency versions)
- **Workspace profile** (Cargo.toml):
  ```toml
  [profile.release]
  codegen-units = 1
  lto = true
  opt-level = 3
  ```

## Game Mechanics

| Game | House Edge | Randomness |
|------|------------|------------|
| Plinko | 1% | IC VRF |
| Crash | 1% | IC VRF |
| Blackjack | ~1% | IC VRF |
| Dice | 1% | IC VRF |

All games use the Internet Computer's Verifiable Random Function (raw_rand) for provably fair randomness.
