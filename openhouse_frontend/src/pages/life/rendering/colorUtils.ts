import type { RGB } from './types';

/**
 * Convert hex color to RGB object
 */
export function hexToRgb(hex: string): RGB {
  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Handle 3-digit hex
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;

  const num = parseInt(fullHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Lighten a color by a percentage (0-1)
 */
export function lighten(rgb: RGB, amount: number): RGB {
  return {
    r: Math.min(255, Math.round(rgb.r + (255 - rgb.r) * amount)),
    g: Math.min(255, Math.round(rgb.g + (255 - rgb.g) * amount)),
    b: Math.min(255, Math.round(rgb.b + (255 - rgb.b) * amount)),
  };
}

/**
 * Darken a color by a percentage (0-1)
 */
export function darken(rgb: RGB, amount: number): RGB {
  return {
    r: Math.round(rgb.r * (1 - amount)),
    g: Math.round(rgb.g * (1 - amount)),
    b: Math.round(rgb.b * (1 - amount)),
  };
}

/**
 * Convert RGB to CSS string
 */
export function rgbToCss(rgb: RGB, alpha?: number): string {
  if (alpha !== undefined) {
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Add 3D edges to a cell sprite (highlight top-left, shadow bottom-right)
 */
export function add3DEdges(
  ctx: CanvasRenderingContext2D,
  size: number,
  primaryColor: string
): void {
  const rgb = hexToRgb(primaryColor);
  const lightRgb = lighten(rgb, 0.3);
  const darkRgb = darken(rgb, 0.4);

  // Top edge highlight
  ctx.fillStyle = rgbToCss(lightRgb);
  ctx.fillRect(0, 0, size, 1);

  // Left edge highlight
  ctx.fillRect(0, 0, 1, size);

  // Bottom edge shadow
  ctx.fillStyle = rgbToCss(darkRgb);
  ctx.fillRect(0, size - 1, size, 1);

  // Right edge shadow
  ctx.fillRect(size - 1, 0, 1, size);
}
