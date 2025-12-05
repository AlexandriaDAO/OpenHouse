import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { LAYOUT, easeInOutQuad, PIXEL_SCALE, PIXEL_COLORS } from './LayoutConfig';

interface BucketBall {
  graphics: Graphics;
  x: number;
  y: number;
  vy: number; // velocity y
}

export class BucketRenderer {
  private container: Container;
  private bucketBody: Graphics;
  private leftDoor: Container;
  private rightDoor: Container;
  private labelText: Text;
  private balls: BucketBall[] = [];
  private ballContainer: Container;
  private clickCallback?: () => void;

  // Animation state
  private doorOpen = false;
  private doorProgress = 0; // 0 = closed, 1 = open
  private isDoorAnimating = false;

  // Bucket interior dimensions
  private readonly INTERIOR_WIDTH = LAYOUT.BUCKET_WIDTH - PIXEL_SCALE * 4; // 2 ps border on each side
  private readonly INTERIOR_HEIGHT = LAYOUT.BUCKET_HEIGHT - PIXEL_SCALE * 4;

  constructor() {
    this.container = new Container();
    this.bucketBody = new Graphics();
    this.leftDoor = new Container();
    this.rightDoor = new Container();
    this.ballContainer = new Container();
    this.labelText = new Text({
      text: 'DROP',
      style: new TextStyle({
        fontFamily: '"Press Start 2P", "Courier New", monospace',
        fontSize: 10,
        fontWeight: 'normal',
        fill: PIXEL_COLORS.WHITE,
        align: 'center',
      }),
    });
  }

  async init(parent: Container, centerX: number): Promise<void> {
    this.container.removeChildren();
    this.container.position.set(centerX, 0);

    const ps = PIXEL_SCALE;
    const topOffset = ps * 2; // 8px top offset

    // Bucket body - Pixel art style (Rectangle)
    this.bucketBody.clear();
    
    // Fill
    this.bucketBody.rect(
      -LAYOUT.BUCKET_WIDTH / 2,
      topOffset,
      LAYOUT.BUCKET_WIDTH,
      LAYOUT.BUCKET_HEIGHT - topOffset
    );
    this.bucketBody.fill({ color: PIXEL_COLORS.DARK_GRAY });

    // Pixel Border (4 sides)
    const hw = LAYOUT.BUCKET_WIDTH / 2;
    const h = LAYOUT.BUCKET_HEIGHT;
    
    // Top
    this.bucketBody.rect(-hw, topOffset, LAYOUT.BUCKET_WIDTH, ps);
    // Bottom
    this.bucketBody.rect(-hw, h - ps, LAYOUT.BUCKET_WIDTH, ps);
    // Left
    this.bucketBody.rect(-hw, topOffset, ps, h - topOffset);
    // Right
    this.bucketBody.rect(hw - ps, topOffset, ps, h - topOffset);
    
    this.bucketBody.fill({ color: PIXEL_COLORS.MID_GRAY });

    this.container.addChild(this.bucketBody);

    // Ball container
    this.ballContainer.position.set(0, topOffset + ps);
    this.container.addChild(this.ballContainer);

    // Doors (Rectangular pixel slabs)
    const doorWidth = LAYOUT.BUCKET_WIDTH / 2 - ps * 2;
    const doorHeight = ps * 2; // 8px thick doors

    // Left door
    const leftDoorGraphic = new Graphics();
    leftDoorGraphic.rect(0, 0, doorWidth, doorHeight);
    leftDoorGraphic.fill({ color: LAYOUT.TRAPDOOR_COLOR });
    // Border
    leftDoorGraphic.rect(0, 0, doorWidth, ps); // Top border detail
    leftDoorGraphic.fill({ color: PIXEL_COLORS.MID_GRAY });
    
    this.leftDoor.addChild(leftDoorGraphic);
    this.leftDoor.pivot.set(0, doorHeight / 2); // Pivot on left edge center
    this.leftDoor.position.set(-doorWidth, LAYOUT.BUCKET_HEIGHT - ps * 3); // Positioned near bottom
    this.container.addChild(this.leftDoor);

    // Right door
    const rightDoorGraphic = new Graphics();
    rightDoorGraphic.rect(-doorWidth, 0, doorWidth, doorHeight);
    rightDoorGraphic.fill({ color: LAYOUT.TRAPDOOR_COLOR });
    // Border
    rightDoorGraphic.rect(-doorWidth, 0, doorWidth, ps);
    rightDoorGraphic.fill({ color: PIXEL_COLORS.MID_GRAY });

    this.rightDoor.addChild(rightDoorGraphic);
    this.rightDoor.pivot.set(0, doorHeight / 2); // Pivot on right edge center
    this.rightDoor.position.set(doorWidth, LAYOUT.BUCKET_HEIGHT - ps * 3);
    this.container.addChild(this.rightDoor);

    // Label
    this.labelText.anchor.set(0.5);
    this.labelText.position.set(0, LAYOUT.BUCKET_HEIGHT / 2);
    this.container.addChild(this.labelText);

    parent.addChild(this.container);

    // Make bucket interactive
    this.setInteractive(false);
    
    // Add hover effects
    this.container.on('pointerover', () => {
      if (this.container.eventMode === 'static') {
        this.bucketBody.tint = 0xddddff;
      }
    });
    
    this.container.on('pointerout', () => {
      this.bucketBody.tint = 0xffffff;
    });
  }

