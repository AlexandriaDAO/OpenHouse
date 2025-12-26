import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges } from '../colorUtils';

/**
 * PLASMA ELEMENT
 *
 * Visual style: Electric, chaotic
 * Territory: Lightning arcs, bright nodes
 * Cells: Energy core with electric streaks
 */
export const plasmaRenderer: ElementRenderer = {
  name: 'Plasma',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(7);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 0, size, size);

    // Electric arcs
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.08;

    const numArcs = Math.floor(size / 20);
    for (let i = 0; i < numArcs; i++) {
      const startX = rng() * size;
      const startY = rng() * size;
      const endX = startX + (rng() - 0.5) * 40;
      const endY = startY + (rng() - 0.5) * 40;

      ctx.beginPath();
      ctx.moveTo(startX, startY);

      // Jagged lightning path
      let x = startX;
      let y = startY;
      const steps = 4 + Math.floor(rng() * 4);
      for (let j = 0; j < steps; j++) {
        const t = (j + 1) / steps;
        x = startX + (endX - startX) * t + (rng() - 0.5) * 10;
        y = startY + (endY - startY) * t + (rng() - 0.5) * 10;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Bright nodes
    const numNodes = Math.floor(size / 30);
    for (let i = 0; i < numNodes; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 2 + rng() * 4;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, colors.secondary);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.1 + rng() * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(48);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Energy core (bright center)
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size * 0.5
    );
    gradient.addColorStop(0, colors.secondary);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, size, size);

    // Electric streaks from center
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    const numStreaks = Math.max(3, Math.floor(size / 5));
    for (let i = 0; i < numStreaks; i++) {
      const angle = (Math.PI * 2 / numStreaks) * i + rng() * 0.5;
      const len = size * 0.4;

      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2);
      let x = size / 2;
      let y = size / 2;
      for (let j = 0; j < 3; j++) {
        x += Math.cos(angle) * (len / 3) + (rng() - 0.5) * 3;
        y += Math.sin(angle) * (len / 3) + (rng() - 0.5) * 3;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 2.0,
    territoryAmplitude: 3,
  },
};
