/**
 * Element Renderer Interface
 *
 * Every element (Earth, Water, Fire, etc.) must implement this interface.
 * This is the ONLY contract between core logic and element styles.
 */
export interface ElementRenderer {
  /** Unique element name for debugging */
  readonly name: string;

  /**
   * Render a tile for territory pattern.
   * Called ONCE at startup, result is cached as a CanvasPattern.
   * @param ctx - Canvas 2D context to draw on
   * @param size - Tile size in pixels (typically 128)
   * @param colors - Primary and secondary colors for this element
   */
  renderTerritoryTile(
    ctx: CanvasRenderingContext2D,
    size: number,
    colors: { primary: string; secondary: string }
  ): void;

  /**
   * Render a cell sprite at the given size.
   * Called ONCE per size at startup, results are cached.
   * @param ctx - Canvas 2D context to draw on
   * @param size - Sprite size in pixels (8, 12, 16, 24, 32)
   * @param colors - Primary and secondary colors for this element
   */
  renderCellSprite(
    ctx: CanvasRenderingContext2D,
    size: number,
    colors: { primary: string; secondary: string }
  ): void;

  /**
   * Optional: Custom animation parameters.
   * If not provided, defaults are used.
   */
  animation?: {
    /** Speed multiplier for territory pattern drift (default: 1.0) */
    territorySpeed?: number;
    /** Amplitude of territory drift in pixels (default: 2) */
    territoryAmplitude?: number;
  };
}

/** Color utilities types */
export interface RGB {
  r: number;
  g: number;
  b: number;
}
