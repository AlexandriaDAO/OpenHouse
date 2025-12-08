import React, { useEffect, useRef, useState } from 'react';
import { PLINKO_LAYOUT } from './plinkoAnimations';
import { TunnelPhysicsEngine, TunnelBallState } from './TunnelPhysicsEngine';

interface TunnelFillingBallsProps {
  ballCount: number;
  isFilling: boolean;
  onFillingComplete?: () => void;
  staggerMs?: number;
}

/**
 * Physics-based animation of balls dropping into the release tunnel.
 * Provides visual feedback while waiting for backend response.
 */
export const TunnelFillingBalls: React.FC<TunnelFillingBallsProps> = ({
  ballCount,
  isFilling,
  onFillingComplete,
  staggerMs = 60,
}) => {
  const engineRef = useRef<TunnelPhysicsEngine | null>(null);
  const [ballStates, setBallStates] = useState<Map<number, TunnelBallState>>(new Map());
  const hasStartedRef = useRef(false);

  const centerX = PLINKO_LAYOUT.BOARD_WIDTH / 2;

  // Initialize/cleanup physics engine
  useEffect(() => {
    const engine = new TunnelPhysicsEngine({
      centerX,
      onBallUpdate: (states) => {
        setBallStates(new Map(states));
      },
      onAllSettled: () => {
        onFillingComplete?.();
      },
    });

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
      hasStartedRef.current = false;
    };
  }, [centerX, onFillingComplete]);

  // Start dropping balls when filling begins
  useEffect(() => {
    if (isFilling && engineRef.current && !hasStartedRef.current) {
      hasStartedRef.current = true;
      engineRef.current.dropBalls(ballCount, staggerMs);
    }
  }, [isFilling, ballCount, staggerMs]);

  // Reset when not filling
  useEffect(() => {
    if (!isFilling) {
      hasStartedRef.current = false;
      setBallStates(new Map());
      // Recreate engine for next fill
      if (engineRef.current) {
        engineRef.current.destroy();
        const engine = new TunnelPhysicsEngine({
          centerX,
          onBallUpdate: (states) => {
            setBallStates(new Map(states));
          },
          onAllSettled: () => {
            onFillingComplete?.();
          },
        });
        engineRef.current = engine;
        engine.start();
      }
    }
  }, [isFilling, centerX, onFillingComplete]);

  if (!isFilling || ballStates.size === 0) return null;

  return (
    <g>
      {/* Clip to tunnel shape */}
      <defs>
        <clipPath id="tunnelFillClip">
          <path d={`
            M ${centerX - 12} -50
            L ${centerX + 12} -50
            L ${centerX + 12} 15
            L ${centerX + 40} 70
            L ${centerX - 40} 70
            L ${centerX - 12} 15
            Z
          `} />
        </clipPath>
      </defs>

      <g clipPath="url(#tunnelFillClip)">
        {Array.from(ballStates.entries()).map(([id, state]) => (
          <TunnelBall key={id} state={state} />
        ))}
      </g>
    </g>
  );
};

// Individual ball renderer
const BALL_RADIUS = 5;

const TunnelBall: React.FC<{ state: TunnelBallState }> = ({ state }) => {
  const { x, y, rotation } = state;

  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
      {/* Main ball */}
      <circle r={BALL_RADIUS} fill="url(#tunnelBallGradient)" />
      {/* Highlight */}
      <circle
        cx={-BALL_RADIUS * 0.25}
        cy={-BALL_RADIUS * 0.25}
        r={BALL_RADIUS * 0.3}
        fill="white"
        opacity={0.5}
      />
    </g>
  );
};

export default TunnelFillingBalls;
