/**
 * Cell texture system for Life game regions
 * Generates Minecraft-style 3D block textures for each element
 */

import { REGIONS, type RegionInfo } from '../lifeConstants';

// Cache for generated pattern images at different sizes
const textureCache = new Map<string, HTMLCanvasElement>();

/**
 * Seeded random for consistent texture generation
 */
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 128, g: 128, b: 128 };
}

/**
 * Darken a color by a percentage
 */
function darken(r: number, g: number, b: number, percent: number): string {
  const factor = 1 - percent / 100;
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}

/**
 * Lighten a color by a percentage
 */
function lighten(r: number, g: number, b: number, percent: number): string {
  const factor = percent / 100;
  return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))}, ${Math.min(255, Math.floor(g + (255 - g) * factor))}, ${Math.min(255, Math.floor(b + (255 - b) * factor))})`;
}

/**
 * Add 3D block shading - Minecraft style
 * Lighter on top/left edges, darker on bottom/right edges
 */
function add3DShading(ctx: CanvasRenderingContext2D, size: number, baseColor: { r: number; g: number; b: number }, borderWidth: number = 3): void {
  // Top edge highlight
  ctx.fillStyle = lighten(baseColor.r, baseColor.g, baseColor.b, 30);
  ctx.fillRect(0, 0, size, borderWidth);

  // Left edge highlight
  ctx.fillStyle = lighten(baseColor.r, baseColor.g, baseColor.b, 20);
  ctx.fillRect(0, 0, borderWidth, size);

  // Bottom edge shadow
  ctx.fillStyle = darken(baseColor.r, baseColor.g, baseColor.b, 40);
  ctx.fillRect(0, size - borderWidth, size, borderWidth);

  // Right edge shadow
  ctx.fillStyle = darken(baseColor.r, baseColor.g, baseColor.b, 30);
  ctx.fillRect(size - borderWidth, 0, borderWidth, size);

  // Corner accents for more 3D pop
  // Top-left corner (brightest)
  ctx.fillStyle = lighten(baseColor.r, baseColor.g, baseColor.b, 40);
  ctx.fillRect(0, 0, borderWidth, borderWidth);

  // Bottom-right corner (darkest)
  ctx.fillStyle = darken(baseColor.r, baseColor.g, baseColor.b, 50);
  ctx.fillRect(size - borderWidth, size - borderWidth, borderWidth, borderWidth);
}

/**
 * Generate Earth texture - dirt/soil block
 */
function generateEarthTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(1);
  const base = hexToRgb(region.primaryColor);
  const green = hexToRgb(region.secondaryColor || '#228B22');

  // Base brown fill
  ctx.fillStyle = region.primaryColor;
  ctx.fillRect(0, 0, size, size);

  // Organic soil variation - larger blotches
  const blotchCount = Math.floor(size / 8);
  for (let i = 0; i < blotchCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const blotchSize = size * 0.1 + rand() * size * 0.15;
    ctx.fillStyle = darken(base.r, base.g, base.b, 10 + rand() * 15);
    ctx.beginPath();
    ctx.arc(x, y, blotchSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Green grass/moss patches on top portion
  const grassPatches = Math.floor(size / 12);
  for (let i = 0; i < grassPatches; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.4; // Mostly on top
    const patchSize = size * 0.08 + rand() * size * 0.1;
    ctx.fillStyle = `rgba(${green.r}, ${green.g}, ${green.b}, ${0.4 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, patchSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3D shading
  add3DShading(ctx, size, base);
}

/**
 * Generate Water texture - liquid block with waves
 */
function generateWaterTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(2);
  const base = hexToRgb(region.primaryColor);

  // Gradient from lighter top to darker bottom (depth effect)
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, lighten(base.r, base.g, base.b, 20));
  gradient.addColorStop(0.5, region.primaryColor);
  gradient.addColorStop(1, darken(base.r, base.g, base.b, 20));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Subtle wave patterns
  ctx.strokeStyle = lighten(base.r, base.g, base.b, 25);
  ctx.lineWidth = size * 0.03;
  const waveCount = 4;
  for (let i = 0; i < waveCount; i++) {
    const y = (size / waveCount) * i + size * 0.15;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      size * 0.25, y - size * 0.05,
      size * 0.75, y + size * 0.05,
      size, y
    );
    ctx.stroke();
  }

  // Shimmer highlights
  const shimmerCount = Math.floor(size / 15);
  for (let i = 0; i < shimmerCount; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.6;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.02, size * 0.01, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft 3D edges (water is less rigid)
  add3DShading(ctx, size, base, Math.floor(size * 0.04));
}

/**
 * Generate Fire texture - flame block
 */
function generateFireTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(3);
  const base = hexToRgb(region.primaryColor);
  const yellow = hexToRgb(region.secondaryColor || '#FFD700');

  // Gradient from yellow core to orange edges
  const gradient = ctx.createRadialGradient(
    size * 0.5, size * 0.6, 0,
    size * 0.5, size * 0.5, size * 0.7
  );
  gradient.addColorStop(0, `rgb(${yellow.r}, ${yellow.g}, ${yellow.b})`);
  gradient.addColorStop(0.4, region.primaryColor);
  gradient.addColorStop(1, darken(base.r, base.g, base.b, 20));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Flame wisps rising
  const wispCount = Math.floor(size / 10);
  for (let i = 0; i < wispCount; i++) {
    const x = size * 0.2 + rand() * size * 0.6;
    const startY = size * 0.5 + rand() * size * 0.4;
    const endY = rand() * size * 0.3;
    const width = size * 0.05 + rand() * size * 0.1;

    const wispGradient = ctx.createLinearGradient(x, startY, x, endY);
    wispGradient.addColorStop(0, `rgba(${yellow.r}, ${yellow.g}, ${yellow.b}, 0)`);
    wispGradient.addColorStop(0.5, `rgba(${yellow.r}, ${yellow.g}, ${yellow.b}, 0.6)`);
    wispGradient.addColorStop(1, `rgba(255, 255, 200, 0.8)`);

    ctx.fillStyle = wispGradient;
    ctx.beginPath();
    ctx.moveTo(x - width, startY);
    ctx.quadraticCurveTo(x, startY - size * 0.2, x + width * 0.5, endY);
    ctx.quadraticCurveTo(x, startY - size * 0.15, x - width, startY);
    ctx.fill();
  }

  // Hot spots
  const hotspotCount = Math.floor(size / 20);
  for (let i = 0; i < hotspotCount; i++) {
    const x = size * 0.3 + rand() * size * 0.4;
    const y = size * 0.3 + rand() * size * 0.4;
    ctx.fillStyle = `rgba(255, 255, 220, ${0.5 + rand() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.03 + rand() * size * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }

  // Darker edges (smoke/char)
  ctx.fillStyle = darken(base.r, base.g, base.b, 50);
  ctx.fillRect(0, size - size * 0.05, size, size * 0.05);
  ctx.fillRect(size - size * 0.05, 0, size * 0.05, size);
}

/**
 * Generate Stone texture - rocky block with cracks
 */
function generateStoneTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(4);
  const base = hexToRgb(region.primaryColor);

  // Base stone color
  ctx.fillStyle = region.primaryColor;
  ctx.fillRect(0, 0, size, size);

  // Rocky texture - irregular lighter/darker patches
  const patchCount = Math.floor(size / 6);
  for (let i = 0; i < patchCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const patchSize = size * 0.1 + rand() * size * 0.2;
    const isLighter = rand() > 0.5;
    ctx.fillStyle = isLighter
      ? lighten(base.r, base.g, base.b, 10 + rand() * 15)
      : darken(base.r, base.g, base.b, 10 + rand() * 15);
    ctx.beginPath();
    // Irregular polygon shape
    ctx.moveTo(x, y - patchSize * 0.5);
    ctx.lineTo(x + patchSize * 0.4, y - patchSize * 0.3);
    ctx.lineTo(x + patchSize * 0.5, y + patchSize * 0.2);
    ctx.lineTo(x + patchSize * 0.1, y + patchSize * 0.5);
    ctx.lineTo(x - patchSize * 0.4, y + patchSize * 0.3);
    ctx.lineTo(x - patchSize * 0.5, y - patchSize * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  // Cracks/fissures
  ctx.strokeStyle = darken(base.r, base.g, base.b, 40);
  ctx.lineWidth = size * 0.015;
  const crackCount = Math.floor(size / 25);
  for (let i = 0; i < crackCount; i++) {
    ctx.beginPath();
    let x = rand() * size;
    let y = rand() * size;
    ctx.moveTo(x, y);
    const segments = 2 + Math.floor(rand() * 3);
    for (let j = 0; j < segments; j++) {
      x += (rand() - 0.5) * size * 0.2;
      y += (rand() - 0.5) * size * 0.2;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Strong 3D shading for solid rock feel
  add3DShading(ctx, size, base, Math.floor(size * 0.06));
}

/**
 * Generate Light texture - radiant glowing block
 */
function generateLightTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(5);
  const base = hexToRgb(region.primaryColor);

  // Radial glow from center
  const gradient = ctx.createRadialGradient(
    size * 0.5, size * 0.5, 0,
    size * 0.5, size * 0.5, size * 0.7
  );
  gradient.addColorStop(0, '#FFFFFF');
  gradient.addColorStop(0.3, lighten(base.r, base.g, base.b, 30));
  gradient.addColorStop(0.7, region.primaryColor);
  gradient.addColorStop(1, darken(base.r, base.g, base.b, 10));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Light rays emanating from center
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = size * 0.02;
  const rayCount = 8;
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.5);
    ctx.lineTo(
      size * 0.5 + Math.cos(angle) * size * 0.45,
      size * 0.5 + Math.sin(angle) * size * 0.45
    );
    ctx.stroke();
  }

  // Sparkle points
  const sparkleCount = Math.floor(size / 12);
  for (let i = 0; i < sparkleCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const sparkleSize = size * 0.01 + rand() * size * 0.02;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + rand() * 0.4})`;
    // 4-point star shape
    ctx.beginPath();
    ctx.moveTo(x, y - sparkleSize * 2);
    ctx.lineTo(x + sparkleSize * 0.5, y);
    ctx.lineTo(x, y + sparkleSize * 2);
    ctx.lineTo(x - sparkleSize * 0.5, y);
    ctx.closePath();
    ctx.fill();
  }

  // Soft edge glow (inverted - darker center edges for ethereal feel)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = size * 0.03;
  ctx.strokeRect(size * 0.02, size * 0.02, size * 0.96, size * 0.96);
}

