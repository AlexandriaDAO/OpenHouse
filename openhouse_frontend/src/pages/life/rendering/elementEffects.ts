/**
 * Element Visual Effects
 *
 * Renders animated overlays on top of alive cells based on their element type.
 * These effects run in the main render loop and are designed for performance.
 *
 * Effects per element:
 * - Fire: Flickering glow, ember particles
 * - Water: Shimmer/wave animation
 * - Plasma: Electric crackle effect
 * - Light: Radiant pulse
 * - Ice: Crystalline sparkle
 * - Void: Dark energy wisps
 * - Earth: Subtle grass sway
 * - Stone: None (static fits theme)
 */

import { seededRandom } from './seededRandom';

/** Effect configuration for each element type */
interface ElementEffect {
  /** Render the animated effect for a cell */
  render(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    time: number,
    cellSeed: number
  ): void;
}

// ============================================================================
// FIRE EFFECT - Flickering glow, ember particles
// ============================================================================
const fireEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    // Skip effect on very small cells
    if (size < 4) return;

    // Flicker intensity based on time (unique per cell)
    const flickerPhase = time * 3 + rng() * Math.PI * 2;
    const flicker = 0.3 + Math.sin(flickerPhase) * 0.15 + Math.sin(flickerPhase * 2.7) * 0.1;

    // Ember glow overlay
    ctx.save();
    ctx.globalAlpha = flicker * 0.4;
    ctx.globalCompositeOperation = 'lighter';

    // Warm glow gradient
    const gradient = ctx.createRadialGradient(
      x + size * 0.5, y + size * 0.6, 0,
      x + size * 0.5, y + size * 0.5, size * 0.6
    );
    gradient.addColorStop(0, '#FFD700');
    gradient.addColorStop(0.5, '#FF4500');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);

    // Ember particles (only on larger cells)
    if (size >= 8) {
      const emberCount = Math.floor(size / 8);
      for (let i = 0; i < emberCount; i++) {
        const emberRng = seededRandom(cellSeed + i * 100);
        const emberPhase = time * (2 + emberRng() * 2) + emberRng() * Math.PI * 2;
        const emberY = y + size * (0.8 - (emberPhase % 1) * 0.6);
        const emberX = x + size * (0.2 + emberRng() * 0.6) + Math.sin(emberPhase * 3) * 2;
        const emberAlpha = Math.max(0, 0.8 - (emberPhase % 1));

        ctx.globalAlpha = emberAlpha * flicker;
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(emberX, emberY, 1 + size * 0.03, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },
};

// ============================================================================
// WATER EFFECT - Shimmer/wave animation
// ============================================================================
const waterEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    if (size < 4) return;

    // Wave phase unique to cell
    const wavePhase = time * 2 + rng() * Math.PI * 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Shimmer highlights
    const shimmerCount = Math.max(1, Math.floor(size / 6));
    for (let i = 0; i < shimmerCount; i++) {
      const shimmerRng = seededRandom(cellSeed + i * 50);
      const shimmerX = x + shimmerRng() * size;
      const shimmerY = y + shimmerRng() * size * 0.5;
      const shimmerPhase = wavePhase + shimmerRng() * Math.PI;
      const shimmerAlpha = (0.3 + Math.sin(shimmerPhase) * 0.3) * 0.6;

      ctx.globalAlpha = shimmerAlpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(shimmerX, shimmerY, size * 0.12, size * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wave distortion overlay
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    const waveY = y + size * 0.5 + Math.sin(wavePhase) * size * 0.1;
    ctx.beginPath();
    ctx.moveTo(x, waveY);
    for (let wx = 0; wx <= size; wx += 2) {
      const wy = waveY + Math.sin(wavePhase + wx * 0.3) * 1.5;
      ctx.lineTo(x + wx, wy);
    }
    ctx.stroke();

    ctx.restore();
  },
};

// ============================================================================
// PLASMA EFFECT - Electric crackle
// ============================================================================
const plasmaEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    if (size < 4) return;

    // Crackle timing - rapid flashes
    const cracklePhase = time * 8 + rng() * Math.PI * 2;
    const crackleIntensity = Math.max(0, Math.sin(cracklePhase) * 0.5 + Math.sin(cracklePhase * 3.7) * 0.3);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Energy core pulse
    const pulseSize = size * (0.3 + crackleIntensity * 0.2);
    ctx.globalAlpha = 0.3 + crackleIntensity * 0.4;
    const coreGradient = ctx.createRadialGradient(
      x + size * 0.5, y + size * 0.5, 0,
      x + size * 0.5, y + size * 0.5, pulseSize
    );
    coreGradient.addColorStop(0, '#FFFFFF');
    coreGradient.addColorStop(0.3, '#FFD700');
    coreGradient.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGradient;
    ctx.fillRect(x, y, size, size);

    // Electric arcs (only during high crackle)
    if (crackleIntensity > 0.3 && size >= 6) {
      const arcCount = Math.ceil(crackleIntensity * 3);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1;
      ctx.globalAlpha = crackleIntensity;

      for (let i = 0; i < arcCount; i++) {
        const arcRng = seededRandom(cellSeed + i * 77 + Math.floor(time * 10));
        const startAngle = arcRng() * Math.PI * 2;
        const arcLen = size * 0.4;

        ctx.beginPath();
        ctx.moveTo(x + size * 0.5, y + size * 0.5);

        let ax = x + size * 0.5;
        let ay = y + size * 0.5;
        for (let j = 0; j < 3; j++) {
          ax += Math.cos(startAngle) * (arcLen / 3) + (arcRng() - 0.5) * 3;
          ay += Math.sin(startAngle) * (arcLen / 3) + (arcRng() - 0.5) * 3;
          ctx.lineTo(ax, ay);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  },
};

// ============================================================================
// LIGHT EFFECT - Radiant pulse
// ============================================================================
const lightEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    if (size < 4) return;

    // Gentle pulse
    const pulsePhase = time * 1.5 + rng() * Math.PI * 2;
    const pulse = 0.5 + Math.sin(pulsePhase) * 0.2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pulse * 0.35;

    // Radiant glow
    const gradient = ctx.createRadialGradient(
      x + size * 0.5, y + size * 0.5, 0,
      x + size * 0.5, y + size * 0.5, size * 0.7
    );
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.5, '#FFFACD');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);

    // Sparkle points
    if (size >= 6) {
      const sparkleCount = Math.max(1, Math.floor(size / 10));
      for (let i = 0; i < sparkleCount; i++) {
        const sparkleRng = seededRandom(cellSeed + i * 33);
        const sparklePhase = time * 4 + sparkleRng() * Math.PI * 2;
        const sparkleAlpha = Math.max(0, Math.sin(sparklePhase));

        if (sparkleAlpha > 0.5) {
          const sx = x + sparkleRng() * size;
          const sy = y + sparkleRng() * size;

          ctx.globalAlpha = sparkleAlpha * 0.8;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(sx, sy, 1 + size * 0.02, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  },
};

// ============================================================================
// ICE EFFECT - Crystalline sparkle
// ============================================================================
const iceEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    if (size < 4) return;

    // Slow crystalline shimmer
    const shimmerPhase = time * 0.8 + rng() * Math.PI * 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Frost sparkles
    const sparkleCount = Math.max(1, Math.floor(size / 8));
    for (let i = 0; i < sparkleCount; i++) {
      const sparkleRng = seededRandom(cellSeed + i * 41);
      const sparklePhase = shimmerPhase + sparkleRng() * Math.PI * 2 + i * 0.5;
      const sparkleAlpha = Math.max(0, Math.sin(sparklePhase) * 0.7);

      if (sparkleAlpha > 0.2) {
        const sx = x + sparkleRng() * size;
        const sy = y + sparkleRng() * size;

        ctx.globalAlpha = sparkleAlpha * 0.6;
        ctx.fillStyle = '#FFFFFF';

        // Draw a tiny star shape
        ctx.beginPath();
        const starSize = 1 + size * 0.04;
        ctx.moveTo(sx, sy - starSize);
        ctx.lineTo(sx, sy + starSize);
        ctx.moveTo(sx - starSize, sy);
        ctx.lineTo(sx + starSize, sy);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Subtle blue tint pulse
    ctx.globalAlpha = 0.1 + Math.sin(shimmerPhase) * 0.05;
    ctx.fillStyle = '#B0E0E6';
    ctx.fillRect(x, y, size, size);

    ctx.restore();
  },
};

// ============================================================================
// VOID EFFECT - Dark energy wisps
// ============================================================================
const voidEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    if (size < 4) return;

    // Slow swirling motion
    const swirlPhase = time * 0.5 + rng() * Math.PI * 2;

    ctx.save();

    // Dark vortex effect - draws darker spots that move
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3;

    const vortexX = x + size * 0.5 + Math.sin(swirlPhase) * size * 0.1;
    const vortexY = y + size * 0.5 + Math.cos(swirlPhase) * size * 0.1;

    const gradient = ctx.createRadialGradient(
      vortexX, vortexY, 0,
      vortexX, vortexY, size * 0.4
    );
    gradient.addColorStop(0, '#000000');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);

    // Wisp particles being consumed
    if (size >= 6) {
      ctx.globalCompositeOperation = 'lighter';
      const wispCount = Math.max(1, Math.floor(size / 10));
      for (let i = 0; i < wispCount; i++) {
        const wispRng = seededRandom(cellSeed + i * 59);
        const wispPhase = swirlPhase + wispRng() * Math.PI * 2;
        const dist = size * 0.3 * (1 - (wispPhase % 1) * 0.5);
        const angle = wispPhase * 2;

        const wx = x + size * 0.5 + Math.cos(angle) * dist;
        const wy = y + size * 0.5 + Math.sin(angle) * dist;
        const wispAlpha = 0.3 + Math.sin(wispPhase * 2) * 0.2;

        ctx.globalAlpha = wispAlpha * 0.4;
        ctx.fillStyle = '#6666AA';
        ctx.beginPath();
        ctx.arc(wx, wy, 1 + size * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },
};

// ============================================================================
// EARTH EFFECT - Subtle grass sway
// ============================================================================
const earthEffect: ElementEffect = {
  render(ctx, x, y, size, time, cellSeed) {
    const rng = seededRandom(cellSeed);

    if (size < 6) return;

    // Gentle sway
    const swayPhase = time * 0.8 + rng() * Math.PI * 2;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;

    // Grass blade tips swaying
    const bladeCount = Math.max(1, Math.floor(size / 8));
    ctx.strokeStyle = '#228B22';
    ctx.lineWidth = 1;

    for (let i = 0; i < bladeCount; i++) {
      const bladeRng = seededRandom(cellSeed + i * 23);
      const bladeX = x + bladeRng() * size;
      const bladeY = y + size * 0.1;
      const sway = Math.sin(swayPhase + bladeRng() * Math.PI) * 2;

      ctx.beginPath();
      ctx.moveTo(bladeX, bladeY + size * 0.3);
      ctx.quadraticCurveTo(
        bladeX + sway, bladeY + size * 0.15,
        bladeX + sway * 0.5, bladeY
      );
      ctx.stroke();
    }

    ctx.restore();
  },
};

// ============================================================================
// STONE EFFECT - None (static fits theme)
// ============================================================================
const stoneEffect: ElementEffect = {
  render() {
    // Stone is intentionally static - no animated effect
  },
};

// ============================================================================
// Element Effect Registry
// ============================================================================
const elementEffects: Map<number, ElementEffect> = new Map([
  [1, earthEffect],   // Earth
  [2, waterEffect],   // Water
  [3, fireEffect],    // Fire
  [4, stoneEffect],   // Stone
  [5, lightEffect],   // Light
  [6, iceEffect],     // Ice
  [7, plasmaEffect],  // Plasma
  [8, voidEffect],    // Void
]);

/**
 * Render element effects for visible alive cells.
 *
 * Call this AFTER drawing alive cells to add animated overlays.
 *
 * @param ctx - Canvas context
 * @param aliveCells - Array of alive cells with their screen positions
 * @param time - Animation time (same as territory animation time)
 */
export function renderElementEffects(
  ctx: CanvasRenderingContext2D,
  aliveCells: Array<{
    screenX: number;
    screenY: number;
    size: number;
    owner: number;
    gridX: number;
    gridY: number;
  }>,
  time: number
): void {
  for (const cell of aliveCells) {
    const effect = elementEffects.get(cell.owner);
    if (effect) {
      // Use grid position as seed for consistent per-cell randomness
      const cellSeed = cell.gridY * 512 + cell.gridX;
      effect.render(ctx, cell.screenX, cell.screenY, cell.size, time, cellSeed);
    }
  }
}

/** Get effect for testing/debugging */
export function getElementEffect(regionId: number): ElementEffect | null {
  return elementEffects.get(regionId) ?? null;
}
