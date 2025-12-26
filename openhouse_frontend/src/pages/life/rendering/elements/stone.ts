import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges } from '../colorUtils';

/**
 * STONE ELEMENT
 *
 * Visual style: Solid, cracked
 * Territory: Angular cracks, rocky texture
 * Cells: Rough hewn block
 */
export const stoneRenderer: ElementRenderer = {
  name: 'Stone',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(4);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 0, size, size);

    // Rocky patches (irregular shapes)
    const numPatches = Math.floor(size / 12);
    for (let i = 0; i < numPatches; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const w = 4 + rng() * (size * 0.15);
      const h = 4 + rng() * (size * 0.12);

      ctx.fillStyle = rng() > 0.5 ? colors.primary : colors.secondary;
      ctx.globalAlpha = 0.06 + rng() * 0.08;
      ctx.fillRect(x, y, w, h);
    }

    // Cracks
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.08;

    const numCracks = Math.floor(size / 25);
    for (let i = 0; i < numCracks; i++) {
      const startX = rng() * size;
      const startY = rng() * size;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      let x = startX;
      let y = startY;
      const segments = 3 + Math.floor(rng() * 4);
      for (let j = 0; j < segments; j++) {
        x += (rng() - 0.5) * 15;
        y += (rng() - 0.5) * 15;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(45);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Stone texture (small rectangles)
    const numRects = Math.max(2, Math.floor(size / 4));
    for (let i = 0; i < numRects; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const w = 2 + rng() * (size * 0.3);
      const h = 2 + rng() * (size * 0.2);

      ctx.fillStyle = colors.secondary;
      ctx.globalAlpha = 0.2 + rng() * 0.2;
      ctx.fillRect(x, y, w, h);
    }

    // Crack lines
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    if (size >= 12) {
      const numCracks = Math.floor(rng() * 3);
      for (let i = 0; i < numCracks; i++) {
        const startX = rng() * size;
        const startY = rng() * size;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(startX + (rng() - 0.5) * 8, startY + (rng() - 0.5) * 8);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 0.4,
    territoryAmplitude: 1,
  },
};
