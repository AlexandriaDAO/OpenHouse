import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges, hexToRgb, darken, rgbToCss } from '../colorUtils';

/**
 * FIRE ELEMENT
 *
 * Visual style: Aggressive, flickering - lava/flame inspired
 * Territory: Hot gradient with ember spots and flame wisps
 * Cells: Burning block with flame-like patterns
 */
export const fireRenderer: ElementRenderer = {
  name: 'Fire',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(3);
    const base = hexToRgb(colors.primary);
    const yellow = hexToRgb(colors.secondary);

    // Radial gradient from bright center to darker edges
    const gradient = ctx.createRadialGradient(
      size * 0.5, size * 0.6, 0,
      size * 0.5, size * 0.5, size * 0.7
    );
    gradient.addColorStop(0, rgbToCss(yellow, 0.35));
    gradient.addColorStop(0.4, rgbToCss(base, 0.38));
    gradient.addColorStop(1, rgbToCss(darken(base, 0.2), 0.32));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Ember spots (brighter at bottom, fading up) - more visible
    const numEmbers = Math.floor(size / 5);
    for (let i = 0; i < numEmbers; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 3 + rng() * (size * 0.1);
      const brightness = 1 - (y / size) * 0.4; // Brighter toward bottom

      ctx.fillStyle = rng() > 0.4 ? rgbToCss(base) : rgbToCss(yellow);
      ctx.globalAlpha = (0.2 + rng() * 0.25) * brightness;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flame wisps rising upward
    const numWisps = Math.floor(size / 12);
    for (let i = 0; i < numWisps; i++) {
      const startX = rng() * size;
      const startY = size - rng() * (size * 0.3);
      const endY = rng() * size * 0.4;
      const width = size * 0.04 + rng() * size * 0.08;

      const wispGradient = ctx.createLinearGradient(startX, startY, startX, endY);
      wispGradient.addColorStop(0, rgbToCss(yellow, 0));
      wispGradient.addColorStop(0.5, rgbToCss(yellow, 0.4));
      wispGradient.addColorStop(1, `rgba(255, 255, 200, 0.5)`);

      ctx.fillStyle = wispGradient;
      ctx.beginPath();
      ctx.moveTo(startX - width, startY);
      ctx.quadraticCurveTo(startX, startY - size * 0.15, startX + width * 0.5, endY);
      ctx.quadraticCurveTo(startX, startY - size * 0.1, startX - width, startY);
      ctx.fill();
    }

    // Hot spots - bright white/yellow centers
    const hotspotCount = Math.floor(size / 18);
    for (let i = 0; i < hotspotCount; i++) {
      const x = size * 0.2 + rng() * size * 0.6;
      const y = size * 0.3 + rng() * size * 0.5;
      ctx.fillStyle = `rgba(255, 255, 220, ${0.35 + rng() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.025 + rng() * size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(44);

    // Base fill with upward gradient
    const gradient = ctx.createLinearGradient(0, size, 0, 0);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(0.7, colors.primary);
    gradient.addColorStop(1, colors.secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Flame tips at top
    ctx.fillStyle = colors.secondary;
    ctx.globalAlpha = 0.6;
    const numFlames = Math.max(2, Math.floor(size / 4));
    for (let i = 0; i < numFlames; i++) {
      const x = (size / (numFlames + 1)) * (i + 1) + (rng() - 0.5) * 3;
      const height = size * (0.2 + rng() * 0.2);

      ctx.beginPath();
      ctx.moveTo(x - 2, 0);
      ctx.lineTo(x, -height * 0.5);
      ctx.lineTo(x + 2, 0);
      ctx.fill();
    }

    // Hot spots
    ctx.fillStyle = 'rgba(255, 255, 200, 0.4)';
    const numSpots = Math.max(1, Math.floor(size / 10));
    for (let i = 0; i < numSpots; i++) {
      const x = rng() * size;
      const y = size * 0.6 + rng() * size * 0.3;
      const r = size * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 1.5,
    territoryAmplitude: 2.5,
  },
};
