//! Cell structure for Game of Life
//!
//! Packed cell structure - 2 bytes total (50% smaller than unpacked)
//! Bits 0-3:   owner (0-15, where 0=unclaimed, 1-10=player ID)
//! Bits 4-10:  points (0-127)
//! Bit 11:     alive

/// Packed cell structure - 2 bytes total
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "candid", derive(candid::CandidType))]
pub struct Cell(u16);

impl Cell {
    /// Create a new cell with owner, points, and alive state
    pub fn new(owner: u8, points: u8, alive: bool) -> Self {
        let mut v = (owner & 0x0F) as u16;
        v |= ((points & 0x7F) as u16) << 4;
        if alive {
            v |= 1 << 11;
        }
        Cell(v)
    }

    /// Get the raw packed value (for serialization)
    #[inline]
    pub fn packed(&self) -> u16 {
        self.0
    }

    /// Create from raw packed value (for deserialization)
    #[inline]
    pub fn from_packed(v: u16) -> Self {
        Cell(v)
    }

    /// Get owner ID (0 = unclaimed, 1-10 = player)
    #[inline]
    pub fn owner(&self) -> u8 {
        (self.0 & 0x0F) as u8
    }

    /// Get points stored in this cell (0-127)
    #[inline]
    pub fn points(&self) -> u8 {
        ((self.0 >> 4) & 0x7F) as u8
    }

    /// Check if cell is alive
    #[inline]
    pub fn alive(&self) -> bool {
        self.0 & (1 << 11) != 0
    }

    /// Set owner ID
    #[inline]
    pub fn set_owner(&mut self, v: u8) {
        self.0 = (self.0 & !0x0F) | (v & 0x0F) as u16;
    }

    /// Set points (clamped to 0-127)
    #[inline]
    pub fn set_points(&mut self, v: u8) {
        self.0 = (self.0 & !0x07F0) | (((v & 0x7F) as u16) << 4);
    }

    /// Set alive state
    #[inline]
    pub fn set_alive(&mut self, v: bool) {
        if v {
            self.0 |= 1 << 11;
        } else {
            self.0 &= !(1 << 11);
        }
    }

    /// Add points (saturating at 127)
    pub fn add_points(&mut self, n: u8) {
        self.set_points(self.points().saturating_add(n).min(127));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_new() {
        let cell = Cell::new(5, 100, true);
        assert_eq!(cell.owner(), 5);
        assert_eq!(cell.points(), 100);
        assert!(cell.alive());
    }

    #[test]
    fn test_cell_default() {
        let cell = Cell::default();
        assert_eq!(cell.owner(), 0);
        assert_eq!(cell.points(), 0);
        assert!(!cell.alive());
    }

    #[test]
    fn test_cell_setters() {
        let mut cell = Cell::default();
        cell.set_owner(7);
        cell.set_points(50);
        cell.set_alive(true);
        assert_eq!(cell.owner(), 7);
        assert_eq!(cell.points(), 50);
        assert!(cell.alive());
    }

    #[test]
    fn test_cell_points_saturation() {
        let mut cell = Cell::new(1, 120, true);
        cell.add_points(20);
        assert_eq!(cell.points(), 127); // Clamped to max
    }

    #[test]
    fn test_cell_packed_roundtrip() {
        let cell = Cell::new(10, 64, true);
        let packed = cell.packed();
        let restored = Cell::from_packed(packed);
        assert_eq!(cell, restored);
    }
}
