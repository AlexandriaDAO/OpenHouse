import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePlinkoPhysics } from '../../../hooks/usePlinkoPhysics';
import './PlinkoBoard.css';

type GamePhase = 'idle' | 'filling' | 'releasing' | 'animating' | 'complete';

interface PlinkoBoardProps {
  rows: number;
  paths: boolean[][] | null;
  isDropping: boolean;
  onAnimationComplete?: () => void;
  finalPositions?: number[];
  multipliers?: number[];
  ballCount: number;
  onDrop: () => void;
  disabled: boolean;
  // New props for bucket animation
  gamePhase: GamePhase;
  fillProgress: number;
  doorOpen: boolean;
  isWaitingForBackend: boolean;
}


export const PlinkoBoard: React.FC<PlinkoBoardProps> = ({
  rows,
  paths,
  isDropping,
  onAnimationComplete,
  finalPositions,
  multipliers,
  ballCount,
  onDrop,
  disabled,
  gamePhase,
  fillProgress,
  doorOpen,
  isWaitingForBackend,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landedBalls, setLandedBalls] = useState<Set<number>>(new Set());

  // Physics configuration - larger dimensions for better visibility
  // Must match CSS slot positioning: left: calc(50% + ${(i - rows / 2) * 60}px)
  const physicsConfig = {
    rows,
    pegSpacingX: 60,  // Increased from 40
    pegSpacingY: 70,  // Increased from 50
    ballRadius: 14,   // Increased from 8
    pegRadius: 7      // Increased from 4
  };

  // Handle ball landing
  const handleBallLanded = useCallback((ballId: number, _position: number) => {
    setLandedBalls(prev => {
      const newSet = new Set(prev);
      newSet.add(ballId);
      return newSet;
    });
  }, []);

  // Initialize physics
  const { dropBall, clearBalls } = usePlinkoPhysics(
    canvasRef,
    physicsConfig,
    handleBallLanded
  );

  // Drop balls when entering animating phase
  useEffect(() => {
    if (gamePhase !== 'animating' || !paths || paths.length === 0) {
      if (gamePhase === 'idle') {
        clearBalls();
        setLandedBalls(new Set());
      }
      return;
    }

    // Drop each ball with stagger
    paths.forEach((path, index) => {
      setTimeout(() => {
        dropBall({ id: index, path });
      }, index * 200); // 200ms stagger between balls for slower pacing
    });
  }, [gamePhase, paths, dropBall, clearBalls]);

  // Check if all balls landed
  useEffect(() => {
    if (paths && landedBalls.size >= paths.length && gamePhase === 'animating') {
      // Add delay to ensure visuals catch up
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [landedBalls, paths, gamePhase, onAnimationComplete]);

  const handleDropClick = () => {
    if (disabled || gamePhase !== 'idle') return;
    onDrop();
  };

  // Calculate board height - DROP_ZONE_HEIGHT (100) + rows * pegSpacingY (70) + bottom padding (150)
  const boardHeight = 100 + rows * physicsConfig.pegSpacingY + 150;

  // Determine button text
  const getButtonText = () => {
    switch (gamePhase) {
      case 'filling':
        return 'LOADING...';
      case 'releasing':
      case 'animating':
        return 'DROPPING...';
      default:
        return ballCount > 1 ? `DROP ${ballCount}` : 'DROP';
    }
  };

  return (
    <div className="plinko-board-container">
      <div className="plinko-board" style={{ height: `${boardHeight}px` }}>

        {/* Bucket with door */}
        <div className="plinko-bucket">
          <div className="bucket-container">
            {/* Ball reservoir showing fill progress */}
            <div className="bucket-balls-reservoir">
              {Array.from({ length: Math.min(fillProgress, 50) }).map((_, i) => (
                <div
                  key={i}
                  className={`bucket-ball-item ${isWaitingForBackend ? 'waiting' : ''}`}
                  style={isWaitingForBackend ? { animationDelay: `${(i % 10) * 40}ms` } : undefined}
                />
              ))}
            </div>

            {/* Door at bottom */}
            <div className={`bucket-door ${doorOpen ? 'open' : ''}`}>
              <div className="door-left" />
              <div className="door-right" />
            </div>
          </div>

          {/* Drop button */}
          <button
            className="bucket-drop-button"
            onClick={handleDropClick}
            disabled={disabled || gamePhase !== 'idle'}
          >
            {getButtonText()}
          </button>
        </div>

        {/* Physics Canvas */}
        <canvas
          ref={canvasRef}
          className="plinko-physics-canvas"
        />

        {/* Landing slots */}
        <div
          className="plinko-slots"
          style={{ top: `${100 + rows * physicsConfig.pegSpacingY + 30}px` }}
        >
          {Array.from({ length: rows + 1 }, (_, i) => (
            <div
              key={`slot-${i}`}
              className={`plinko-slot ${
                !isDropping && finalPositions?.includes(i) ? 'plinko-slot-active' : ''
              }`}
              style={{
                left: `calc(50% + ${(i - rows / 2) * physicsConfig.pegSpacingX}px)`,
              }}
            >
              {!isDropping && finalPositions && (() => {
                const count = finalPositions.filter(p => p === i).length;
                return count > 1 ? <span className="slot-count">{count}</span> : null;
              })()}
            </div>
          ))}
        </div>

        {/* Multiplier labels */}
        {multipliers && multipliers.length > 0 && (
          <div
            className="plinko-multiplier-labels"
            style={{ top: `${100 + rows * physicsConfig.pegSpacingY + 85}px` }}
          >
            {multipliers.map((mult, index) => {
              const isHighlighted = !isDropping && finalPositions?.includes(index);
              const isWin = mult >= 1.0;

              return (
                <div
                  key={`mult-${index}`}
                  className={`plinko-multiplier-label ${isWin ? 'win-multiplier' : 'lose-multiplier'} ${isHighlighted ? 'highlighted' : ''}`}
                  style={{
                    left: `calc(50% + ${(index - rows / 2) * physicsConfig.pegSpacingX}px)`,
                  }}
                >
                  {mult.toFixed(2)}x
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
