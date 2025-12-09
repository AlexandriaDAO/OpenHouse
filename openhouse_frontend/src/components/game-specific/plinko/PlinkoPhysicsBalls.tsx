import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PLINKO_LAYOUT } from './plinkoAnimations';
import { PlinkoPhysicsEngine, BallState } from './PlinkoEngine';

interface PendingBall {
  id: number;
  path: boolean[];
}

interface PlinkoPhysicsBallsProps {
  rows: number;
  // Filling phase props
  isFilling?: boolean;
  fillBallCount?: number;
  onFillingComplete?: () => void;
  // Releasing/playing phase props
  isReleasing?: boolean;
  pendingBalls?: PendingBall[];
  onAllBallsLanded: () => void;
  onBallLanded?: (slotIndex: number) => void;
  staggerMs?: number;
}

export const PlinkoPhysicsBalls: React.FC<PlinkoPhysicsBallsProps> = ({
  rows,
  isFilling = false,
  fillBallCount = 0,
  onFillingComplete,
  isReleasing = false,
  pendingBalls = [],
  onAllBallsLanded,
  onBallLanded,
  staggerMs = PLINKO_LAYOUT.BALL_STAGGER_MS,
}) => {
  const engineRef = useRef<PlinkoPhysicsEngine | null>(null);
  const [ballStates, setBallStates] = useState<Map<number, BallState>>(new Map());
  const landedBallsRef = useRef<Set<number>>(new Set());
  const totalBallsRef = useRef<number>(0);
  const hasStartedFillingRef = useRef(false);
  const settleCheckIntervalRef = useRef<number | null>(null);
  const hasNotifiedSettledRef = useRef(false);

  // Initialize physics engine
  useEffect(() => {
    const engine = new PlinkoPhysicsEngine({
      rows,
      width: PLINKO_LAYOUT.BOARD_WIDTH,
      height: PLINKO_LAYOUT.BOARD_HEIGHT,
      onBallUpdate: (id, state) => {
        setBallStates(prev => {
          const next = new Map(prev);
          next.set(id, state);
          return next;
        });
      },
      onBallLanded: (id, slotIndex) => {
        landedBallsRef.current.add(id);
        setBallStates(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });

        // Notify parent of the slot where ball landed
        onBallLanded?.(slotIndex);

        // Check if all balls have landed
        if (landedBallsRef.current.size === totalBallsRef.current && totalBallsRef.current > 0) {
          setTimeout(() => {
            onAllBallsLanded();
          }, 100);
        }
      },
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
      if (settleCheckIntervalRef.current) {
        clearInterval(settleCheckIntervalRef.current);
        settleCheckIntervalRef.current = null;
      }
    };
  }, [rows, onAllBallsLanded, onBallLanded]);

  // Handle filling phase - drop balls into bucket
  useEffect(() => {
    if (isFilling && fillBallCount > 0 && engineRef.current && !hasStartedFillingRef.current) {
      hasStartedFillingRef.current = true;
      hasNotifiedSettledRef.current = false;
      totalBallsRef.current = fillBallCount;
      landedBallsRef.current = new Set();

      // Drop balls into bucket with stagger
      for (let i = 0; i < fillBallCount; i++) {
        engineRef.current.dropBallIntoBucket(i, i * staggerMs);
      }

      // Start checking if balls have settled
      settleCheckIntervalRef.current = window.setInterval(() => {
        if (engineRef.current && !hasNotifiedSettledRef.current) {
          if (engineRef.current.areBallsSettled()) {
            hasNotifiedSettledRef.current = true;
            onFillingComplete?.();
          }
        }
      }, 100);
    }
  }, [isFilling, fillBallCount, staggerMs, onFillingComplete]);

  // Handle release phase - open bucket and assign paths
  useEffect(() => {
    if (isReleasing && pendingBalls && pendingBalls.length > 0 && engineRef.current) {
      // Clear settle check interval
      if (settleCheckIntervalRef.current) {
        clearInterval(settleCheckIntervalRef.current);
        settleCheckIntervalRef.current = null;
      }

      // Assign paths to balls before opening bucket
      pendingBalls.forEach((ball) => {
        engineRef.current?.assignPathToBall(ball.id, ball.path);
      });

      // Open bucket gate - balls fall naturally through pegs
      engineRef.current.openBucket();
    }
  }, [isReleasing, pendingBalls]);

  // Reset when not filling and not releasing (game ended)
  useEffect(() => {
    if (!isFilling && !isReleasing && engineRef.current) {
      // Only reset if we previously started
      if (hasStartedFillingRef.current) {
        hasStartedFillingRef.current = false;
        hasNotifiedSettledRef.current = false;

        // Clear any leftover settle check
        if (settleCheckIntervalRef.current) {
          clearInterval(settleCheckIntervalRef.current);
          settleCheckIntervalRef.current = null;
        }

        // Reset bucket for next round
        engineRef.current.resetBucket();
      }
    }
  }, [isFilling, isReleasing]);

  // Bucket dimensions for clipping during fill phase
  const BUCKET = {
    TOP_Y: 5,
    BOTTOM_Y: 70,
    WIDTH: 140,
  };
  const centerX = PLINKO_LAYOUT.BOARD_WIDTH / 2;

  return (
    <g>
      {/* SVG defs for ball rendering */}
      <defs>
        {/* Ball gradient - metallic gold */}
        <radialGradient id="physicsBallGradient" cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fff7cc" />
          <stop offset="30%" stopColor="#ffd700" />
          <stop offset="70%" stopColor="#daa520" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>

        {/* Ball shadow filter */}
        <filter id="physicsBallShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
        </filter>

        {/* Clip path for bucket area during filling */}
        <clipPath id="bucketClip">
          <rect
            x={centerX - BUCKET.WIDTH / 2}
            y={BUCKET.TOP_Y}
            width={BUCKET.WIDTH}
            height={BUCKET.BOTTOM_Y - BUCKET.TOP_Y}
          />
        </clipPath>
      </defs>

      {/* Render balls - clip to bucket during filling, full view when releasing */}
      {isFilling && !isReleasing ? (
        <g clipPath="url(#bucketClip)">
          {Array.from(ballStates.entries()).map(([id, state]) => (
            <PhysicsBall key={id} state={state} />
          ))}
        </g>
      ) : (
        Array.from(ballStates.entries()).map(([id, state]) => (
          <PhysicsBall key={id} state={state} />
        ))
      )}
    </g>
  );
};

