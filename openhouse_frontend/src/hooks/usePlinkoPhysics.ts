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
const BOARD_WIDTH = 800;
const DROP_ZONE_HEIGHT = 60;

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
    const gravity = 0.3;
    const bounce = 0.6;
    const friction = 0.98;

    const animate = () => {
      ctx.clearRect(0, 0, BOARD_WIDTH, canvasHeight);

      // Draw pegs
      pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, config.pegRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 1;
        ctx.stroke();
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

        // If crossing into a new row, apply the path direction
        if (nextRow > currentRow && currentRow >= 0 && currentRow < ball.path.length) {
          const goRight = ball.path[currentRow];
          // Give horizontal velocity based on path
          ball.vx = goRight ? 2.5 : -2.5;
        }

        // Apply friction to horizontal movement
        ball.vx *= friction;

        // Move ball
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Bounce off pegs (simple collision)
        pegs.forEach(peg => {
          const dx = ball.x - peg.x;
          const dy = ball.y - peg.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = cfg.ballRadius + cfg.pegRadius;

          if (dist < minDist && dist > 0) {
            // Collision! Push ball out and bounce
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // Reflect velocity
            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * bounce;
            ball.vy = (ball.vy - 2 * dot * ny) * bounce;
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

        // Draw ball
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, cfg.ballRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          ball.x - cfg.ballRadius * 0.3, ball.y - cfg.ballRadius * 0.3, 0,
          ball.x, ball.y, cfg.ballRadius
        );
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(0.3, '#FFD700');
        gradient.addColorStop(1, '#FFA500');
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.stroke();
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
