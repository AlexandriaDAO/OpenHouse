import { Container, Graphics } from 'pixi.js';
import { LAYOUT, PIXEL_SCALE, PIXEL_COLORS, snapToPixelGrid } from './LayoutConfig';

export class PegRenderer {
  private container: Container;
  private rows: number;

  constructor(rows: number) {
    this.rows = rows;
    this.container = new Container();
  }

  async init(parent: Container, centerX: number): Promise<void> {
    this.container.removeChildren();

    // Create all pegs as a single Graphics object for performance
    const pegsGraphics = new Graphics();

    // Shadow/outline
    const shadowGraphics = new Graphics();

    for (let row = 0; row <= this.rows; row++) {
      for (let col = 0; col <= row; col++) {
        // Snap to pixel grid
        const x = snapToPixelGrid(centerX + (col - row / 2) * LAYOUT.PEG_SPACING_X);
        const y = snapToPixelGrid(LAYOUT.DROP_ZONE_HEIGHT + row * LAYOUT.PEG_SPACING_Y);

        this.drawPixelCircle(pegsGraphics, x, y);
        this.drawPixelCircle(shadowGraphics, x + PIXEL_SCALE, y + PIXEL_SCALE);
      }
    }

    pegsGraphics.fill({ color: PIXEL_COLORS.WHITE });
    shadowGraphics.fill({ color: PIXEL_COLORS.MID_GRAY, alpha: 0.5 });

    // Add shadow first, then pegs on top
    this.container.addChild(shadowGraphics);
    this.container.addChild(pegsGraphics);

    parent.addChild(this.container);
  }

  private drawPixelCircle(graphics: Graphics, cx: number, cy: number): void {
    const ps = PIXEL_SCALE; 
    
    // 8px radius (2 "pixels")
    // Pattern:
    //   XX
    //  XXXX
    //  XXXX
    //   XX

    // Top row (2 blocks)
    graphics.rect(cx - ps, cy - ps * 2, ps * 2, ps);

    // Middle rows (4 blocks each)
    graphics.rect(cx - ps * 2, cy - ps, ps * 4, ps * 2);

    // Bottom row (2 blocks)
    graphics.rect(cx - ps, cy + ps, ps * 2, ps);
  }

  destroy(): void {
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }
}