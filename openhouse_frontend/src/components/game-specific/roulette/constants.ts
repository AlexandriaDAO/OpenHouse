export const EUROPEAN_LAYOUT = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

export const TABLE_LAYOUT = {
  WIDTH: 800,
  HEIGHT: 400,
  PADDING: 20,

  GRID: {
    X: 120,
    Y: 60,
    CELL_WIDTH: 40,
    CELL_HEIGHT: 50,
    ROWS: 3,
    COLS: 12,
  },

  ZERO: {
    X: 80, // Moved left to fit zero
    Y: 60,
    WIDTH: 40,
    HEIGHT: 150, // Spans 3 rows
  },

  OUTSIDE_BOTTOM: { // Columns
    X: 120,
    Y: 210,
    HEIGHT: 40,
  },

  OUTSIDE_SIDE: { // Dozens, Low/High, Even/Odd, Red/Black
    X: 120,
    Y: 260, // Below columns
    ROW_HEIGHT: 40,
  },
};

// Animation constants
export const SPIN_DURATION = 2500; // 2.5 seconds
export const TOTAL_ROTATIONS = 5;

// Color theme
export const THEME = {
  numberRed: '#ED0047',
  numberBlack: '#000000',
  numberGreen: '#00E19B',
  accentGlow: '#39FF14',
  table: '#0a0a14',
};

export function getNumberColor(num: number): string {
  if (num === 0) return THEME.numberGreen;
  if (RED_NUMBERS.includes(num)) return THEME.numberRed;
  return THEME.numberBlack;
}

export function getAngleForNumber(num: number): number {
  const index = EUROPEAN_LAYOUT.indexOf(num);
  if (index === -1) return 0;
  // -90 degrees because 0 is usually at the top (12 o'clock)
  // But in canvas arc, 0 is at 3 o'clock.
  // We want index 0 to be at -90 degrees.
  const anglePerPocket = 360 / 37;
  return index * anglePerPocket;
}
