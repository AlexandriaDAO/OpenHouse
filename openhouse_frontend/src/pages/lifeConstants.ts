// Grid dimensions - 512x512 divided into 16 quadrants of 128x128
export const GRID_SIZE = 512;
export const QUADRANT_SIZE = 128;
export const QUADRANTS_PER_ROW = 4;
export const TOTAL_QUADRANTS = 16;

// Legacy constants for backend compatibility
export const GRID_WIDTH = GRID_SIZE;
export const GRID_HEIGHT = GRID_SIZE;

// Quadrant domination constants
export const QUADRANT_CELLS = QUADRANT_SIZE * QUADRANT_SIZE; // 16,384
export const DOMINATION_THRESHOLD = 0.90; // 90% to wipe
export const LOCK_THRESHOLD = 0.50; // 50% to maintain lock
export const QUADRANT_POLL_INTERVAL = 5000; // Poll quadrant states every 5 seconds

// Simulation timing
export const LOCAL_TICK_MS = 100;      // Local simulation: 10 generations/second
export const BACKEND_SYNC_MS = 5000;   // Sync with backend every 5 seconds

// Rendering constants
export const GRID_COLOR = 'rgba(255, 255, 255, 0.08)';

// Swipe detection
export const SWIPE_THRESHOLD = 50;
export const DEAD_COLOR = '#000000';

// Gold border for cells with points
export const GOLD_BORDER_MIN_OPACITY = 0.3;
export const GOLD_BORDER_MAX_OPACITY = 1.0;

// Canister ID
export const LIFE1_CANISTER_ID = 'pijnb-7yaaa-aaaae-qgcuq-cai';

// View modes
export type ViewMode = 'overview' | 'quadrant';

// Pattern types - re-exported from organized pattern library
export type { PatternInfo, PatternCategory } from './life/patterns';
export { PATTERNS, CATEGORY_INFO, getPatternsByCategory, getPatternByName } from './life/patterns';

// Legacy category type alias for backwards compatibility
export type LegacyPatternCategory = 'gun' | 'spaceship' | 'defense' | 'bomb' | 'oscillator';

// Batch placement support
export interface PendingPlacement {
  id: string;
  cells: [number, number][];
  patternName: string;
  centroid: [number, number]; // For display purposes
}

// Point transfers from territory capture: [playerNum, pointsGained]
export type PointTransfer = [number, number];

// 10 Player colors
export const PLAYER_COLORS: Record<number, string> = {
  1: '#39FF14',  // Neon Green
  2: '#FF3939',  // Red
  3: '#3939FF',  // Blue
  4: '#FFD700',  // Gold
  5: '#FF39FF',  // Magenta
  6: '#39FFFF',  // Cyan
  7: '#FF8C00',  // Orange
  8: '#8B5CF6',  // Purple
  9: '#F472B6',  // Pink
  10: '#A3E635', // Lime
};

export const TERRITORY_COLORS: Record<number, string> = {
  1: 'rgba(57, 255, 20, 0.15)',
  2: 'rgba(255, 57, 57, 0.15)',
  3: 'rgba(57, 57, 255, 0.15)',
  4: 'rgba(255, 215, 0, 0.15)',
  5: 'rgba(255, 57, 255, 0.15)',
  6: 'rgba(57, 255, 255, 0.15)',
  7: 'rgba(255, 140, 0, 0.15)',
  8: 'rgba(139, 92, 246, 0.15)',
  9: 'rgba(244, 114, 182, 0.15)',
  10: 'rgba(163, 230, 53, 0.15)',
};

// Note: CATEGORY_INFO and PATTERNS are now imported from './life/patterns'
// See src/pages/life/patterns/ for the organized pattern library
