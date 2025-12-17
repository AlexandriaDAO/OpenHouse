import type { Cell } from '../declarations/life1_backend/life1_backend.did.d';
import { GRID_WIDTH, GRID_HEIGHT, PointTransfer } from './lifeConstants';

/**
 * Parse RLE (Run Length Encoded) pattern format into coordinate array
 * RLE is a standard format for Conway's Game of Life patterns
 */
export function parseRLE(rle: string): [number, number][] {
  const coords: [number, number][] = [];
  const lines = rle.split('\n');
  let patternData = '';
  let width = 0;
  let height = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('x')) {
      const match = trimmed.match(/x\s*=\s*(\d+).*y\s*=\s*(\d+)/);
      if (match) {
        width = parseInt(match[1]);
        height = parseInt(match[2]);
      }
      continue;
    }
    patternData += trimmed;
  }

  let x = 0, y = 0, countStr = '';
  for (const char of patternData) {
    if (char >= '0' && char <= '9') {
      countStr += char;
    } else if (char === 'b') {
      x += countStr ? parseInt(countStr) : 1;
      countStr = '';
    } else if (char === 'o') {
      const count = countStr ? parseInt(countStr) : 1;
      for (let i = 0; i < count; i++) coords.push([x + i, y]);
      x += count;
      countStr = '';
    } else if (char === '$') {
      y += countStr ? parseInt(countStr) : 1;
      x = 0;
      countStr = '';
    } else if (char === '!') break;
  }

  // Center the pattern
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  return coords.map(([cx, cy]) => [cx - centerX, cy - centerY]);
}

/**
 * Rotate pattern coordinates clockwise
 * @param coords - Original pattern coordinates
 * @param rot - Rotation: 0=0°, 1=90°, 2=180°, 3=270° clockwise
 */
export function rotatePattern(coords: [number, number][], rot: number): [number, number][] {
  if (rot === 0) return coords;
  return coords.map(([x, y]) => {
    switch (rot) {
      case 1: return [y, -x];      // 90° clockwise
      case 2: return [-x, -y];     // 180°
      case 3: return [-y, x];      // 270° clockwise
      default: return [x, y];
    }
  });
}

/**
 * Local Game of Life simulation - mirrors backend rules exactly
 * Returns new cells and point transfers for optimistic balance updates
 */
export function stepLocalGeneration(cells: Cell[]): { cells: Cell[], transfers: PointTransfer[] } {
  const newCells: Cell[] = new Array(GRID_WIDTH * GRID_HEIGHT);
  const transfers: PointTransfer[] = [];

  for (let row = 0; row < GRID_HEIGHT; row++) {
    for (let col = 0; col < GRID_WIDTH; col++) {
      const idx = row * GRID_WIDTH + col;
      const current = cells[idx];

      // Count neighbors and track owner counts
      let neighborCount = 0;
      const ownerCounts: number[] = new Array(11).fill(0); // 0-10 players

      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;

          // Toroidal wrap
          const nRow = (row + di + GRID_HEIGHT) % GRID_HEIGHT;
          const nCol = (col + dj + GRID_WIDTH) % GRID_WIDTH;
          const neighbor = cells[nRow * GRID_WIDTH + nCol];

          if (neighbor.alive) {
            neighborCount++;
            if (neighbor.owner > 0 && neighbor.owner <= 10) {
              ownerCounts[neighbor.owner]++;
            }
          }
        }
      }

      // Apply Conway's rules
      let newAlive = false;
      let newOwner = current.owner;

      if (current.alive) {
        // Living cell survives with 2-3 neighbors
        newAlive = neighborCount === 2 || neighborCount === 3;
      } else {
        // Dead cell born with exactly 3 neighbors
        if (neighborCount === 3) {
          newAlive = true;
          // New owner = majority owner among parents
          let maxCount = 0;
          let majorityOwner = 1;
          for (let o = 1; o <= 10; o++) {
            if (ownerCounts[o] > maxCount) {
              maxCount = ownerCounts[o];
              majorityOwner = o;
            }
          }
          newOwner = majorityOwner;
        }
      }

      // Territory capture with point collection (mirrors backend logic)
      let newPoints = current.points;
      const oldOwner = current.owner;

      // If cell ownership changed and cell had points from previous owner, collect them
      if (current.points > 0 && oldOwner > 0 && newOwner !== oldOwner) {
        // Points go to the new owner
        transfers.push([newOwner, current.points]);
        newPoints = 0; // Clear points from cell
      }

      newCells[idx] = {
        owner: newOwner,
        points: newPoints,
        alive: newAlive,
      };
    }
  }

  return { cells: newCells, transfers };
}