/**
 * Generate Ice texture - crystalline frozen block
 */
function generateIceTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(6);
  const base = hexToRgb(region.primaryColor);
  const blue = hexToRgb(region.secondaryColor || '#B0E0E6');

  // Gradient base - lighter on top (frost)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, lighten(base.r, base.g, base.b, 15));
  gradient.addColorStop(0.5, region.primaryColor);
  gradient.addColorStop(1, `rgb(${blue.r}, ${blue.g}, ${blue.b})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Crystal facets - geometric shapes
  const facetCount = Math.floor(size / 15);
  for (let i = 0; i < facetCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const facetSize = size * 0.1 + rand() * size * 0.15;

    ctx.fillStyle = lighten(base.r, base.g, base.b, 20 + rand() * 20);
    ctx.beginPath();
    // Diamond/crystal shape
    ctx.moveTo(x, y - facetSize);
    ctx.lineTo(x + facetSize * 0.6, y);
    ctx.lineTo(x, y + facetSize * 0.7);
    ctx.lineTo(x - facetSize * 0.6, y);
    ctx.closePath();
    ctx.fill();
  }

  // Frost streaks (white lines)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = size * 0.01;
  const streakCount = Math.floor(size / 12);
  for (let i = 0; i < streakCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const length = size * 0.1 + rand() * size * 0.15;
    const angle = rand() * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  // 3D shading with icy feel
  add3DShading(ctx, size, base, Math.floor(size * 0.04));

  // Extra bright top-left for glossy ice
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size * 0.3, 0);
  ctx.lineTo(0, size * 0.3);
  ctx.closePath();
  ctx.fill();
}

/**
 * Generate Plasma texture - electric energy block
 */
function generatePlasmaTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(7);
  const base = hexToRgb(region.primaryColor);
  const yellow = hexToRgb(region.secondaryColor || '#FFD700');

  // Purple nebula background
  const gradient = ctx.createRadialGradient(
    size * 0.3, size * 0.3, 0,
    size * 0.5, size * 0.5, size * 0.8
  );
  gradient.addColorStop(0, lighten(base.r, base.g, base.b, 20));
  gradient.addColorStop(0.5, region.primaryColor);
  gradient.addColorStop(1, darken(base.r, base.g, base.b, 30));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Energy clouds
  const cloudCount = Math.floor(size / 12);
  for (let i = 0; i < cloudCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const cloudSize = size * 0.1 + rand() * size * 0.15;
    ctx.fillStyle = `rgba(218, 112, 214, ${0.3 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, cloudSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Electric arcs (lightning bolts)
  ctx.strokeStyle = `rgba(${yellow.r}, ${yellow.g}, ${yellow.b}, 0.9)`;
  ctx.lineWidth = size * 0.02;
  const arcCount = 3;
  for (let i = 0; i < arcCount; i++) {
    ctx.beginPath();
    let x = rand() * size * 0.3;
    let y = rand() * size;
    ctx.moveTo(x, y);

    const segments = 4 + Math.floor(rand() * 3);
    for (let j = 0; j < segments; j++) {
      x += size * 0.15 + rand() * size * 0.1;
      y += (rand() - 0.5) * size * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow around lightning
    ctx.strokeStyle = `rgba(${yellow.r}, ${yellow.g}, ${yellow.b}, 0.3)`;
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${yellow.r}, ${yellow.g}, ${yellow.b}, 0.9)`;
    ctx.lineWidth = size * 0.02;
  }

  // Bright energy points
  const pointCount = Math.floor(size / 15);
  for (let i = 0; i < pointCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = `rgba(255, 255, 150, ${0.6 + rand() * 0.4})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.015 + rand() * size * 0.02, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle edge glow
  ctx.strokeStyle = `rgba(${yellow.r}, ${yellow.g}, ${yellow.b}, 0.4)`;
  ctx.lineWidth = size * 0.03;
  ctx.strokeRect(size * 0.02, size * 0.02, size * 0.96, size * 0.96);
}

/**
 * Generate Void texture - dark consuming block
 */
function generateVoidTexture(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const rand = seededRandom(8);
  const base = hexToRgb(region.primaryColor);
  const secondary = hexToRgb(region.secondaryColor || '#16213e');

  // Deep black base with subtle gradient
  const gradient = ctx.createRadialGradient(
    size * 0.5, size * 0.5, 0,
    size * 0.5, size * 0.5, size * 0.7
  );
  gradient.addColorStop(0, darken(base.r, base.g, base.b, 20));
  gradient.addColorStop(0.5, region.primaryColor);
  gradient.addColorStop(1, `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Swirling darkness
  const swirlCount = Math.floor(size / 10);
  for (let i = 0; i < swirlCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const swirlSize = size * 0.1 + rand() * size * 0.2;
    ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, swirlSize, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant stars/particles being consumed
  const particleCount = Math.floor(size / 20);
  for (let i = 0; i < particleCount; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const dist = Math.sqrt(Math.pow(x - size/2, 2) + Math.pow(y - size/2, 2));
    const alpha = Math.min(0.8, dist / (size * 0.5) * 0.6);
    ctx.fillStyle = `rgba(100, 100, 150, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.01, 0, Math.PI * 2);
    ctx.fill();
  }

  // Event horizon glow (purple/blue rim)
  ctx.strokeStyle = 'rgba(75, 0, 130, 0.5)';
  ctx.lineWidth = size * 0.04;
  ctx.strokeRect(size * 0.02, size * 0.02, size * 0.96, size * 0.96);

  // Inner darker border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = size * 0.02;
  ctx.strokeRect(size * 0.05, size * 0.05, size * 0.9, size * 0.9);
}

/**
 * Generate texture for a specific region at a given size
 */
function generateRegionTexture(region: RegionInfo, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  switch (region.name) {
    case 'Earth':
      generateEarthTexture(ctx, size, region);
      break;
    case 'Water':
      generateWaterTexture(ctx, size, region);
      break;
    case 'Fire':
      generateFireTexture(ctx, size, region);
      break;
    case 'Stone':
      generateStoneTexture(ctx, size, region);
      break;
    case 'Light':
      generateLightTexture(ctx, size, region);
      break;
    case 'Ice':
      generateIceTexture(ctx, size, region);
      break;
    case 'Plasma':
      generatePlasmaTexture(ctx, size, region);
      break;
    case 'Void':
      generateVoidTexture(ctx, size, region);
      break;
    default:
      // Fallback - solid color with 3D shading
      ctx.fillStyle = region.primaryColor;
      ctx.fillRect(0, 0, size, size);
      add3DShading(ctx, size, hexToRgb(region.primaryColor));
  }

  return canvas;
}

/**
 * Get or create a texture canvas for a region at a specific size
 */
export function getRegionTexture(regionId: number, size: number): HTMLCanvasElement {
  const cacheKey = `region-${regionId}-${size}`;

  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const region = REGIONS[regionId];
  if (!region) {
    // Return a simple gray block as fallback
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    return canvas;
  }

  const textureCanvas = generateRegionTexture(region, size);
  textureCache.set(cacheKey, textureCanvas);
  return textureCanvas;
}

/**
 * Get a canvas pattern for tiling (for game grid - uses smaller cached texture)
 */
export function getRegionPattern(ctx: CanvasRenderingContext2D, playerNum: number): CanvasPattern | string {
  const region = REGIONS[playerNum];
  if (!region) {
    return '#FFFFFF';
  }

  // For game grid, we use a small texture that can tile
  // But since we want cohesive single-cell look, use solid color for now
  // The texture system is mainly for previews
  return region.primaryColor;
}

/**
 * Clear texture cache
 */
export function clearPatternCache(): void {
  textureCache.clear();
}

/**
 * Preload textures at common sizes
 */
export function preloadPatterns(ctx: CanvasRenderingContext2D): void {
  // Preload preview sizes
  for (const regionId of Object.keys(REGIONS)) {
    getRegionTexture(parseInt(regionId), 64);
    getRegionTexture(parseInt(regionId), 32);
  }
}
