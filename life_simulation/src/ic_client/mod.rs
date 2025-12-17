//! IC Client module - polls IC canister for events

mod types;
mod poller;

pub use types::PlacementEvent;
pub use poller::{initialize_grid_from_ic, run_poll_loop};
