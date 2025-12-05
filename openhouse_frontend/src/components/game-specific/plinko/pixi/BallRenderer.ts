import { Container, Graphics } from 'pixi.js';
import { LAYOUT, calculateBallX, calculateBallY, PIXEL_SCALE, PIXEL_COLORS, snapToPixelGrid } from './LayoutConfig';

interface AnimatingBall {
  id: number;
  container: Container;
  path: boolean[];
  currentRow: number;
  progress: number; // 0-1 within current row
  landed: boolean;
  finalSlot: number;
}

export class BallRenderer {
  private container: Container;
  private balls: Map<number, AnimatingBall> = new Map();
  private rows: number;
  private centerX: number = 0;
  private onBallLanded?: (ballId: number, slot: number) => void;
  private landedCount = 0;

  constructor(rows: number, onBallLanded?: (ballId: number, slot: number) => void) {
    this.rows = rows;
    this.onBallLanded = onBallLanded;
    this.container = new Container();
  }

  async init(parent: Container, centerX: number): Promise<void> {
    this.centerX = centerX;
    this.container.removeChildren();
    parent.addChild(this.container);
  }

  private createPixelBall(): Graphics {
    const ball = new Graphics();
    const ps = PIXEL_SCALE;

    // 5x5 "pixel" ball (approx 20x20px)
    // Pattern:
    //   XXX
    //  XXXXX
    //  XXXXX
    //  XXXXX
    //   XXX

    // Top row (3 blocks)
    ball.rect(-1.5 * ps, -2.5 * ps, 3 * ps, ps);
    
    // Middle rows (5 blocks width, 3 blocks height)
    ball.rect(-2.5 * ps, -1.5 * ps, 5 * ps, 3 * ps);
    
    // Bottom row (3 blocks)
    ball.rect(-1.5 * ps, 1.5 * ps, 3 * ps, ps);
    
    ball.fill({ color: PIXEL_COLORS.GOLD });

    // Simple highlight (top-left pixel)
    ball.rect(-1.5 * ps, -1.5 * ps, ps, ps);
    ball.fill({ color: 0xffffff, alpha: 0.6 });

    return ball;
  }

  dropBall(id: number, path: boolean[]): void {
    // Calculate final slot position (count of rights in path)
    const finalSlot = path.filter((v) => v).length;

    const ballContainer = new Container();
    const ballGraphics = this.createPixelBall();

    ballContainer.addChild(ballGraphics);

    // Initial position (top of board) - Snap to grid
    const startX = snapToPixelGrid(this.centerX);
    const startY = snapToPixelGrid(LAYOUT.DROP_ZONE_HEIGHT - LAYOUT.BALL_RADIUS * 2);
    ballContainer.position.set(startX, startY);

    this.container.addChild(ballContainer);

    const ball: AnimatingBall = {
      id,
      container: ballContainer,
      path,
      currentRow: 0,
      progress: 0,
      landed: false,
      finalSlot,
    };

    this.balls.set(id, ball);
  }

  update(deltaMS: number): void {
    this.balls.forEach((ball) => {
      if (ball.landed) return;

      // Progress through current row
      ball.progress += deltaMS / LAYOUT.MS_PER_ROW;

      if (ball.progress >= 1) {
        ball.currentRow++;
        ball.progress -= 1;

        // Check if ball has landed
        if (ball.currentRow >= this.rows) {
          ball.landed = true;
          ball.progress = 0;
          this.landedCount++;

          // Calculate final position
          const x = snapToPixelGrid(calculateBallX(ball.path, this.rows, 0, this.centerX));
          // Add offset to match SlotRenderer's positioning + half slot height for centering
          const y = snapToPixelGrid(LAYOUT.DROP_ZONE_HEIGHT + this.rows * LAYOUT.PEG_SPACING_Y + LAYOUT.SLOT_Y_OFFSET + LAYOUT.SLOT_HEIGHT / 2);
          ball.container.position.set(x, y);

          // Callback
          this.onBallLanded?.(ball.id, ball.finalSlot);
          return;
        }
      }

      // Calculate current position with easing
      const rawX = calculateBallX(ball.path, ball.currentRow, ball.progress, this.centerX);
      const rawY = calculateBallY(ball.currentRow, ball.progress);

      // Snap to pixel grid for retro feel
      ball.container.position.set(snapToPixelGrid(rawX), snapToPixelGrid(rawY));

      // NO rotation for pixel art
    });
  }

  areAllLanded(): boolean {
    if (this.balls.size === 0) return false;
    return this.landedCount >= this.balls.size;
  }

  getBallCount(): number {
    return this.balls.size;
  }

  clear(): void {
    this.balls.forEach((ball) => {
      ball.container.removeFromParent();
      ball.container.destroy({ children: true });
    });
    this.balls.clear();
    this.landedCount = 0;
  }

  destroy(): void {
    this.clear();
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }
}