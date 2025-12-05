// Plinko board layout constants
// All values are in "design pixels" - scaled uniformly for responsive sizing

export const PIXEL_SCALE = 4;

// Snap to pixel grid
export function snapToPixelGrid(value: number): number {
  return Math.round(value / PIXEL_SCALE) * PIXEL_SCALE;
}

// Pixel art color palette
export const PIXEL_COLORS = {
  BLACK: 0x0a0a14,
  DARK_GRAY: 0x2a2a3e,
  MID_GRAY: 0x4a4a6e,
  LIGHT_GRAY: 0x8888aa,
  WHITE: 0xe8e8e8,
  GOLD: 0xffd700,
  GREEN: 0x22c55e,
  RED: 0xef4444,
} as const;

export const LAYOUT = {
  // Base design dimensions
  BASE_WIDTH: 800,
  BASE_HEIGHT: 700,

  // Peg grid (multiples of PIXEL_SCALE = 4)
  PEG_SPACING_X: 52,
  PEG_SPACING_Y: 56,
  PEG_RADIUS: 8,

  // Ball
  BALL_RADIUS: 12,
  BALL_COLOR: PIXEL_COLORS.GOLD,

  // Drop zone (space above first peg row)
  DROP_ZONE_HEIGHT: 80,

  // Bucket
  BUCKET_WIDTH: 160,
  BUCKET_HEIGHT: 80,
  BUCKET_COLOR: PIXEL_COLORS.DARK_GRAY,
  BUCKET_BORDER_COLOR: PIXEL_COLORS.MID_GRAY,
  TRAPDOOR_COLOR: 0x3a3a5e,

  // Slots
  SLOT_WIDTH: 44,
  SLOT_HEIGHT: 40,
  SLOT_GAP: 4,
  SLOT_Y_OFFSET: 20, // Distance below last peg row

  // Animation timing (ms)
  MS_PER_ROW: 100,
  BALL_STAGGER_MS: 150,
  DOOR_OPEN_DURATION_MS: 300,

  // Colors
  PEG_COLOR: PIXEL_COLORS.WHITE,
  WIN_COLOR: PIXEL_COLORS.GREEN,
  LOSE_COLOR: 0x6b7280, // Gray
  HIGHLIGHT_COLOR: PIXEL_COLORS.GOLD,
} as const;

// Calculate responsive scale factor
export function calculateScale(
  containerWidth: number,
  containerHeight: number,
  rows: number
): number {
  const boardHeight = LAYOUT.DROP_ZONE_HEIGHT + rows * LAYOUT.PEG_SPACING_Y + LAYOUT.SLOT_HEIGHT + 100;
  const scaleX = containerWidth / LAYOUT.BASE_WIDTH;
  const scaleY = containerHeight / boardHeight;
  return Math.min(scaleX, scaleY, 1.2); // Allow slight upscale, cap at 1.2
}

// Calculate board dimensions for given rows
export function getBoardDimensions(rows: number) {
  const pegAreaWidth = rows * LAYOUT.PEG_SPACING_X;
  const width = Math.max(LAYOUT.BASE_WIDTH, pegAreaWidth + 100);
  const height = LAYOUT.DROP_ZONE_HEIGHT + rows * LAYOUT.PEG_SPACING_Y + LAYOUT.SLOT_HEIGHT + 80;
  return { width, height };
}

// Easing function for smooth animation
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Calculate ball X position based on path progress
export function calculateBallX(
  path: boolean[],
  currentRow: number,
  progress: number,
  centerX: number
): number {
  // Count rights up to current row
  const rightsToCurrentRow = path.slice(0, currentRow).filter((v) => v).length;
  const currentX = centerX + (rightsToCurrentRow - currentRow / 2) * LAYOUT.PEG_SPACING_X;

  if (currentRow >= path.length) {
    return currentX;
  }

  // Calculate next position
  const rightsToNextRow = path.slice(0, currentRow + 1).filter((v) => v).length;
  const nextX = centerX + (rightsToNextRow - (currentRow + 1) / 2) * LAYOUT.PEG_SPACING_X;

  // Interpolate with easing
  const easedProgress = easeInOutQuad(progress);
  return currentX + (nextX - currentX) * easedProgress;
}

// Calculate ball Y position
export function calculateBallY(currentRow: number, progress: number): number {
  const baseY = LAYOUT.DROP_ZONE_HEIGHT + currentRow * LAYOUT.PEG_SPACING_Y;
  return baseY + LAYOUT.PEG_SPACING_Y * easeInOutQuad(progress);
}