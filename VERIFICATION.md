# OpenHouse Canister Verification

Verify that deployed canisters match this open-source code.

## Deployed Module Hashes

| Game | Canister ID | Module Hash |
|------|-------------|-------------|
| Plinko | `weupr-2qaaa-aaaap-abl3q-cai` | `13eb35efbaf651fe553a95091e5a6f85d951927b22cf6d114c5fb287b2e7a177` |
| Crash | `fws6k-tyaaa-aaaap-qqc7q-cai` | `0846c5ce0ec0b28d05f1c79009a71bd2e7f0cd4cde59ee36973c93a3d3a2cae3` |
| Dice | `whchi-hyaaa-aaaao-a4ruq-cai` | `4e7a34739a575ed5032bae6c0eb8e1689f244a48f025b1f3a0ebbaf3fa45cc5f` |

## How to Verify

### Step 1: Check Deployed Hash

```bash
# Replace CANISTER_ID with any canister from the table above
dfx canister --network ic info CANISTER_ID
```

### Step 2: Build from Source

Prerequisites:
- [DFX](https://internetcomputer.org/docs/current/developer-docs/setup/install) (IC SDK)
- Rust 1.91.1 (`rustup install 1.91.1 && rustup default 1.91.1`)
- wasm32 target (`rustup target add wasm32-unknown-unknown`)

```bash
git clone https://github.com/AlexandriaDAO/alexandria.git
cd alexandria/openhouse

# Build using dfx (adds required candid metadata to WASM)
dfx build --network ic plinko_backend
```

### Step 3: Compare Hashes

```bash
# The dfx-processed WASM is in .dfx/ic/canisters/<name>/
sha256sum .dfx/ic/canisters/plinko_backend/plinko_backend.wasm
```

The output should match the module hash in the table above (without `0x` prefix).

**Important**: Use `dfx build`, not raw `cargo build`. DFX embeds candid metadata into the WASM, which affects the hash.

## Build Requirements

For reproducible builds, these settings are required:

- **DFX**: 0.28.0
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
| Roulette | ~1% | IC VRF |
| Dice | 1% | IC VRF |

All games use the Internet Computer's Verifiable Random Function (raw_rand) for provably fair randomness.
