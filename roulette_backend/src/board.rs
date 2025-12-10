// European Roulette Board Layout and Validation

use crate::types::Color;

pub const RED_NUMBERS: [u8; 18] = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
pub const BLACK_NUMBERS: [u8; 18] = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

/// Get the color of a roulette number
pub fn get_color(n: u8) -> Color {
    if n == 0 {
        Color::Green
    } else if RED_NUMBERS.contains(&n) {
        Color::Red
    } else {
        Color::Black
    }
}

/// Get the column (1, 2, or 3) for a number. Zero has no column.
/// Column 1: 1,4,7,10,13,16,19,22,25,28,31,34
/// Column 2: 2,5,8,11,14,17,20,23,26,29,32,35
/// Column 3: 3,6,9,12,15,18,21,24,27,30,33,36
pub fn get_column(n: u8) -> Option<u8> {
    if n == 0 {
        None
    } else {
        Some(((n - 1) % 3) + 1)
    }
}

/// Get the dozen (1, 2, or 3) for a number. Zero has no dozen.
/// Dozen 1: 1-12, Dozen 2: 13-24, Dozen 3: 25-36
pub fn get_dozen(n: u8) -> Option<u8> {
    if n == 0 {
        None
    } else {
        Some(((n - 1) / 12) + 1)
    }
}

/// Check if two numbers form a valid split bet (adjacent on the board)
/// The roulette board layout:
/// Row 1:  3  6  9 12 15 18 21 24 27 30 33 36
/// Row 2:  2  5  8 11 14 17 20 23 26 29 32 35
/// Row 3:  1  4  7 10 13 16 19 22 25 28 31 34
/// Zero is above and can split with 1, 2, or 3
pub fn is_valid_split(a: u8, b: u8) -> bool {
    if a > 36 || b > 36 || a == b {
        return false;
    }

    let (min, max) = if a < b { (a, b) } else { (b, a) };

    // Special case: 0 can split with 1, 2, or 3
    if min == 0 {
        return max <= 3;
    }

    // Horizontal split: numbers differ by 3 (adjacent columns in same row)
    if max - min == 3 {
        return true;
    }

    // Vertical split: consecutive numbers in same column (differ by 1, but must be in same triplet row)
    if max - min == 1 {
        // They must be in the same "street" group (1-3, 4-6, 7-9, etc.)
        // min and max are in the same street if (min-1)/3 == (max-1)/3
        return (min - 1) / 3 == (max - 1) / 3;
    }

    false
}

/// Check if a number is a valid street start (first number of a row of 3)
/// Valid starts: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
pub fn is_valid_street(start: u8) -> bool {
    start >= 1 && start <= 34 && (start - 1) % 3 == 0
}

/// Check if a number is a valid corner top-left
/// A corner bet covers 4 numbers in a 2x2 square on the board
/// Valid corners are where the top-left allows a 2x2 square
pub fn is_valid_corner(top_left: u8) -> bool {
    if top_left == 0 || top_left > 32 {
        return false;
    }

    // The corner's top-left must be in column 1 or 2 (not column 3)
    // and must be in a row that has a row below it
    let col = get_column(top_left).unwrap_or(0);
    if col == 3 {
        return false;
    }

    // Also need to check that top_left + 3 is valid (same "row pair")
    // The pairs are: (1,4), (4,7), (7,10), etc.
    // top_left must be 1,2,4,5,7,8,10,11,13,14,16,17,19,20,22,23,25,26,28,29,31,32
    // Basically: column 1 or 2, and not in the last street (34-36)

    // Simpler check: top_left in column 1 or 2, and top_left + 3 <= 36
    top_left + 3 <= 36
}

/// Check if a number is a valid six-line start (first number of two consecutive rows)
/// Valid starts: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31
pub fn is_valid_six_line(start: u8) -> bool {
    start >= 1 && start <= 31 && (start - 1) % 3 == 0
}

/// Get the three numbers in a street
pub fn get_street_numbers(start: u8) -> [u8; 3] {
    [start, start + 1, start + 2]
}

