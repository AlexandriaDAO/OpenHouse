import React, { useEffect, useRef, useState } from 'react';

// Animation timing constants
const TIMING = {
  MIN_SPIN_DURATION: 2000,    // Minimum time ball spins (looks bad if too fast)
  LANDING_DURATION: 4000,     // Time for ball to decelerate to position
  RESULT_DISPLAY: 5000,       // Time to show results before reset
  HIGHLIGHT_PULSE_MS: 1500,   // Pulse animation duration
};

interface RouletteWheelProps {
  winningNumber: number | null;
  isWaitingForResult: boolean;  // Ball spins fast, no target yet
  isLanding: boolean;           // Ball decelerating to target
  onAnimationComplete?: () => void;
}

// European roulette wheel order (clockwise)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Calculate precise ball position for a winning number
const calculateBallPosition = (winningNumber: number): number => {
  const index = WHEEL_NUMBERS.indexOf(winningNumber);
  const degreesPerSlot = 360 / 37;
  // Add multiple full rotations for visual effect (5 full spins + target position)
  const totalRotation = (5 * 360) + (index * degreesPerSlot);
  return totalRotation;
};

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  winningNumber,
  isWaitingForResult,
  isLanding,
  onAnimationComplete
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const ballTrackRef = useRef<HTMLDivElement>(null);
  const [showResult, setShowResult] = useState(false);
  const [finalRotation, setFinalRotation] = useState<number | null>(null);

  // Handle waiting phase - continuous fast spinning
  useEffect(() => {
    if (isWaitingForResult && ballTrackRef.current && wheelRef.current) {
      // Start continuous fast spinning
      wheelRef.current.style.transition = 'none';
      wheelRef.current.style.animation = 'wheelSpin 3s linear infinite';
      ballTrackRef.current.style.transition = 'none';
      ballTrackRef.current.style.animation = 'ballSpin 0.5s linear infinite';
      setShowResult(false);
      setFinalRotation(null);
    }
  }, [isWaitingForResult]);

  // Handle landing phase - decelerate to winning position
  useEffect(() => {
    if (isLanding && winningNumber !== null && ballTrackRef.current && wheelRef.current) {
      const targetRotation = calculateBallPosition(winningNumber);
      setFinalRotation(targetRotation);

      // Stop wheel spinning animation
      wheelRef.current.style.animation = 'none';

      // Ball: transition from current spin to final position
      ballTrackRef.current.style.animation = 'none';
      // Small delay to let animation: none take effect
      requestAnimationFrame(() => {
        if (ballTrackRef.current) {
          ballTrackRef.current.style.transition = `transform ${TIMING.LANDING_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
          ballTrackRef.current.style.transform = `rotate(-${targetRotation}deg)`;
        }
      });

      // Show result after landing
      const resultTimer = setTimeout(() => {
        setShowResult(true);
        onAnimationComplete?.();
      }, TIMING.LANDING_DURATION);

      return () => clearTimeout(resultTimer);
    }
  }, [isLanding, winningNumber, onAnimationComplete]);

  // Reset when not spinning
  useEffect(() => {
    if (!isWaitingForResult && !isLanding && wheelRef.current && ballTrackRef.current) {
      // Only reset if we're truly idle (no winning number showing)
      if (winningNumber === null) {
        wheelRef.current.style.animation = 'none';
        ballTrackRef.current.style.animation = 'none';
        ballTrackRef.current.style.transition = 'none';
        ballTrackRef.current.style.transform = 'rotate(0deg)';
        setShowResult(false);
        setFinalRotation(null);
      }
    }
  }, [isWaitingForResult, isLanding, winningNumber]);

  const isRed = winningNumber !== null && RED_NUMBERS.includes(winningNumber);
  const isGreen = winningNumber === 0;

  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes wheelSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes ballSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 10px 2px rgba(250, 204, 21, 0.8);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 20px 6px rgba(250, 204, 21, 1);
            transform: scale(1.1);
          }
        }
      `}</style>

      <div ref={wheelRef} className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96">
        {/* Outer rim */}
        <div className="absolute inset-0 rounded-full border-8 border-yellow-600 bg-gradient-radial from-yellow-800 to-yellow-900" />

        {/* Number sections */}
        {WHEEL_NUMBERS.map((number, index) => {
          const rotation = index * (360 / 37);
          const isRedNum = RED_NUMBERS.includes(number);
          const isGreenNum = number === 0;
          const isWinner = showResult && number === winningNumber;

          // Base color
          let bgColor = isGreenNum ? 'bg-green-600' : isRedNum ? 'bg-red-600' : 'bg-black';

          // Winner highlight
          if (isWinner) {
            bgColor = 'bg-yellow-400';
          }

          return (
            <div
              key={`sect-${index}`}
              className="absolute inset-0 flex items-start justify-center"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div
                className={`${bgColor} text-${isWinner ? 'black' : 'white'} text-xs font-bold px-1 py-0.5 rounded mt-8 transition-all duration-300 ${
                  isWinner ? 'animate-pulse shadow-lg shadow-yellow-400/50 scale-125 z-20' : ''
                }`}
              >
                {number}
              </div>
            </div>
          );
        })}

        {/* Pockets rim */}
        <div className="absolute inset-4 rounded-full border-4 border-yellow-700" />

        {/* Ball track */}
        <div ref={ballTrackRef} className="absolute inset-8 rounded-full">
          <div
            className={`absolute top-0 left-1/2 w-3 h-3 bg-white rounded-full shadow-lg -translate-x-1/2 transition-shadow duration-300 ${
              (isWaitingForResult || isLanding) ? 'shadow-white/50' : ''
            } ${showResult ? 'shadow-[0_0_10px_3px_rgba(255,255,255,0.8)]' : ''}`}
          />
        </div>

        {/* Pockets */}
        <div className="absolute inset-12 rounded-full bg-gradient-radial from-yellow-900 to-gray-900" />

        {/* Center cone */}
        <div className="absolute inset-16 rounded-full bg-gradient-radial from-red-900 to-black" />

        {/* Turret */}
        <div className="absolute inset-20 rounded-full bg-gradient-radial from-yellow-600 to-yellow-800 border-2 border-yellow-500" />

        {/* Turret handle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-24 bg-yellow-600 rounded" />
        </div>

        {/* Winning number callout - center overlay */}
        {showResult && winningNumber !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div
              className="bg-black/90 rounded-full w-20 h-20 flex flex-col items-center justify-center border-2 border-yellow-400 animate-in zoom-in duration-300"
              style={{ animation: 'pulse-glow 1.5s ease-in-out infinite' }}
            >
              <span className={`text-3xl font-bold ${isRed ? 'text-red-500' : isGreen ? 'text-green-500' : 'text-white'}`}>
                {winningNumber}
              </span>
              <span className="text-xs text-gray-400">
                {isRed ? 'RED' : isGreen ? 'GREEN' : 'BLACK'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Spinning indicator */}
      {isWaitingForResult && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-2">
          <div className="flex items-center gap-2 text-yellow-400 text-sm animate-pulse">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Spinning...</span>
          </div>
        </div>
      )}
    </div>
  );
};
