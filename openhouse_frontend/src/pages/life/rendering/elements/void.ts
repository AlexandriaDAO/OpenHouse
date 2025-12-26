import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';
import { add3DEdges } from '../colorUtils';

/**
 * VOID ELEMENT
 *
 * Visual style: Dark, consuming
 * Territory: Inward spirals, dark pools
 * Cells: Dark matter with subtle depth
 */
export const voidRenderer: ElementRenderer = {
  name: 'Void',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(8);

    // Base fill (slightly darker)
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.15;
    ctx.fillRect(0, 0, size, size);

    // Dark pools (circular gradients fading inward)
    const numPools = Math.floor(size / 25);
    for (let i = 0; i < numPools; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 8 + rng() * (size * 0.12);

      const gradient = ctx.createRadialGradient(x, y, r, x, y, 0);
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, colors.secondary);

      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.08 + rng() * 0.06;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spiral hints
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.04;

    const numSpirals = Math.floor(size / 40);
    for (let i = 0; i < numSpirals; i++) {
      const cx = rng() * size;
      const cy = rng() * size;

      ctx.beginPath();
      for (let t = 0; t < Math.PI * 4; t += 0.2) {
        const r = t * 2;
        const x = cx + r * Math.cos(t);
        const y = cy + r * Math.sin(t);
        if (t === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(49);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Dark vortex center
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, size * 0.4,
      size / 2, size / 2, 0
    );
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, colors.secondary);
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, 0, size, size);

    // Subtle depth particles
    ctx.fillStyle = colors.secondary;
    const numParticles = Math.max(2, Math.floor(size / 8));
    for (let i = 0; i < numParticles; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * size * 0.3;
      const x = size / 2 + Math.cos(angle) * dist;
      const y = size / 2 + Math.sin(angle) * dist;
      const r = size * 0.04;

      ctx.globalAlpha = 0.2 + rng() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 0.6,
    territoryAmplitude: 2,
  },
};
