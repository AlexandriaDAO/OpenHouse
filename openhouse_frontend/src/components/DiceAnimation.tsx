import React, { useEffect, useState } from 'react';
import './DiceAnimation.css';

interface DiceAnimationProps {
  targetNumber: number | null;
  isRolling: boolean;
  onAnimationComplete?: () => void;
}

export const DiceAnimation: React.FC<DiceAnimationProps> = ({
  targetNumber,
  isRolling,
  onAnimationComplete
}) => {
  // State for current displayed number during animation
  const [displayNumber, setDisplayNumber] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'rolling' | 'complete'>('idle');

  // Start rolling animation when isRolling becomes true
  useEffect(() => {
    if (isRolling) {
      // Start rolling animation
      setAnimationPhase('rolling');

      // Rapidly cycle through random numbers for ~2 seconds
      let frameCount = 0;
      const maxFrames = 60; // 2 seconds at 30fps

      const interval = setInterval(() => {
        // Generate random number 0-100 for visual effect
        setDisplayNumber(Math.floor(Math.random() * 101));
        frameCount++;

        if (frameCount >= maxFrames) {
          clearInterval(interval);
        }
      }, 33); // ~30fps

      return () => clearInterval(interval);
    }
  }, [isRolling]);

  // When backend returns result, slow down and land on target
  useEffect(() => {
    if (targetNumber !== null && animationPhase === 'rolling') {
      // After backend returns result, slow down and land on target
      setTimeout(() => {
        setDisplayNumber(targetNumber);
        setAnimationPhase('complete');
        onAnimationComplete?.();
      }, 2100); // Slightly after rolling animation ends
    }
  }, [targetNumber, animationPhase, onAnimationComplete]);

  // Reset when not rolling
  useEffect(() => {
    if (!isRolling && animationPhase === 'complete') {
      setTimeout(() => {
        setAnimationPhase('idle');
      }, 2000); // Keep result visible for 2s
    }
  }, [isRolling, animationPhase]);

  return (
    <div className="dice-container">
      {/* 3D Dice Visualization */}
      <div className={`dice-cube ${animationPhase === 'rolling' ? 'rolling-animation' : ''}`}>
        {/* Main dice display */}
        <div className="dice-face">
          <span className="dice-number">{displayNumber}</span>
        </div>

        {/* Visual effects during roll */}
        {animationPhase === 'rolling' && (
          <div className="rolling-effects"></div>
        )}
      </div>

      {/* Result indicator when complete */}
      {animationPhase === 'complete' && targetNumber !== null && (
        <div className="result-glow"></div>
      )}
    </div>
  );
};
