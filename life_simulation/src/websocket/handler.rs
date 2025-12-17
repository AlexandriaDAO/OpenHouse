//! WebSocket connection handler

use std::sync::Arc;
use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade, Message}, State},
    response::IntoResponse,
};
use tokio::sync::{broadcast, RwLock};
use futures::{StreamExt, SinkExt};

use super::{ServerMessage, ClientMessage};
use crate::simulation::GameGrid;

/// State shared with WebSocket handlers
pub type WsState = (Arc<RwLock<GameGrid>>, broadcast::Sender<ServerMessage>);

/// Handle WebSocket upgrade
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State((grid, tx)): State<WsState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, grid, tx))
}

/// Handle individual WebSocket connection
async fn handle_socket(
    socket: WebSocket,
    grid: Arc<RwLock<GameGrid>>,
    tx: broadcast::Sender<ServerMessage>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = tx.subscribe();

    // Send full state on connect
    let full_state = {
        let g = grid.read().await;
        ServerMessage::full_state(g.generation, g.width, g.height, &g.cells)
    };

    let msg_json = match serde_json::to_string(&full_state) {
        Ok(json) => json,
        Err(e) => {
            tracing::error!("Failed to serialize full state: {}", e);
            return;
        }
    };

    if sender.send(Message::Text(msg_json.into())).await.is_err() {
        return;
    }

    tracing::info!("WebSocket client connected");

    // Spawn task to broadcast updates to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Receive messages from client (ping/pong, subscribe)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Ping { timestamp } => {
                            // Respond with pong (would need sender reference)
                            tracing::debug!("Received ping with timestamp {}", timestamp);
                        }
                        ClientMessage::Subscribe => {
                            // Already subscribed on connect
                            tracing::debug!("Received subscribe message");
                        }
                    }
                }
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }

    tracing::info!("WebSocket client disconnected");
}
