// Procedural texture generation for territory cells
// Creates animated, randomized visual elements based on elemental themes

// Simple hash function for deterministic randomness per cell
function hashCell(x: number, y: number, seed: number = 0): number {
  let h = seed;
  h = Math.imul(h ^ x, 0x9e3779b9);
  h = Math.imul(h ^ y, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
  return (h >>> 0) / 0xffffffff; // Normalize to 0-1
}

// Generate multiple hash values from one cell position
function hashCellMulti(x: number, y: number, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(hashCell(x, y, i * 12345));
  }
  return values;
}

// Element configurations for different territory types
export interface ElementConfig {
  primaryColor: string;
  secondaryColor: string;
  circleCount: number;       // Number of circles per cell
  minRadius: number;         // Min circle radius (fraction of cell size)
  maxRadius: number;         // Max circle radius (fraction of cell size)
  animationSpeed: number;    // How fast elements move (0-1)
  pulseAmount: number;       // How much circles grow/shrink (0-1)
}

// Default configs for player and enemy (can be extended with REGIONS later)
export const PLAYER_ELEMENT: ElementConfig = {
  primaryColor: 'rgba(34, 139, 34, 0.25)',    // Forest green
  secondaryColor: 'rgba(139, 69, 19, 0.2)',   // Brown
  circleCount: 4,
  minRadius: 0.15,
  maxRadius: 0.4,
  animationSpeed: 0.3,
  pulseAmount: 0.15,
};

export const ENEMY_ELEMENT: ElementConfig = {
  primaryColor: 'rgba(255, 69, 0, 0.25)',     // Orange red
  secondaryColor: 'rgba(255, 215, 0, 0.2)',   // Gold
  circleCount: 4,
  minRadius: 0.15,
  maxRadius: 0.35,
  animationSpeed: 0.4,
  pulseAmount: 0.2,
};

// Parse a color string and return rgba components
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]),
      g: parseInt(rgbaMatch[2]),
      b: parseInt(rgbaMatch[3]),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }
  // Fallback
  return { r: 100, g: 100, b: 100, a: 0.2 };
}

// Interpolate between two colors
function lerpColor(color1: string, color2: string, t: number): string {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  const a = c1.a + (c2.a - c1.a) * t;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Draw a single cell's procedural texture
export function drawProceduralCell(
  ctx: CanvasRenderingContext2D,
  cellX: number,
  cellY: number,
  pixelX: number,
  pixelY: number,
  cellSize: number,
  config: ElementConfig,
  time: number
): void {
  const hashes = hashCellMulti(cellX, cellY, config.circleCount * 5);

  // Draw each circle
  for (let i = 0; i < config.circleCount; i++) {
    const baseIdx = i * 5;

    // Base position (0-1 within cell)
    const basePosX = hashes[baseIdx];
    const basePosY = hashes[baseIdx + 1];

    // Animation offset based on time
    const animPhase = hashes[baseIdx + 2] * Math.PI * 2;
    const animSpeed = config.animationSpeed * (0.5 + hashes[baseIdx + 3] * 0.5);

    // Animated position
    const offsetX = Math.sin(time * animSpeed + animPhase) * 0.1;
    const offsetY = Math.cos(time * animSpeed * 1.3 + animPhase) * 0.1;

    const posX = ((basePosX + offsetX) % 1 + 1) % 1; // Keep in 0-1 range
    const posY = ((basePosY + offsetY) % 1 + 1) % 1;

    // Animated radius
    const baseRadius = config.minRadius + hashes[baseIdx + 4] * (config.maxRadius - config.minRadius);
    const pulsePhase = hashes[baseIdx] * Math.PI * 2;
    const pulse = Math.sin(time * 0.5 + pulsePhase) * config.pulseAmount;
    const radius = baseRadius * (1 + pulse);

    // Color - alternate between primary and secondary based on hash
    const useSecondary = hashes[baseIdx + 2] > 0.6;
    const colorT = hashes[baseIdx + 3];
    const color = useSecondary
      ? lerpColor(config.secondaryColor, config.primaryColor, colorT * 0.3)
      : lerpColor(config.primaryColor, config.secondaryColor, colorT * 0.3);

    // Draw the circle
    const centerX = pixelX + posX * cellSize;
    const centerY = pixelY + posY * cellSize;
    const radiusPixels = radius * cellSize;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radiusPixels, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// Draw territory with procedural textures (batch version for performance)
export function drawProceduralTerritory(
  ctx: CanvasRenderingContext2D,
  cells: { territory: number }[][],
  cellSize: number,
  time: number,
  playerConfig: ElementConfig = PLAYER_ELEMENT,
  enemyConfig: ElementConfig = ENEMY_ELEMENT,
  playerId: number = 1,
  enemyId: number = 2,
  skipCells?: Set<string> // Optional set of "x,y" strings to skip (e.g., for fading effect)
): void {
  const height = cells.length;
  const width = cells[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const territory = cells[y][x].territory;
      if (territory === 0) continue;

      // Skip if in the skip set
      if (skipCells?.has(`${x},${y}`)) continue;

      const config = territory === playerId ? playerConfig : enemyConfig;
      const pixelX = x * cellSize;
      const pixelY = y * cellSize;

      // Draw background (slightly darker base)
      const baseAlpha = territory === playerId ? 0.08 : 0.08;
      ctx.fillStyle = territory === playerId
        ? `rgba(34, 139, 34, ${baseAlpha})`
        : `rgba(255, 69, 0, ${baseAlpha})`;
      ctx.fillRect(pixelX, pixelY, cellSize, cellSize);

      // Draw procedural elements
      drawProceduralCell(ctx, x, y, pixelX, pixelY, cellSize, config, time);
    }
  }
}

// Simpler version: just draw variation without full procedural circles
// Uses color modulation for a more subtle effect
export function drawVariedTerritory(
  ctx: CanvasRenderingContext2D,
  cells: { territory: number }[][],
  cellSize: number,
  time: number,
  playerId: number = 1,
  enemyId: number = 2,
  skipCells?: Set<string>
): void {
  const height = cells.length;
  const width = cells[0]?.length || 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const territory = cells[y][x].territory;
      if (territory === 0) continue;
      if (skipCells?.has(`${x},${y}`)) continue;

      // Get deterministic variation for this cell
      const hash = hashCell(x, y, 0);
      const hash2 = hashCell(x, y, 1);

      // Time-based variation
      const timeFactor = Math.sin(time * 0.3 + hash * Math.PI * 2) * 0.5 + 0.5;

      // Base alpha varies per cell
      const baseAlpha = 0.1 + hash * 0.08;
      const animatedAlpha = baseAlpha + timeFactor * 0.04;

      if (territory === playerId) {
        // Green with brown undertones
        const greenAmount = 0.7 + hash2 * 0.3;
        const r = Math.round(34 + (139 - 34) * (1 - greenAmount));
        const g = Math.round(139 * greenAmount + 69 * (1 - greenAmount));
        const b = Math.round(34 * greenAmount + 19 * (1 - greenAmount));
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${animatedAlpha})`;
      } else {
        // Red with gold undertones
        const redAmount = 0.6 + hash2 * 0.4;
        const r = 255;
        const g = Math.round(69 * redAmount + 215 * (1 - redAmount));
        const b = Math.round(redAmount * 0);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${animatedAlpha})`;
      }

      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }
}
