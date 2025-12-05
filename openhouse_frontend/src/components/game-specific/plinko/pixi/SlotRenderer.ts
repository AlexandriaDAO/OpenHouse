import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LAYOUT, PIXEL_SCALE, PIXEL_COLORS, snapToPixelGrid } from './LayoutConfig';

export class SlotRenderer {
  private container: Container;
  private rows: number;
  private multipliers: number[];
  private slotGraphics: Graphics[] = [];
  private multiplierTexts: Text[] = [];
  private highlightedSlots: Set<number> = new Set();

  constructor(rows: number, multipliers: number[]) {
    this.rows = rows;
    this.multipliers = multipliers;
    this.container = new Container();
  }

  async init(parent: Container, centerX: number, rows: number): Promise<void> {
    this.rows = rows;
    this.container.removeChildren();
    this.slotGraphics = [];
    this.multiplierTexts = [];

    const slotY = snapToPixelGrid(LAYOUT.DROP_ZONE_HEIGHT + this.rows * LAYOUT.PEG_SPACING_Y + LAYOUT.SLOT_Y_OFFSET);
    const numSlots = this.rows + 1;

    // Create text style - using pixel font
    const textStyle = new TextStyle({
      fontFamily: '"Press Start 2P", "Courier New", monospace',
      fontSize: 8, // Small for pixel aesthetic
      fontWeight: 'normal',
      fill: PIXEL_COLORS.WHITE,
      align: 'center',
    });

    for (let i = 0; i < numSlots; i++) {
      const x = snapToPixelGrid(centerX + (i - this.rows / 2) * LAYOUT.PEG_SPACING_X);
      const multiplier = this.multipliers[i] ?? 0.2;
      const isWin = multiplier >= 1.0;

      const slotGraphic = new Graphics();
      slotGraphic.position.set(x, slotY);
      
      this.drawPixelSlot(slotGraphic, isWin, false);
      
      this.slotGraphics.push(slotGraphic);
      this.container.addChild(slotGraphic);

      // Multiplier text
      const text = new Text({
        text: `${multiplier}x`, // Simplified text
        style: {
          ...textStyle,
          fill: isWin ? PIXEL_COLORS.GREEN : PIXEL_COLORS.LIGHT_GRAY,
        },
      });
      text.anchor.set(0.5);
      // Center text in slot
      text.position.set(x, slotY + LAYOUT.SLOT_HEIGHT / 2);
      this.multiplierTexts.push(text);
      this.container.addChild(text);
    }

    parent.addChild(this.container);
  }

  private drawPixelSlot(graphics: Graphics, isWin: boolean, isHighlighted: boolean): void {
    const ps = PIXEL_SCALE;
    const w = LAYOUT.SLOT_WIDTH;
    const h = LAYOUT.SLOT_HEIGHT;
    const halfW = w / 2;

    graphics.clear();

    // Background
    const bgColor = isHighlighted ? 
      (isWin ? 0x1a3d2e : 0x4a4a2e) : // Highlighted bg
      (isWin ? 0x0a2a1a : PIXEL_COLORS.DARK_GRAY); // Normal bg
    
    graphics.rect(-halfW, 0, w, h);
    graphics.fill({ color: bgColor });

    // Border color
    const borderColor = isHighlighted ? PIXEL_COLORS.GOLD : (isWin ? PIXEL_COLORS.GREEN : PIXEL_COLORS.MID_GRAY);

    // Draw 4 sides separately for crisp edges
    // Top
    graphics.rect(-halfW, 0, w, ps);
    // Bottom
    graphics.rect(-halfW, h - ps, w, ps);
    // Left
    graphics.rect(-halfW, 0, ps, h);
    // Right
    graphics.rect(halfW - ps, 0, ps, h);

    graphics.fill({ color: borderColor });
  }

  highlightSlots(positions: number[]): void {
    // Clear previous highlights
    this.clearHighlights();

    // Count occurrences for each position
    const counts = new Map<number, number>();
    positions.forEach((pos) => {
      counts.set(pos, (counts.get(pos) || 0) + 1);
    });

    // Apply highlights
    counts.forEach((_count, pos) => {
      if (pos >= 0 && pos < this.slotGraphics.length) {
        this.highlightedSlots.add(pos);
        const slot = this.slotGraphics[pos];
        const multiplier = this.multipliers[pos] ?? 0.2;
        const isWin = multiplier >= 1.0;

        this.drawPixelSlot(slot, isWin, true);
      }
    });
  }

  clearHighlights(): void {
    this.highlightedSlots.forEach((pos) => {
      if (pos >= 0 && pos < this.slotGraphics.length) {
        const slot = this.slotGraphics[pos];
        const multiplier = this.multipliers[pos] ?? 0.2;
        const isWin = multiplier >= 1.0;

        this.drawPixelSlot(slot, isWin, false);
      }
    });
    this.highlightedSlots.clear();
  }

  updateMultipliers(multipliers: number[]): void {
    this.multipliers = multipliers;
    // Update text
    multipliers.forEach((mult, i) => {
      if (i < this.multiplierTexts.length) {
        const isWin = mult >= 1.0;
        this.multiplierTexts[i].text = `${mult}x`;
        this.multiplierTexts[i].style.fill = isWin ? PIXEL_COLORS.GREEN : PIXEL_COLORS.LIGHT_GRAY;
      }
    });
  }

  destroy(): void {
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }
}