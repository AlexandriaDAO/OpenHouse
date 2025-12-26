import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges, hexToRgb, darken, rgbToCss } from '../colorUtils';

/**
 * EARTH ELEMENT
 *
 * Visual style: Organic, soil-like - Minecraft dirt block inspired
 * Territory: Rich brown soil with grass patches and organic texture
 * Cells: Mossy block with organic spots
 */
export const earthRenderer: ElementRenderer = {
  name: 'Earth',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(1);
    const base = hexToRgb(colors.primary);
    const green = hexToRgb(colors.secondary);

    // Rich base brown fill - much higher opacity for visible territory
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, size, size);

    // Soil variation - darker brown blotches for depth
    const blotchCount = Math.floor(size / 8);
    for (let i = 0; i < blotchCount; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const blotchSize = size * 0.08 + rng() * size * 0.12;
      ctx.fillStyle = rgbToCss(darken(base, 0.15 + rng() * 0.15));
      ctx.globalAlpha = 0.25 + rng() * 0.2;
      ctx.beginPath();
      ctx.arc(x, y, blotchSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Green grass/moss patches scattered throughout (more visible on top half)
    const grassPatches = Math.floor(size / 10);
    for (let i = 0; i < grassPatches; i++) {
      const x = rng() * size;
      const y = rng() * size * 0.6; // Mostly on top portion
      const patchSize = size * 0.06 + rng() * size * 0.1;
      ctx.fillStyle = rgbToCss(green, 0.4 + rng() * 0.25);
      ctx.beginPath();
      ctx.arc(x, y, patchSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Small dirt particles for texture
    const particleCount = Math.floor(size / 5);
    for (let i = 0; i < particleCount; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const particleSize = 1 + rng() * 2;
      ctx.fillStyle = rng() > 0.5
        ? rgbToCss(darken(base, 0.2), 0.3)
        : rgbToCss(base, 0.4);
      ctx.beginPath();
      ctx.arc(x, y, particleSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(42);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Organic spots
    const numSpots = Math.max(2, Math.floor(size / 6));
    for (let i = 0; i < numSpots; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = size * (0.1 + rng() * 0.15);

      ctx.fillStyle = colors.secondary;
      ctx.globalAlpha = 0.3 + rng() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 0.8,
    territoryAmplitude: 1.5,
  },
};
