//! Concurrency Tests for Inter-Message Race Conditions
//!
//! These tests model the IC's async execution where messages can:
//! 1. Start execution and capture state
//! 2. Suspend at await points (raw_rand, inter-canister calls)
//! 3. Resume while other messages have modified state
//!
//! Unlike stress_tests/ which use synchronous models, these tests
//! explicitly simulate message interleaving to detect TOCTOU bugs.

pub mod async_model;
pub mod toctou_attacks;
pub mod invariants;
