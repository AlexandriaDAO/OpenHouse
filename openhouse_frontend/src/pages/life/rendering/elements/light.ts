import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges } from '../colorUtils';

/**
 * LIGHT ELEMENT
 *
 * Visual style: Radiant, glowing
 * Territory: Soft radial glows, star points
 * Cells: Pure crystal with sparkles
 */
export const lightRenderer: ElementRenderer = {
  name: 'Light',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(5);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.10;
    ctx.fillRect(0, 0, size, size);

    // Radial glows
    const numGlows = Math.floor(size / 20);
    for (let i = 0; i < numGlows; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 6 + rng() * (size * 0.15);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, colors.secondary);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.08 + rng() * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Star points
    const numStars = Math.floor(size / 30);
    ctx.fillStyle = colors.secondary;
    for (let i = 0; i < numStars; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 1 + rng() * 2;

      ctx.globalAlpha = 0.1 + rng() * 0.1;
      ctx.beginPath();
      // Four-point star
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.3, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.3, y);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x, y + r * 0.3);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y - r * 0.3);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(46);

    // Radial gradient fill (glowing from center)
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size * 0.7
    );
    gradient.addColorStop(0, colors.secondary);
    gradient.addColorStop(1, colors.primary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Sparkle points
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    const numSparkles = Math.max(1, Math.floor(size / 8));
    for (let i = 0; i < numSparkles; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = size * 0.04;

      ctx.globalAlpha = 0.5 + rng() * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 1.0,
    territoryAmplitude: 2,
  },
};
