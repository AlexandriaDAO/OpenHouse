import { useEffect, useRef, useCallback } from 'react';
import Matter from 'matter-js';

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

// Collision categories for filtering
const CATEGORY_PEG = 0x0001;
const CATEGORY_BALL = 0x0002;
const CATEGORY_WALL = 0x0004;

export function usePlinkoPhysics(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  config: PhysicsConfig,
  onBallLanded: (ballId: number, position: number) => void
) {
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<Map<number, { body: Matter.Body; path: boolean[]; slot: number; landed: boolean }>>(new Map());
  const configRef = useRef(config);
  const onBallLandedRef = useRef(onBallLanded);

  configRef.current = config;
  onBallLandedRef.current = onBallLanded;

  const centerX = BOARD_WIDTH / 2;
  const canvasHeight = DROP_ZONE_HEIGHT + config.rows * config.pegSpacingY + 120;

  // Initialize Matter.js engine and renderer
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Set canvas dimensions
    canvas.width = BOARD_WIDTH;
    canvas.height = canvasHeight;

    // Create engine
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.5 }
    });
    engineRef.current = engine;

    // Create renderer attached to our canvas
    const render = Matter.Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: BOARD_WIDTH,
        height: canvasHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: window.devicePixelRatio || 1
      }
    });
    renderRef.current = render;

    // Create pegs
    const pegs: Matter.Body[] = [];
    for (let row = 0; row <= config.rows; row++) {
      const pegsInRow = row + 1;
      for (let col = 0; col < pegsInRow; col++) {
        const x = centerX + (col - row / 2) * config.pegSpacingX;
        const y = DROP_ZONE_HEIGHT + row * config.pegSpacingY;

        const peg = Matter.Bodies.circle(x, y, config.pegRadius, {
          isStatic: true,
          restitution: 0.5,
          friction: 0.1,
          render: {
            fillStyle: '#e8e8e8'
          },
          collisionFilter: {
            category: CATEGORY_PEG,
            mask: CATEGORY_BALL
          },
          label: 'peg'
        });
        pegs.push(peg);
      }
    }

    // Create boundary walls (invisible)
    const leftWallX = centerX - (config.rows / 2 + 1.5) * config.pegSpacingX;
    const rightWallX = centerX + (config.rows / 2 + 1.5) * config.pegSpacingX;

    const leftWall = Matter.Bodies.rectangle(
      leftWallX, canvasHeight / 2, 20, canvasHeight,
      {
        isStatic: true,
        render: { visible: false },
        collisionFilter: {
          category: CATEGORY_WALL,
          mask: CATEGORY_BALL
        }
      }
    );

    const rightWall = Matter.Bodies.rectangle(
      rightWallX, canvasHeight / 2, 20, canvasHeight,
      {
        isStatic: true,
        render: { visible: false },
        collisionFilter: {
          category: CATEGORY_WALL,
          mask: CATEGORY_BALL
        }
      }
    );

    // Create slot dividers at the bottom to guide balls into slots
    const bottomY = DROP_ZONE_HEIGHT + config.rows * config.pegSpacingY + 30;
    const slotDividers: Matter.Body[] = [];
    for (let i = 0; i <= config.rows + 1; i++) {
      const x = centerX + (i - config.rows / 2 - 0.5) * config.pegSpacingX;
      const divider = Matter.Bodies.rectangle(x, bottomY + 30, 4, 60, {
        isStatic: true,
        render: { visible: false },
        collisionFilter: {
          category: CATEGORY_WALL,
          mask: CATEGORY_BALL
        }
      });
      slotDividers.push(divider);
    }

    // Add all bodies to world
    Matter.Composite.add(engine.world, [...pegs, leftWall, rightWall, ...slotDividers]);

    // Create runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;

    // Track ball positions for landing detection
    const checkLandings = () => {
      const cfg = configRef.current;
      const landingY = DROP_ZONE_HEIGHT + cfg.rows * cfg.pegSpacingY + 40;

      ballsRef.current.forEach((ballData, ballId) => {
        if (ballData.landed) return;

        const ball = ballData.body;

        // Check if ball has landed
        if (ball.position.y > landingY && Math.abs(ball.velocity.y) < 2) {
          ballData.landed = true;

          // Snap ball to slot center
          const slotX = centerX + (ballData.slot - cfg.rows / 2) * cfg.pegSpacingX;
          Matter.Body.setPosition(ball, { x: slotX, y: landingY });
          Matter.Body.setVelocity(ball, { x: 0, y: 0 });
          Matter.Body.setStatic(ball, true);

          onBallLandedRef.current(ballId, ballData.slot);

          // Remove ball after delay
          setTimeout(() => {
            if (engineRef.current) {
              Matter.Composite.remove(engineRef.current.world, ball);
            }
            ballsRef.current.delete(ballId);
          }, 600);
        }
      });
    };

    // Apply guiding forces to balls based on their path
    const applyGuidingForces = () => {
      const cfg = configRef.current;

      ballsRef.current.forEach((ballData) => {
        if (ballData.landed) return;

        const ball = ballData.body;
        const y = ball.position.y;

        // Determine which row we're near
        const rowFloat = (y - DROP_ZONE_HEIGHT) / cfg.pegSpacingY;
        const currentRow = Math.floor(rowFloat);

        // Only apply force when between rows and we have path data
        if (currentRow >= 0 && currentRow < ballData.path.length) {
          const goRight = ballData.path[currentRow];

          // Calculate target x for this row transition
          const forceMagnitude = 0.0003;
          const forceX = goRight ? forceMagnitude : -forceMagnitude;

          // Apply gentle horizontal force
          Matter.Body.applyForce(ball, ball.position, { x: forceX, y: 0 });
        }

        // As ball gets closer to bottom, apply stronger centering force to slot
        if (currentRow >= cfg.rows - 2) {
          const targetX = centerX + (ballData.slot - cfg.rows / 2) * cfg.pegSpacingX;
          const dx = targetX - ball.position.x;
          const centeringForce = dx * 0.00002;
          Matter.Body.applyForce(ball, ball.position, { x: centeringForce, y: 0 });
        }
      });
    };

    // Event listener for engine updates
    Matter.Events.on(engine, 'afterUpdate', () => {
      applyGuidingForces();
      checkLandings();
    });

    // Start the engine and renderer
    Matter.Runner.run(runner, engine);
    Matter.Render.run(render);

    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
      Matter.Composite.clear(engine.world, false);
      ballsRef.current.clear();
    };
  }, [config.rows, config.pegSpacingX, config.pegSpacingY, config.pegRadius, config.ballRadius, centerX, canvasHeight]);

  const dropBall = useCallback((ballData: BallPath) => {
    if (!engineRef.current) return;

    const cfg = configRef.current;
    const finalSlot = calculateFinalSlot(ballData.path);
    const randomX = (Math.random() - 0.5) * 8;

    // Create ball with gold gradient-like appearance
    const ball = Matter.Bodies.circle(
      centerX + randomX,
      DROP_ZONE_HEIGHT - 20,
      cfg.ballRadius,
      {
        restitution: 0.5,
        friction: 0.05,
        frictionAir: 0.01,
        density: 0.001,
        render: {
          fillStyle: '#d4a817',
          strokeStyle: '#b8860b',
          lineWidth: 2
        },
        collisionFilter: {
          category: CATEGORY_BALL,
          mask: CATEGORY_PEG | CATEGORY_WALL | CATEGORY_BALL
        },
        label: `ball-${ballData.id}`
      }
    );

    // Add small random initial velocity
    Matter.Body.setVelocity(ball, { x: (Math.random() - 0.5) * 0.5, y: 1 });

    Matter.Composite.add(engineRef.current.world, ball);

    ballsRef.current.set(ballData.id, {
      body: ball,
      path: ballData.path,
      slot: finalSlot,
      landed: false
    });
  }, [centerX]);

  const clearBalls = useCallback(() => {
    if (!engineRef.current) return;

    ballsRef.current.forEach((ballData) => {
      Matter.Composite.remove(engineRef.current!.world, ballData.body);
    });
    ballsRef.current.clear();
  }, []);

  return { dropBall, clearBalls };
}