  setInteractive(enabled: boolean): void {
    this.container.eventMode = enabled ? 'static' : 'none';
    this.container.cursor = enabled ? 'pointer' : 'default';
    this.container.alpha = enabled ? 1 : 0.8;
    
    if (!enabled) {
      this.container.scale.set(1);
      this.bucketBody.tint = 0xffffff;
    }
  }

  setOnClick(callback: () => void): void {
    if (this.clickCallback) {
      this.container.off('pointerdown', this.clickCallback);
    }
    this.clickCallback = callback;
    this.container.on('pointerdown', callback);
  }

  fillBucket(count: number): void {
    // Clear existing balls
    this.clearBalls();

    // Add balls with staggered timing
    const ballRadius = PIXEL_SCALE; // 4px radius small balls for bucket

    for (let i = 0; i < Math.min(count, 30); i++) {
      setTimeout(() => {
        const ball = new Graphics();
        // Pixel ball (small)
        //  XX
        //  XX
        ball.rect(-ballRadius, -ballRadius, ballRadius * 2, ballRadius * 2);
        ball.fill({ color: PIXEL_COLORS.GOLD });

        // Random starting position at top of bucket
        const x = (Math.random() - 0.5) * (this.INTERIOR_WIDTH - ballRadius * 4);
        const y = -ballRadius * 2;

        ball.position.set(x, y);
        this.ballContainer.addChild(ball);

        this.balls.push({
          graphics: ball,
          x,
          y,
          vy: 0,
        });
      }, i * 40);
    }
  }

  openDoor(): void {
    this.doorOpen = true;
    this.isDoorAnimating = true;
  }

  closeDoor(): void {
    this.doorOpen = false;
    this.isDoorAnimating = true;
  }

  update(deltaMS: number): void {
    // Animate door
    if (this.isDoorAnimating) {
      const targetProgress = this.doorOpen ? 1 : 0;
      const speed = deltaMS / LAYOUT.DOOR_OPEN_DURATION_MS;

      if (this.doorOpen) {
        this.doorProgress = Math.min(1, this.doorProgress + speed);
      } else {
        this.doorProgress = Math.max(0, this.doorProgress - speed);
      }

      if (this.doorProgress === targetProgress) {
        this.isDoorAnimating = false;
      }

      // Apply rotation to doors (swing down/open)
      const angle = easeInOutQuad(this.doorProgress) * (Math.PI / 2);
      this.leftDoor.rotation = angle;
      this.rightDoor.rotation = -angle;
    }

    // Animate bucket balls (simple gravity)
    const gravity = 0.3;
    const damping = 0.5; // Less bouncy
    const floorY = this.INTERIOR_HEIGHT - PIXEL_SCALE * 3; // Above doors

    this.balls.forEach((ball) => {
      // Apply gravity
      ball.vy += gravity;
      ball.y += ball.vy;

      // Floor collision (unless door is open)
      if (!this.doorOpen && ball.y > floorY) {
        ball.y = floorY;
        ball.vy = -ball.vy * damping;
        if (Math.abs(ball.vy) < 0.5) ball.vy = 0;
      }

      // If door is open, balls fall through
      if (this.doorOpen && ball.y > floorY + 50) {
        ball.graphics.alpha = Math.max(0, ball.graphics.alpha - 0.1);
      }

      ball.graphics.position.set(ball.x, ball.y);
    });

    // Remove fully transparent balls
    this.balls = this.balls.filter((ball) => {
      if (ball.graphics.alpha <= 0) {
        ball.graphics.removeFromParent();
        ball.graphics.destroy();
        return false;
      }
      return true;
    });
  }

  setLabel(text: string): void {
    this.labelText.text = text;
  }

  reset(): void {
    this.clearBalls();
    this.doorOpen = false;
    this.doorProgress = 0;
    this.leftDoor.rotation = 0;
    this.rightDoor.rotation = 0;
    this.labelText.text = 'DROP';
  }

  private clearBalls(): void {
    this.balls.forEach((ball) => {
      ball.graphics.removeFromParent();
      ball.graphics.destroy();
    });
    this.balls = [];
  }

  destroy(): void {
    if (this.clickCallback) {
      this.container.off('pointerdown', this.clickCallback);
    }
    this.clearBalls();
    this.container.removeFromParent();
    this.container.destroy({ children: true });
  }
}