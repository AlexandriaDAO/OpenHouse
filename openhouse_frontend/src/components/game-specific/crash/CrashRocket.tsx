import React, { useState, useEffect } from 'react';
import './CrashRocket.css';

interface CrashRocketProps {
  isLaunching: boolean;           // True during countdown/launch
  currentMultiplier: number;      // Current multiplier (1.00 - 100.00)
  crashPoint: number | null;      // Where it crashed (null if still flying)
  onCrashComplete: () => void;    // Callback when crash animation finishes
}

export const CrashRocket: React.FC<CrashRocketProps> = ({
  isLaunching,
  currentMultiplier,
  crashPoint,
  onCrashComplete
}) => {
  // State
  const [rocketPosition, setRocketPosition] = useState(0); // 0-100 (vertical position)
  const [isExploding, setIsExploding] = useState(false);

  // Animation effect
  useEffect(() => {
    if (isLaunching && !crashPoint) {
      // Animate rocket rising based on currentMultiplier
      // Position = log scale based on multiplier
      const position = calculateRocketPosition(currentMultiplier);
      setRocketPosition(position);
    }

    if (crashPoint && currentMultiplier >= crashPoint) {
      // Trigger explosion
      setIsExploding(true);
      setTimeout(() => {
        setIsExploding(false);
        setRocketPosition(0);
        onCrashComplete();
      }, 1000);
    }
  }, [isLaunching, currentMultiplier, crashPoint, onCrashComplete]);

  return (
    <div className="relative h-96 bg-gradient-to-b from-pure-black to-dfinity-navy overflow-hidden">
      {/* Stars background */}
      <div className="absolute inset-0">
        {generateStars(50).map(star => (
          <div
            key={star.id}
            className="star absolute rounded-full"
            style={{
              left: star.style.left,
              top: star.style.top,
              width: star.style.width,
              height: star.style.height,
              backgroundColor: star.style.backgroundColor,
              opacity: star.style.opacity,
            }}
          />
        ))}
      </div>

      {/* Rocket SVG */}
      <div
        className="absolute left-1/2 bottom-0 -translate-x-1/2 transition-transform"
        style={{
          transform: `translateX(-50%) translateY(-${rocketPosition}%)`,
          transitionDuration: isLaunching ? '0.1s' : '0s',
          transitionTimingFunction: 'linear'
        }}
      >
        {/* ICP-themed rocket SVG */}
        <svg width="60" height="80" viewBox="0 0 60 80" className="relative">
          {/* Rocket body - DFINITY turquoise */}
          <path d="M30,0 L45,60 L15,60 Z" fill="#29ABE2" />

          {/* Rocket fins - DFINITY purple */}
          <path d="M15,60 L5,80 L15,70 Z" fill="#3B00B9" />
          <path d="M45,60 L55,80 L45,70 Z" fill="#3B00B9" />

          {/* ICP logo on body */}
          <circle cx="30" cy="30" r="8" fill="#FFFFFF" />
          <text x="30" y="35" fontSize="10" textAnchor="middle" fill="#29ABE2" fontWeight="bold">
            ICP
          </text>

          {/* Flames - animated */}
          {isLaunching && !isExploding && (
            <g className="flames">
              <path d="M20,70 L25,80 L30,75 L35,80 L40,70" fill="#F15A24" />
              <path d="M22,75 L27,82 L30,78 L33,82 L38,75" fill="#ED0047" />
            </g>
          )}
        </svg>

        {/* Smoke trail */}
        {isLaunching && !isExploding && (
          <div className="absolute top-full left-1/2 -translate-x-1/2">
            <div className="smoke-particle" />
          </div>
        )}

        {/* Explosion effect */}
        {isExploding && (
          <div className="explosion-container absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="explosion-circle bg-red-600" />
            <div className="explosion-circle bg-orange-500" style={{ animationDelay: '0.1s' }} />
            <div className="explosion-circle bg-white" style={{ animationDelay: '0.2s' }} />
          </div>
        )}
      </div>

      {/* Multiplier display on rocket */}
      {isLaunching && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="text-4xl font-bold text-dfinity-turquoise drop-shadow-lg">
            {currentMultiplier.toFixed(2)}x
          </div>
        </div>
      )}
    </div>
  );
};

// Helper: Calculate rocket position from multiplier (log scale)
function calculateRocketPosition(multiplier: number): number {
  // 1.00x = 0%, 10.00x = 50%, 100.00x = 100%
  const logMult = Math.log10(multiplier);
  const logMax = Math.log10(100);
  return Math.min((logMult / logMax) * 100, 100);
}

// Helper: Generate star field
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: '2px',
      height: '2px',
      backgroundColor: 'white',
      opacity: Math.random() * 0.7 + 0.3,
    }
  }));
}
