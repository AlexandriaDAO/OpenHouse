//! WebSocket module - real-time grid state streaming

mod protocol;
mod handler;
mod broadcast;

pub use protocol::{ClientMessage, ServerMessage};
pub use handler::ws_handler;
pub use broadcast::run_broadcast_loop;
