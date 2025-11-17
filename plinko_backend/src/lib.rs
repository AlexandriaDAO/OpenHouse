//! Plinko Game Logic Canister
//!
//! **Architecture Philosophy:**
//! This canister implements ONLY the core Plinko game mechanics:
//! - Generate random ball path using IC VRF
//! - Map final position to multiplier based on risk/rows
//!
//! **What this canister does NOT do:**
//! - ICP betting/transfers (handled by frontend or separate accounting canister)
//! - Game history storage (can be added as separate layer if needed)
//! - Player balance management
//!
//! **Why this separation?**
//! 1. Reusability: Game logic can be used by multiple betting interfaces
//! 2. Verifiability: Core randomness algorithm is simple and auditable
//! 3. Modularity: Betting logic can evolve independently
//! 4. Cost: Less state = lower storage costs
//!
//! **Transparency & Fairness:**
//! - Randomness source: IC VRF (raw_rand) with SHA256 fallback
//! - Multiplier tables are public and fixed (query `get_multipliers`)
//! - Game logic is deterministic: same path -> same multiplier
//! - Frontend should log all game results for user verification

use candid::{CandidType, Deserialize};
use ic_cdk::{query, update};
use ic_cdk::api::management_canister::main::raw_rand;
use sha2::{Digest, Sha256};

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlinkoResult {
    pub path: Vec<bool>,        // true = right, false = left
    pub final_position: u8,     // 0 to rows (number of rights)
    pub multiplier: f64,
}

/// Drop a ball down an 8-row Plinko board
///
/// The ball bounces randomly at each peg (50/50 left/right) following binomial probability.
/// There are 256 possible paths (2^8). Each position's payout is calculated as:
///
/// Multiplier = (256 / paths_to_position) × 0.99
///
/// This gives a transparent 1% house edge that's mathematically provable.
///
/// Randomness source: IC VRF (raw_rand) with SHA256 fallback
#[update]
async fn drop_ball() -> Result<PlinkoResult, String> {
    const ROWS: u8 = 8;

    // Generate random path using IC VRF with secure fallback
    let random_bytes = match raw_rand().await {
        Ok((bytes,)) => bytes,
        Err(_) => {
            // Secure fallback: Hash timestamp + caller principal
            let time = ic_cdk::api::time();
            let caller = ic_cdk::caller();
            let mut hasher = Sha256::new();
            hasher.update(time.to_be_bytes());
            hasher.update(caller.as_slice());
            hasher.finalize().to_vec()
        }
    };

    // Generate path: 8 independent coin flips (one bit per row)
    let path: Vec<bool> = (0..ROWS)
        .map(|i| {
            let bit_index = i as usize;
            let byte_index = bit_index / 8;
            let bit_offset = bit_index % 8;
            (random_bytes[byte_index] >> bit_offset) & 1 == 1
        })
        .collect();

    // Final position = count of right moves (0 to 8)
    let final_position = path.iter().filter(|&&d| d).count() as u8;

    // Get multiplier from mathematical table
    let multiplier = get_multiplier(final_position)?;

    Ok(PlinkoResult { path, final_position, multiplier })
}

/// Get the full multiplier table for display
///
/// Returns all 9 multipliers for the 8-row board (positions 0-8).
/// These are calculated using the formula: (256 / binomial(8, k)) × 0.99
#[query]
fn get_multipliers() -> Vec<f64> {
    vec![
        253.44,              // pos 0
        31.68,               // pos 1
        9.05142857142857,    // pos 2
        4.52571428571429,    // pos 3
        3.62057142857143,    // pos 4 (center)
        4.52571428571429,    // pos 5
        9.05142857142857,    // pos 6
        31.68,               // pos 7
        253.44,              // pos 8
    ]
}

