// European Roulette Type Definitions

use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq)]
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
