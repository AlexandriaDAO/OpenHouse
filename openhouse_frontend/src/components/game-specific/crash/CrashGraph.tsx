import React, { useRef, useEffect } from 'react';

interface CrashGraphProps {
  isPlaying: boolean;
  currentMultiplier: number;
  crashPoint: number | null;
  history: Array<{ multiplier: number; timestamp: number }>;
}

export const CrashGraph: React.FC<CrashGraphProps> = ({
  isPlaying,
  currentMultiplier,
  crashPoint,
  history
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw multiplier curve
    if (isPlaying) {
      drawMultiplierCurve(ctx, history, currentMultiplier, canvas.width, canvas.height);
    }

    // Draw crash point
    if (crashPoint) {
      drawCrashPoint(ctx, crashPoint, canvas.width, canvas.height);
    }
  }, [isPlaying, currentMultiplier, crashPoint, history]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-full border border-pure-white/20 rounded"
      />

      {/* Axes labels */}
      <div className="absolute bottom-2 right-2 text-xs text-pure-white/60">
        Time (s)
      </div>
      <div className="absolute top-2 left-2 text-xs text-pure-white/60">
        Multiplier
      </div>
    </div>
  );
};

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  // Horizontal lines (multiplier levels)
  for (let i = 0; i <= 10; i++) {
    const y = height - (i * height / 10);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical lines (time)
  for (let i = 0; i <= 10; i++) {
    const x = i * width / 10;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function drawMultiplierCurve(
  ctx: CanvasRenderingContext2D,
  history: Array<{ multiplier: number; timestamp: number }>,
  currentMult: number,
  width: number,
  height: number
) {
  if (history.length === 0) return;

  ctx.strokeStyle = '#29ABE2'; // DFINITY turquoise
  ctx.lineWidth = 3;
  ctx.beginPath();

  // Draw curve based on history points
  history.forEach((point, index) => {
    const x = (index / Math.max(history.length - 1, 1)) * width;
    const y = height - (Math.log10(point.multiplier) / Math.log10(100)) * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function drawCrashPoint(
  ctx: CanvasRenderingContext2D,
  crashPoint: number,
  width: number,
  height: number
) {
  const y = height - (Math.log10(crashPoint) / Math.log10(100)) * height;

  // Red line at crash point
  ctx.strokeStyle = '#ED0047'; // DFINITY red
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crash point label
  ctx.fillStyle = '#ED0047';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`CRASH: ${crashPoint.toFixed(2)}x`, width - 150, y - 10);
}
