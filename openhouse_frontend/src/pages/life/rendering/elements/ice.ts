import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges } from '../colorUtils';

/**
 * ICE ELEMENT
 *
 * Visual style: Cold, crystalline
 * Territory: Hexagonal crystals, frost lines
 * Cells: Frost cube with crystal facets
 */
export const iceRenderer: ElementRenderer = {
  name: 'Ice',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(6);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.10;
    ctx.fillRect(0, 0, size, size);

    // Hexagonal crystals
    const numHexes = Math.floor(size / 25);
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;

    for (let i = 0; i < numHexes; i++) {
      const cx = rng() * size;
      const cy = rng() * size;
      const r = 4 + rng() * 8;

      ctx.globalAlpha = 0.06 + rng() * 0.06;
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const angle = (Math.PI / 3) * j;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Frost lines (jagged)
    const numLines = Math.floor(size / 30);
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < numLines; i++) {
      const startX = rng() * size;
      const startY = rng() * size;
      const angle = rng() * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      let x = startX;
      let y = startY;
      for (let j = 0; j < 5; j++) {
        x += Math.cos(angle) * (3 + rng() * 5);
        y += Math.sin(angle) * (3 + rng() * 5);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(47);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Crystal facet lines
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;

    // Diagonal crystal lines
    const numLines = Math.max(2, Math.floor(size / 6));
    for (let i = 0; i < numLines; i++) {
      const offset = (size / numLines) * i;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(size, size - offset);
      ctx.stroke();
    }

    // Frost sparkles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const numSparkles = Math.max(1, Math.floor(size / 10));
    for (let i = 0; i < numSparkles; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = size * 0.03;

      ctx.globalAlpha = 0.4 + rng() * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 0.5,
    territoryAmplitude: 1.5,
  },
};