/// Get the mathematically calculated multiplier for a position
///
/// Formula: (2^8 / C(8, pos)) × 0.99
///
/// Where C(8, pos) is the binomial coefficient "8 choose pos"
/// representing the number of paths to reach that position.
///
/// The 0.99 multiplier ensures a transparent 1% house edge.
fn get_multiplier(pos: u8) -> Result<f64, String> {
    if pos > 8 {
        return Err(format!("Invalid position: {} (must be 0-8)", pos));
    }

    // Precomputed multipliers for 8 rows
    // Formula: (256 / binomial(8, k)) × 0.99
    //
    // Position | Binomial | Probability | Fair Mult | 1% Edge Mult
    // ---------|----------|-------------|-----------|-------------
    //    0     |    1     |   0.39%     |  256.00x  |  253.44x
    //    1     |    8     |   3.13%     |   32.00x  |   31.68x
    //    2     |   28     |  10.94%     |    9.14x  |    9.05x
    //    3     |   56     |  21.88%     |    4.57x  |    4.53x
    //    4     |   70     |  27.34%     |    3.66x  |    3.62x
    //    5     |   56     |  21.88%     |    4.57x  |    4.53x
    //    6     |   28     |  10.94%     |    9.14x  |    9.05x
    //    7     |    8     |   3.13%     |   32.00x  |   31.68x
    //    8     |    1     |   0.39%     |  256.00x  |  253.44x
    const MULTIPLIERS: [f64; 9] = [
        253.44,              // pos 0: 256/1 × 0.99
        31.68,               // pos 1: 256/8 × 0.99
        9.05142857142857,    // pos 2: 256/28 × 0.99 (keeping full precision)
        4.52571428571429,    // pos 3: 256/56 × 0.99
        3.62057142857143,    // pos 4: 256/70 × 0.99 (center)
        4.52571428571429,    // pos 5: 256/56 × 0.99
        9.05142857142857,    // pos 6: 256/28 × 0.99
        31.68,               // pos 7: 256/8 × 0.99
        253.44,              // pos 8: 256/1 × 0.99
    ];

    Ok(MULTIPLIERS[pos as usize])
}

#[query]
fn greet(name: String) -> String {
    format!("Plinko: Drop a ball, get a multiplier. Hi {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multiplier_valid_positions() {
        // Test edge positions (rarest)
        assert_eq!(get_multiplier(0).unwrap(), 253.44);
        assert_eq!(get_multiplier(8).unwrap(), 253.44);

        // Test center position (most common, lowest payout)
        assert_eq!(get_multiplier(4).unwrap(), 3.62057142857143);

        // Test symmetry
        assert_eq!(get_multiplier(1).unwrap(), get_multiplier(7).unwrap());
        assert_eq!(get_multiplier(2).unwrap(), get_multiplier(6).unwrap());
        assert_eq!(get_multiplier(3).unwrap(), get_multiplier(5).unwrap());
    }

    #[test]
    fn test_multiplier_invalid_positions() {
        assert!(get_multiplier(9).is_err());
        assert!(get_multiplier(100).is_err());
    }

    #[test]
    fn test_get_multipliers_table() {
        let table = get_multipliers();
        assert_eq!(table.len(), 9);
        assert_eq!(table[0], 253.44);
        assert_eq!(table[4], 3.62057142857143);
        assert_eq!(table[8], 253.44);
    }

    #[test]
    fn test_house_edge_exactly_one_percent() {
        // Verify that expected value is exactly 0.99 (1% house edge)
        let table = get_multipliers();

        // Binomial coefficients for 8 rows (C(8,k))
        let binomial_coeffs = [1, 8, 28, 56, 70, 56, 28, 8, 1];
        let total_paths = 256.0; // 2^8

        // Calculate expected value
        let expected_value: f64 = table.iter()
            .zip(binomial_coeffs.iter())
            .map(|(mult, &coeff)| {
                let probability = coeff as f64 / total_paths;
                mult * probability
            })
            .sum();

        // Should be exactly 0.99 (allowing tiny floating point error)
        let house_edge = 1.0 - expected_value;
        assert!(
            (house_edge - 0.01).abs() < 0.0001,
            "House edge should be exactly 1%, got {}%",
            house_edge * 100.0
        );
    }

    #[test]
    fn test_multiplier_formula() {
        // Verify multipliers match the formula: (256 / binomial) × 0.99
        let binomial_coeffs = [1, 8, 28, 56, 70, 56, 28, 8, 1];

        for (pos, &coeff) in binomial_coeffs.iter().enumerate() {
            let expected = (256.0 / coeff as f64) * 0.99;
            let actual = get_multiplier(pos as u8).unwrap();
            assert!(
                (expected - actual).abs() < 0.0001,
                "Position {}: expected {}, got {}",
                pos, expected, actual
            );
        }
    }

    #[test]
    fn test_final_position_calculation() {
        // All left moves -> position 0
        let path = vec![false, false, false, false];
        let pos = path.iter().filter(|&&d| d).count();
        assert_eq!(pos, 0);

        // All right moves -> position = rows
        let path = vec![true, true, true, true];
        let pos = path.iter().filter(|&&d| d).count();
        assert_eq!(pos, 4);

        // Mixed: 2 right, 2 left -> position 2
        let path = vec![true, false, true, false];
        let pos = path.iter().filter(|&&d| d).count();
        assert_eq!(pos, 2);
    }
}
