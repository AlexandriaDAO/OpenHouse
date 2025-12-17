//! Types mirroring the IC canister interface

use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

/// A cell placement event from IC canister
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct PlacementEvent {
    pub event_id: u64,
    pub timestamp_ns: u64,
    pub player_principal: Principal,
    pub player_num: u8,
    pub cells: Vec<(u16, u16)>,  // (x, y) grid coordinates
    pub balance_after: u64,
}