/// Get the four numbers in a corner
pub fn get_corner_numbers(top_left: u8) -> [u8; 4] {
    [top_left, top_left + 1, top_left + 3, top_left + 4]
}

/// Get the six numbers in a six-line
pub fn get_six_line_numbers(start: u8) -> [u8; 6] {
    [start, start + 1, start + 2, start + 3, start + 4, start + 5]
}

/// Get all 12 numbers in a column
pub fn get_column_numbers(col: u8) -> [u8; 12] {
    let mut nums = [0u8; 12];
    for i in 0..12 {
        nums[i] = col + (i as u8 * 3);
    }
    nums
}

/// Get all 12 numbers in a dozen
pub fn get_dozen_numbers(dozen: u8) -> [u8; 12] {
    let start = (dozen - 1) * 12 + 1;
    let mut nums = [0u8; 12];
    for i in 0..12 {
        nums[i] = start + i as u8;
    }
    nums
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_colors() {
        assert_eq!(get_color(0), Color::Green);
        assert_eq!(get_color(1), Color::Red);
        assert_eq!(get_color(2), Color::Black);
        assert_eq!(get_color(3), Color::Red);
        assert_eq!(get_color(17), Color::Black);
        assert_eq!(get_color(36), Color::Red);
    }

    #[test]
    fn test_columns() {
        assert_eq!(get_column(0), None);
        assert_eq!(get_column(1), Some(1));
        assert_eq!(get_column(2), Some(2));
        assert_eq!(get_column(3), Some(3));
        assert_eq!(get_column(4), Some(1));
        assert_eq!(get_column(36), Some(3));
    }

    #[test]
    fn test_dozens() {
        assert_eq!(get_dozen(0), None);
        assert_eq!(get_dozen(1), Some(1));
        assert_eq!(get_dozen(12), Some(1));
        assert_eq!(get_dozen(13), Some(2));
        assert_eq!(get_dozen(24), Some(2));
        assert_eq!(get_dozen(25), Some(3));
        assert_eq!(get_dozen(36), Some(3));
    }

    #[test]
    fn test_valid_splits() {
        // 0 with 1, 2, 3
        assert!(is_valid_split(0, 1));
        assert!(is_valid_split(0, 2));
        assert!(is_valid_split(0, 3));
        assert!(!is_valid_split(0, 4));

        // Horizontal splits (differ by 3)
        assert!(is_valid_split(1, 4));
        assert!(is_valid_split(2, 5));
        assert!(is_valid_split(33, 36));

        // Vertical splits (differ by 1, same street)
        assert!(is_valid_split(1, 2));
        assert!(is_valid_split(2, 3));
        assert!(!is_valid_split(3, 4)); // Different streets

        // Invalid
        assert!(!is_valid_split(1, 5));
        assert!(!is_valid_split(1, 1));
        assert!(!is_valid_split(37, 38));
    }

    #[test]
    fn test_valid_street() {
        assert!(is_valid_street(1));
        assert!(is_valid_street(4));
        assert!(is_valid_street(34));
        assert!(!is_valid_street(0));
        assert!(!is_valid_street(2));
        assert!(!is_valid_street(35));
    }

    #[test]
    fn test_valid_corner() {
        assert!(is_valid_corner(1));
        assert!(is_valid_corner(2));
        assert!(!is_valid_corner(3)); // Column 3
        assert!(is_valid_corner(4));
        assert!(is_valid_corner(32));
        assert!(!is_valid_corner(33)); // Column 3
        assert!(!is_valid_corner(34)); // Would go beyond 36
        assert!(!is_valid_corner(0));
    }

    #[test]
    fn test_column_numbers() {
        let col1 = get_column_numbers(1);
        assert_eq!(col1, [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34]);

        let col3 = get_column_numbers(3);
        assert_eq!(col3, [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
    }

    #[test]
    fn test_dozen_numbers() {
        let dozen1 = get_dozen_numbers(1);
        assert_eq!(dozen1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

        let dozen3 = get_dozen_numbers(3);
        assert_eq!(dozen3, [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
    }
}
