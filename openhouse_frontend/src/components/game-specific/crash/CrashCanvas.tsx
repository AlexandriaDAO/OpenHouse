import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { RocketState } from '../../../pages/Crash';

// Number of rocket/explosion image variants available
const ROCKET_VARIANTS = 3;

// Get rocket image paths for a given variant (1-indexed)
const getRocketImage = (variant: number) => `/rockets/rocket${variant}.png`;
const getExplosionImage = (variant: number) => `/rockets/exploded${variant}.png`;

// 10 distinct colors for trajectory lines
export const ROCKET_COLORS = [
  '#39FF14', // Lime green (original)
  '#FF6B6B', // Coral red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#FF8C00', // Orange
  '#E040FB', // Purple
  '#00BCD4', // Cyan
  '#FF4081', // Pink
  '#7C4DFF', // Indigo
  '#64FFDA', // Aqua
];

interface CrashCanvasProps {
  rocketStates: RocketState[];
  targetMultiplier?: number;
  rocketsSucceeded?: number;
  width?: number;
  height?: number;
}

// Fixed rocket/explosion size (never changes)
const ROCKET_SIZE = 120;
const EXPLOSION_SIZE = 144;

// Padding to keep rockets visible within canvas bounds (half of largest asset)
const ROCKET_MARGIN = Math.ceil(EXPLOSION_SIZE / 2); // 72px

