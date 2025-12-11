import React, { useEffect, useRef } from 'react';

interface RouletteWheelProps {
  winningNumber: number | null;
  isSpinning: boolean;
}

// European roulette wheel order (clockwise)
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const RouletteWheel: React.FC<RouletteWheelProps> = ({ winningNumber, isSpinning }) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const ballTrackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSpinning && winningNumber !== null && wheelRef.current && ballTrackRef.current) {
      // Find degree for winning number
      const winningIndex = WHEEL_NUMBERS.indexOf(winningNumber);
      const degree = (winningIndex * 9.73) + 362; // 360/37 ≈ 9.73 degrees per slot

      // Start wheel rotation
      wheelRef.current.style.animation = 'wheelRotate 5s linear infinite';
      ballTrackRef.current.style.animation = 'ballRotate 1s linear infinite';

      // Slow down ball after 2s
      setTimeout(() => {
        if (ballTrackRef.current) {
          ballTrackRef.current.style.animation = 'ballRotate 2s linear infinite';
        }
      }, 2000);

      // Final deceleration at 6s
      setTimeout(() => {
        if (ballTrackRef.current) {
          ballTrackRef.current.style.animation = `ballStop 3s linear`;
          ballTrackRef.current.style.transform = `rotate(-${degree}deg)`;
        }
      }, 6000);

      // Stop completely at 9s
      setTimeout(() => {
        if (ballTrackRef.current && wheelRef.current) {
          ballTrackRef.current.style.animation = '';
          ballTrackRef.current.style.transform = `rotate(-${degree}deg)`;
          wheelRef.current.style.animation = '';
        }
      }, 9000);
    }
  }, [isSpinning, winningNumber]);

  return (
    <div className="relative flex items-center justify-center">
      <style>{`
        @keyframes wheelRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(359deg); }
        }
        @keyframes ballRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(-359deg); }
        }
        @keyframes ballStop {
          from { transform: rotate(0deg); }
          to { transform: rotate(-${winningNumber !== null ? (WHEEL_NUMBERS.indexOf(winningNumber) * 9.73) + 362 : 0}deg); }
        }
      `}</style>

      <div ref={wheelRef} className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96">
        {/* Outer rim */}
        <div className="absolute inset-0 rounded-full border-8 border-yellow-600 bg-gradient-radial from-yellow-800 to-yellow-900" />

        {/* Number sections */}
        {WHEEL_NUMBERS.map((number, index) => {
          const rotation = index * 9.73; // 360/37 degrees per section
          const isRed = RED_NUMBERS.includes(number);
          const isGreen = number === 0;
          const bgColor = isGreen ? 'bg-green-600' : isRed ? 'bg-red-600' : 'bg-black';

          return (
            <div
              key={`sect-${index}`}
              className="absolute inset-0 flex items-start justify-center"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              <div className={`${bgColor} text-white text-xs font-bold px-1 py-0.5 rounded mt-8`}>
                {number}
              </div>
            </div>
          );
        })}

        {/* Pockets rim */}
        <div className="absolute inset-4 rounded-full border-4 border-yellow-700" />

        {/* Ball track */}
        <div ref={ballTrackRef} className="absolute inset-8 rounded-full">
          <div className="absolute top-0 left-1/2 w-3 h-3 bg-white rounded-full shadow-lg -translate-x-1/2" />
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
      </div>
    </div>
  );
};
