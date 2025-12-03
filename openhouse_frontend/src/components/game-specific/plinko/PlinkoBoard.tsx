import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePlinkoPhysics } from '../../../hooks/usePlinkoPhysics';
import './PlinkoBoard.css';

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [landedBalls, setLandedBalls] = useState<Set<number>>(new Set());
  const [isReleasing, setIsReleasing] = useState(false);

  // Physics configuration - must match CSS slot positioning
  // Slots use: left: calc(50% + ${(i - rows / 2) * 40}px)
  const physicsConfig = {
    rows,
    pegSpacingX: 40,  // Must match CSS slot spacing
    pegSpacingY: 50,
    ballRadius: 8,
    pegRadius: 4
  };

  // Handle ball landing
  const handleBallLanded = useCallback((ballId: number, position: number) => {
    setLandedBalls(prev => {
      const newSet = new Set(prev);
      newSet.add(ballId);
      return newSet;
    });
  }, []);

  // Initialize Matter.js physics
  const { dropBall, clearBalls } = usePlinkoPhysics(
    canvasRef,
    physicsConfig,
    handleBallLanded
  );

  // Drop balls when paths arrive
  useEffect(() => {
    if (!paths || paths.length === 0 || !isDropping) {
      if (!isDropping) {
        clearBalls();
        setLandedBalls(new Set());
        setIsReleasing(false);
      }
      return;
    }

    // Trigger release animation
    setIsReleasing(true);

    // Drop each ball with stagger - starting after brief delay for gate animation
    const dropDelay = 150; // ms before first ball drops
    paths.forEach((path, index) => {
      setTimeout(() => {
        dropBall({ id: index, path });
      }, dropDelay + index * 150); // 150ms stagger between balls
    });

    // Reset release state after all balls dropped
    const totalDropTime = dropDelay + paths.length * 150;
    const timer = setTimeout(() => setIsReleasing(false), totalDropTime + 200);
    return () => clearTimeout(timer);
  }, [paths, isDropping, dropBall, clearBalls]);

  // Check if all balls landed
  useEffect(() => {
    if (paths && landedBalls.size >= paths.length && isDropping) {
      // Add a small delay to ensure visuals catch up
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [landedBalls, paths, isDropping, onAnimationComplete]);

  const handleBucketClick = () => {
    if (disabled || isDropping) return;
    onDrop();
  };

  // Calculate board height for container - must match physics hook
  // DROP_ZONE_HEIGHT (60) + rows * pegSpacingY (50) + bottom padding (120)
  const boardHeight = 60 + rows * physicsConfig.pegSpacingY + 120;

  return (
    <div className="plinko-board-container">
      <div className="plinko-board" style={{ height: `${boardHeight}px` }}>

        {/* Ball Dispenser (React UI) */}
        <div
          className={`plinko-bucket ${disabled || isDropping ? 'bucket-disabled' : ''} ${isReleasing ? 'bucket-releasing' : ''}`}
          onClick={handleBucketClick}
        >
          <div className="bucket-body">
            <div className="bucket-balls">
              {!isReleasing && Array.from({ length: Math.min(ballCount, 8) }).map((_, i) => (
                <div
                  key={i}
                  className="bucket-ball"
                  style={{
                    left: `${8 + (i % 4) * 13}px`,
                    bottom: `${6 + Math.floor(i / 4) * 14}px`,
                  }}
                />
              ))}
            </div>
            {!isReleasing && ballCount > 8 && (
              <span className="bucket-count">+{ballCount - 8}</span>
            )}
          </div>
          <div className="bucket-label">
            {isDropping ? 'DROPPING' : ballCount > 1 ? `×${ballCount}` : 'DROP'}
          </div>
        </div>

        {/* Matter.js Canvas (Physics Rendering) */}
        <canvas
          ref={canvasRef}
          className="plinko-physics-canvas"
        />

        {/* Landing slots (React UI) - positioned to align with physics */}
        <div
          className="plinko-slots"
          style={{ top: `${60 + rows * physicsConfig.pegSpacingY + 30}px` }}
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

        {/* Multiplier labels (React UI) */}
        {multipliers && multipliers.length > 0 && (
          <div
            className="plinko-multiplier-labels"
            style={{ top: `${60 + rows * physicsConfig.pegSpacingY + 70}px` }}
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