export const CrashCanvas: React.FC<CrashCanvasProps> = ({
  rocketStates,
  targetMultiplier,
  rocketsSucceeded = 0,
  width: initialWidth = 800,
  height: initialHeight = 400
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use state for dynamic sizing, initialized with props
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });

  // Resize Observer to handle fluid layout
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Use contentRect for the content box size
        const { width, height } = entry.contentRect;
        
        // Update if dimensions change (using a small threshold to avoid float jitter)
        setSize(prevSize => {
            if (Math.abs(width - prevSize.width) > 1 || Math.abs(height - prevSize.height) > 1) {
                return { width, height };
            }
            return prevSize;
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Store positions as percentages (0-100) and angle in degrees
  const [rocketPositions, setRocketPositions] = useState<Map<number, { xPercent: number; yPercent: number; angle: number }>>(new Map());

  // Assign each rocket a random image variant (persists for the rocket's lifetime)
  const rocketVariants = useMemo(() => {
    const variants = new Map<number, number>();
    rocketStates.forEach((rocket) => {
      if (!variants.has(rocket.index)) {
        variants.set(rocket.index, Math.floor(Math.random() * ROCKET_VARIANTS) + 1);
      }
    });
    return variants;
  }, [rocketStates.map(r => r.index).join(',')]);

  // Generate stars once
  const stars = useMemo(() => generateStars(50), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = size;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height);

    // Draw target line if set
    if (targetMultiplier && targetMultiplier > 1) {
      drawTargetLine(ctx, targetMultiplier, width, height);
    }

    // Define drawable area with margins for rockets
    // This ensures rockets never go past edges and never get clipped
    const drawableArea = {
      left: ROCKET_MARGIN,
      right: width - ROCKET_MARGIN,
      top: ROCKET_MARGIN,
      bottom: height - ROCKET_MARGIN,
      width: width - (ROCKET_MARGIN * 2),
      height: height - (ROCKET_MARGIN * 2),
    };

    // Keep everything in view - scale X to fit all history
    const maxHistoryLength = Math.max(
      ...rocketStates.map(r => r.history.length),
      100
    );

    // Draw each rocket's trajectory
    const newPositions = new Map<number, { xPercent: number; yPercent: number; angle: number }>();

    rocketStates.forEach((rocket) => {
      if (rocket.history.length === 0) return;

      const color = ROCKET_COLORS[rocket.index % ROCKET_COLORS.length];

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let lastX = drawableArea.left;
      let lastY = drawableArea.bottom;
      let prevX = drawableArea.left;
      let prevY = drawableArea.bottom;

      rocket.history.forEach((point, i) => {
        // Map trajectory to drawable area (with margins)
        const normalizedX = i / maxHistoryLength;
        const x = drawableArea.left + (normalizedX * drawableArea.width);

        const logMult = Math.log10(point.multiplier);
        const logMax = Math.log10(100);
        const normalizedY = Math.min(logMult / logMax, 1);
        const y = drawableArea.bottom - (normalizedY * drawableArea.height);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        prevX = lastX;
        prevY = lastY;
        lastX = x;
        lastY = y;
      });

      ctx.stroke();

      // Calculate angle from the last segment of the trajectory
      const dx = lastX - prevX;
      const dy = lastY - prevY;
      // Canvas Y is inverted (increases downward), so negate dy for proper angle
      const angleRad = Math.atan2(-dy, dx);
      const trajectoryAngle = (angleRad * 180) / Math.PI;

      // Rocket PNG points straight UP (nose at 12 o'clock position)
      // Formula: rocketAngle = 90 - trajectoryAngle
      const rocketAngle = 90 - trajectoryAngle;

      // Convert pixel position to percentage for CSS positioning
      // These are already within safe bounds since trajectory uses drawableArea
      newPositions.set(rocket.index, {
        xPercent: (lastX / width) * 100,
        yPercent: (lastY / height) * 100,
        angle: rocketAngle
      });
    });

    setRocketPositions(newPositions);

  }, [rocketStates, targetMultiplier, size]);

  // Find the highest current multiplier for live display
  const maxCurrentMultiplier = Math.max(
    ...rocketStates.map(r => r.currentMultiplier),
    1.0
  );
  const allCrashed = rocketStates.length > 0 && rocketStates.every(r => r.isCrashed);

  // Calculate actual net return: (winners * target) / total rockets
  const netReturn = rocketStates.length > 0 && targetMultiplier
    ? (rocketsSucceeded * targetMultiplier) / rocketStates.length
    : 0;
  const isProfit = netReturn >= 1.0;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-gradient-to-b from-pure-black to-dfinity-navy rounded-lg overflow-hidden border border-pure-white/20 shadow-2xl"
    >
      {/* Stars Background */}
      <div className="absolute inset-0 opacity-50">
        {stars.map(star => (
          <div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{
              left: star.style.left,
              top: star.style.top,
              width: star.style.width,
              height: star.style.height,
              opacity: star.style.opacity,
            }}
          />
        ))}
      </div>

      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="relative z-10 w-full h-full"
      />

      {/* Rocket Elements - one for each rocket */}
      {rocketStates.map((rocket) => {
        const pos = rocketPositions.get(rocket.index);
        if (!pos) return null;

        const variant = rocketVariants.get(rocket.index) || 1;

        return (
          <div
            key={rocket.index}
            className="absolute pointer-events-none"
            style={{
              left: `${pos.xPercent}%`,
              top: `${pos.yPercent}%`,
              transform: `translate(-50%, -50%) rotate(${pos.angle}deg)`,
              zIndex: rocket.isCrashed ? 25 : 20,
            }}
          >
            {rocket.isCrashed ? (
              <img
                src={getExplosionImage(variant)}
                alt="Explosion"
                width={EXPLOSION_SIZE}
                height={EXPLOSION_SIZE}
                style={{ filter: 'drop-shadow(0 0 12px rgba(255, 100, 0, 0.8))' }}
              />
            ) : (
              <img
                src={getRocketImage(variant)}
                alt="Rocket"
                width={ROCKET_SIZE}
                height={ROCKET_SIZE}
                style={{ filter: 'drop-shadow(0 0 10px rgba(255, 200, 100, 0.6))' }}
              />
            )}
          </div>
        );
      })}

      {/* Current Multiplier Display */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center z-30">
        {allCrashed ? (
          <>
            {/* Show net return when game ends */}
            <div className={`text-5xl font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-500'} drop-shadow-lg`}>
              {netReturn.toFixed(2)}x
            </div>
            <div className={`font-bold text-lg mt-1 ${isProfit ? 'text-green-300' : 'text-red-300'}`}>
              NET RETURN
            </div>
            <div className={`font-bold text-xl mt-2 ${rocketsSucceeded > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {rocketsSucceeded}/{rocketStates.length} reached {targetMultiplier?.toFixed(2)}x
            </div>
          </>
        ) : (
          <>
            {/* Show live max multiplier during flight */}
            <div className="text-5xl font-bold font-mono text-white drop-shadow-lg">
              {maxCurrentMultiplier.toFixed(2)}x
            </div>
          </>
        )}
      </div>

      {/* Rocket count indicator */}
      {rocketStates.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1 z-30">
          {rocketStates.map((rocket) => (
            <div
              key={rocket.index}
              className={`w-3 h-3 rounded-full ${rocket.isCrashed ? 'opacity-30' : ''}`}
              style={{ backgroundColor: ROCKET_COLORS[rocket.index % ROCKET_COLORS.length] }}
            />
          ))}
        </div>
      )}

      {/* Axes labels */}
      <div className="absolute bottom-2 right-2 text-xs text-pure-white/40 font-mono">
        Time
      </div>
      <div className="absolute top-2 left-2 text-xs text-pure-white/40 font-mono">
        Multiplier
      </div>
    </div>
  );
};

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  // Draw grid lines within the drawable area
  const drawableHeight = height - (ROCKET_MARGIN * 2);

  for (let i = 0; i <= 4; i++) {
    const y = ROCKET_MARGIN + drawableHeight - (i * drawableHeight / 4);
    ctx.beginPath();
    ctx.moveTo(ROCKET_MARGIN, y);
    ctx.lineTo(width - ROCKET_MARGIN, y);
    ctx.stroke();
  }
}

function drawTargetLine(
  ctx: CanvasRenderingContext2D,
  targetMultiplier: number,
  width: number,
  height: number
) {
  const drawableHeight = height - (ROCKET_MARGIN * 2);
  const logMult = Math.log10(targetMultiplier);
  const logMax = Math.log10(100);
  const normalizedY = Math.min(logMult / logMax, 1);
  const y = ROCKET_MARGIN + drawableHeight - (normalizedY * drawableHeight);

  // Green dashed line at target
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.moveTo(ROCKET_MARGIN, y);
  ctx.lineTo(width - ROCKET_MARGIN, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label
  ctx.fillStyle = '#22C55E';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`TARGET ${targetMultiplier.toFixed(2)}x`, width - ROCKET_MARGIN - 110, y - 5);
}

function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    style: {
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: `${Math.random() * 2 + 1}px`,
      height: `${Math.random() * 2 + 1}px`,
      opacity: Math.random() * 0.7 + 0.3,
    }
  }));
}