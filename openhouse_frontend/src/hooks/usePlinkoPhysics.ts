import { useEffect, useRef, useCallback } from 'react';

interface PhysicsConfig {
  rows: number;
  pegSpacingX: number;
  pegSpacingY: number;
  ballRadius: number;
  pegRadius: number;
}

interface BallPath {
  id: number;
  path: boolean[]; // Backend-provided path (true = go right, false = go left)
}

// Calculate the final slot position from a path
function calculateFinalSlot(path: boolean[]): number {
  return path.filter(goRight => goRight).length;
}

// Fixed board width - must match CSS
const BOARD_WIDTH = 1000;
const DROP_ZONE_HEIGHT = 100;

export function usePlinkoPhysics(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: PhysicsConfig,
  onBallLanded: (ballId: number, position: number) => void
) {
  const runnerRef = useRef<{ stop: () => void }>();
  const ballsRef = useRef<Map<number, { x: number; y: number; vx: number; vy: number; path: boolean[]; id: number; slot: number; landed: boolean }>>(new Map());
  const configRef = useRef(config);
  configRef.current = config;

  const centerX = BOARD_WIDTH / 2;

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasHeight = DROP_ZONE_HEIGHT + config.rows * config.pegSpacingY + 120;

    // Set canvas dimensions
    canvas.width = BOARD_WIDTH;
    canvas.height = canvasHeight;

    // Calculate peg positions
    const pegs: { x: number; y: number }[] = [];
    for (let row = 0; row <= config.rows; row++) {
      const pegsInRow = row + 1;
      for (let col = 0; col < pegsInRow; col++) {
        const x = centerX + (col - row / 2) * config.pegSpacingX;
        const y = DROP_ZONE_HEIGHT + row * config.pegSpacingY;
        pegs.push({ x, y });
      }
    }

    // Animation loop
    let animationId: number;
    const gravity = 0.12;      // Slower falling (was 0.3)
    const bounce = 0.45;       // Less bouncy (was 0.6)
    const hFriction = 0.92;    // More horizontal dampening (was 0.98)

    const animate = () => {
      ctx.clearRect(0, 0, BOARD_WIDTH, canvasHeight);

      // Draw pegs - minimal white style
      pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, config.pegRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#e8e8e8';
        ctx.fill();
      });

      // Update and draw balls
      const cfg = configRef.current;

      ballsRef.current.forEach((ball) => {
        if (ball.landed) return;

        // Apply gravity
        ball.vy += gravity;

        // Calculate which row we're approaching
        const nextY = ball.y + ball.vy;
        const currentRow = Math.floor((ball.y - DROP_ZONE_HEIGHT + cfg.pegSpacingY / 2) / cfg.pegSpacingY);
        const nextRow = Math.floor((nextY - DROP_ZONE_HEIGHT + cfg.pegSpacingY / 2) / cfg.pegSpacingY);

        // If crossing into a new row, apply the path direction with lerping for smooth transition
        if (nextRow > currentRow && currentRow >= 0 && currentRow < ball.path.length) {
          const goRight = ball.path[currentRow];
          const targetVx = goRight ? 1.5 : -1.5;
          // Lerp toward target for smooth, natural movement
          ball.vx = ball.vx * 0.5 + targetVx * 0.5;
        }

        // Apply friction to horizontal movement
        ball.vx *= hFriction;

        // Move ball
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Bounce off pegs (smooth collision)
        pegs.forEach(peg => {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = cfg.ballRadius + cfg.pegRadius;

          if (dist < minDist && dist > 0) {
            // Collision! Push ball out with slight extra clearance
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            ball.x += nx * (overlap + 1);
            ball.y += ny * (overlap + 1);

            // Slower, more controlled bounce
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 1.8 * dot * nx) * bounce;
            ball.vy = Math.max(0.5, (ball.vy - 1.8 * dot * ny) * bounce);
          }
        });

        // Keep ball in bounds horizontally
        const minX = centerX - (cfg.rows / 2 + 1) * cfg.pegSpacingX;
        const maxX = centerX + (cfg.rows / 2 + 1) * cfg.pegSpacingX;
        if (ball.x < minX) {
          ball.x = minX;
          ball.vx = Math.abs(ball.vx) * bounce;
        }
        if (ball.x > maxX) {
          ball.x = maxX;
          ball.vx = -Math.abs(ball.vx) * bounce;
        }

        // Check for landing
        const bottomY = DROP_ZONE_HEIGHT + cfg.rows * cfg.pegSpacingY + 30;
        if (ball.y > bottomY) {
          ball.landed = true;
          // Snap to predetermined slot
          ball.x = centerX + (ball.slot - cfg.rows / 2) * cfg.pegSpacingX;
          ball.y = bottomY;
          onBallLanded(ball.id, ball.slot);

          // Remove after delay
          setTimeout(() => {
            ballsRef.current.delete(ball.id);
          }, 600);
        }

        // Draw ball - simple gold style
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, cfg.ballRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          ball.x - cfg.ballRadius * 0.25, ball.y - cfg.ballRadius * 0.25, 0,
          ball.x, ball.y, cfg.ballRadius
        );
        gradient.addColorStop(0, '#ffd54f');   // Light gold highlight
        gradient.addColorStop(0.5, '#d4a817'); // Gold
        gradient.addColorStop(1, '#b8860b');   // Dark gold edge
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    runnerRef.current = {
      stop: () => cancelAnimationFrame(animationId)
    };

    return () => {
      cancelAnimationFrame(animationId);
      ballsRef.current.clear();
    };
  }, [config.rows, config.pegSpacingX, config.pegSpacingY, config.pegRadius, config.ballRadius, centerX, onBallLanded]);

  const dropBall = useCallback((ballData: BallPath) => {
    const finalSlot = calculateFinalSlot(ballData.path);
    const randomX = (Math.random() - 0.5) * 4;

    ballsRef.current.set(ballData.id, {
      x: centerX + randomX,
      y: DROP_ZONE_HEIGHT - 20,
      vx: 0,
      vy: 0,
      path: ballData.path,
      id: ballData.id,
      slot: finalSlot,
      landed: false
    });
  }, [centerX]);

  const clearBalls = useCallback(() => {
    ballsRef.current.clear();
  }, []);

  return { dropBall, clearBalls };
}
