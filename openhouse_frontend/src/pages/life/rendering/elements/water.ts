import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges, hexToRgb, lighten, darken, rgbToCss } from '../colorUtils';

/**
 * WATER ELEMENT
 *
 * Visual style: Fluid, rippling - ocean/pool water inspired
 * Territory: Gradient depth with wave patterns and shimmer
 * Cells: Liquid cube with wave patterns
 */
export const waterRenderer: ElementRenderer = {
  name: 'Water',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(2);
    const base = hexToRgb(colors.primary);

    // Gradient from lighter top to darker bottom (depth effect)
    const gradient = ctx.createLinearGradient(0, 0, 0, size);
    gradient.addColorStop(0, rgbToCss(lighten(base, 0.15), 0.35));
    gradient.addColorStop(0.5, rgbToCss(base, 0.38));
    gradient.addColorStop(1, rgbToCss(darken(base, 0.15), 0.4));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Horizontal wave lines - more prominent
    const numWaves = Math.floor(size / 16);
    ctx.strokeStyle = rgbToCss(lighten(base, 0.25));
    ctx.lineWidth = 2;

    for (let i = 0; i < numWaves; i++) {
      const y = (size / numWaves) * i + size * 0.1;
      const amplitude = 3 + rng() * 4;
      const frequency = 0.04 + rng() * 0.03;

      ctx.globalAlpha = 0.25 + rng() * 0.15;
      ctx.beginPath();
      for (let x = 0; x < size; x += 2) {
        const waveY = y + Math.sin(x * frequency + i * 0.5) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, waveY);
        } else {
          ctx.lineTo(x, waveY);
        }
      }
      ctx.stroke();
    }

    // Shimmer highlights - white sparkles on surface
    const shimmerCount = Math.floor(size / 12);
    for (let i = 0; i < shimmerCount; i++) {
      const x = rng() * size;
      const y = rng() * size * 0.5; // Mostly on top half
      ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + rng() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.02, size * 0.008, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bubbles rising from bottom
    const numBubbles = Math.floor(size / 12);
    for (let i = 0; i < numBubbles; i++) {
      const x = rng() * size;
      const y = size * 0.5 + rng() * size * 0.5; // Bottom half
      const r = 2 + rng() * 4;

      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + rng() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(43);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Wave pattern overlay
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;

    const numLines = Math.max(2, Math.floor(size / 5));
    for (let i = 0; i < numLines; i++) {
      const y = (size / (numLines + 1)) * (i + 1);
      ctx.beginPath();
      for (let x = 0; x < size; x += 2) {
        const waveY = y + Math.sin(x * 0.3 + i) * 1.5;
        if (x === 0) {
          ctx.moveTo(x, waveY);
        } else {
          ctx.lineTo(x, waveY);
        }
      }
      ctx.stroke();
    }

    // Small bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    const numBubbles = Math.max(1, Math.floor(size / 8));
    for (let i = 0; i < numBubbles; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = size * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 1.2,
    territoryAmplitude: 3,
  },
};