// Individual ball renderer - unified with tunnel balls
const BALL_RADIUS = 8;  // Matches tunnel balls for seamless transition

const PhysicsBall: React.FC<{ state: BallState }> = ({ state }) => {
  const { x, y, rotation } = state;

  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
    >
      <g filter="url(#physicsBallShadow)">
        {/* Drop shadow */}
        <ellipse
          cx={2}
          cy={BALL_RADIUS + 2}
          rx={BALL_RADIUS * 0.7}
          ry={BALL_RADIUS * 0.25}
          fill="black"
          opacity={0.15}
        />

        {/* Main ball */}
        <circle
          r={BALL_RADIUS}
          fill="url(#physicsBallGradient)"
        />

        {/* Specular highlight */}
        <ellipse
          cx={-BALL_RADIUS * 0.3}
          cy={-BALL_RADIUS * 0.3}
          rx={BALL_RADIUS * 0.35}
          ry={BALL_RADIUS * 0.25}
          fill="white"
          opacity={0.6}
        />

        {/* Secondary highlight */}
        <circle
          cx={-BALL_RADIUS * 0.15}
          cy={-BALL_RADIUS * 0.45}
          r={BALL_RADIUS * 0.1}
          fill="white"
          opacity={0.8}
        />
      </g>
    </g>
  );
};

export default PlinkoPhysicsBalls;
