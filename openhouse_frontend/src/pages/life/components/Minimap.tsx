/**
 * Minimap - Territory overview for Game of Life
 *
 * Shows the full 512x512 grid as a small overview with:
 * - Territory colors by dominant owner per quadrant
 * - Cell activity indicators
 * - Current viewport indicator
 * - Wipe countdown warnings
 * - Click-to-navigate functionality
 *
 * Uses Canvas 2D for efficient rendering
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  GRID_SIZE,
  QUADRANT_SIZE,
  QUADRANTS_PER_ROW,
  TOTAL_QUADRANTS,
  PLAYER_COLORS,
  REGIONS,
} from '../../lifeConstants';
import type { Cell } from '../../life/engine';

export interface MinimapProps {
  /** Current cells array (full grid) */
  cells: Cell[];
  /** Current quadrant being viewed (0-15) */
  currentQuadrant: number;
  /** Wipe countdown info */
  wipeInfo: { quadrant: number; secondsUntil: number } | null;
  /** Current player number (for highlighting their territory) */
  myPlayerNum: number | null;
  /** Callback when clicking a quadrant to navigate */
  onQuadrantClick: (quadrant: number) => void;
  /** Size of the minimap in pixels */
  size?: number;
  /** Whether to show in collapsed mode */
  collapsed?: boolean;
  /** Callback to toggle collapsed state */
  onToggleCollapsed?: () => void;
}

interface QuadrantStats {
  totalCells: number;
  ownerCounts: Map<number, number>;
  dominantOwner: number;
  dominantCount: number;
  density: number;
}

/**
 * Calculate statistics for each quadrant
 */
function calculateQuadrantStats(cells: Cell[]): QuadrantStats[] {
  const stats: QuadrantStats[] = [];

  if (cells.length === 0) {
    // Return empty stats for all quadrants
    for (let q = 0; q < TOTAL_QUADRANTS; q++) {
      stats.push({
        totalCells: 0,
        ownerCounts: new Map(),
        dominantOwner: 0,
        dominantCount: 0,
        density: 0,
      });
    }
    return stats;
  }

  for (let q = 0; q < TOTAL_QUADRANTS; q++) {
    const qRow = Math.floor(q / QUADRANTS_PER_ROW);
    const qCol = q % QUADRANTS_PER_ROW;
    const startY = qRow * QUADRANT_SIZE;
    const startX = qCol * QUADRANT_SIZE;

    let totalCells = 0;
    const ownerCounts = new Map<number, number>();

    for (let row = startY; row < startY + QUADRANT_SIZE; row++) {
      for (let col = startX; col < startX + QUADRANT_SIZE; col++) {
        const cell = cells[row * GRID_SIZE + col];
        if (cell && cell.alive && cell.owner > 0) {
          totalCells++;
          const count = ownerCounts.get(cell.owner) || 0;
          ownerCounts.set(cell.owner, count + 1);
        }
      }
    }

    // Find dominant owner
    let dominantOwner = 0;
    let dominantCount = 0;
    for (const [owner, count] of ownerCounts) {
      if (count > dominantCount) {
        dominantOwner = owner;
        dominantCount = count;
      }
    }

    stats.push({
      totalCells,
      ownerCounts,
      dominantOwner,
      dominantCount,
      density: totalCells / (QUADRANT_SIZE * QUADRANT_SIZE),
    });
  }

  return stats;
}

export const Minimap: React.FC<MinimapProps> = ({
  cells,
  currentQuadrant,
  wipeInfo,
  myPlayerNum,
  onQuadrantClick,
  size = 128,
  collapsed = false,
  onToggleCollapsed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const quadSize = size / QUADRANTS_PER_ROW;

  // Draw the minimap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate quadrant stats
    const stats = calculateQuadrantStats(cells);

    // Clear canvas
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, size, size);

    // Draw each quadrant
    for (let q = 0; q < TOTAL_QUADRANTS; q++) {
      const qRow = Math.floor(q / QUADRANTS_PER_ROW);
      const qCol = q % QUADRANTS_PER_ROW;
      const x = qCol * quadSize;
      const y = qRow * quadSize;
      const stat = stats[q];

      // Background: slight color from dominant owner
      if (stat.dominantOwner > 0 && stat.density > 0.001) {
        const region = REGIONS[stat.dominantOwner];
        if (region) {
          // Use territory color with intensity based on density
          const alpha = Math.min(0.6, 0.1 + stat.density * 3);
          ctx.fillStyle = region.primaryColor;
          ctx.globalAlpha = alpha;
          ctx.fillRect(x + 1, y + 1, quadSize - 2, quadSize - 2);
          ctx.globalAlpha = 1;
        }
      }

      // Draw activity dots for each owner with significant presence
      if (stat.ownerCounts.size > 0) {
        const sortedOwners = Array.from(stat.ownerCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4); // Top 4 owners

        const dotSize = Math.max(2, quadSize / 8);
        const spacing = quadSize / 5;

        sortedOwners.forEach(([owner, count], idx) => {
          const color = PLAYER_COLORS[owner] || '#FFFFFF';
          const dotAlpha = Math.min(1, 0.3 + (count / (QUADRANT_SIZE * QUADRANT_SIZE)) * 10);

          // Position dots in a small grid within the quadrant
          const dotX = x + spacing + (idx % 2) * spacing * 2;
          const dotY = y + spacing + Math.floor(idx / 2) * spacing * 2;

          ctx.beginPath();
          ctx.arc(dotX, dotY, dotSize * dotAlpha, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
      }
    }

    // Highlight upcoming wipe quadrants
    if (wipeInfo) {
      // Third quadrant (+2m) - subtle yellow
      const q3 = (wipeInfo.quadrant + 2) % TOTAL_QUADRANTS;
      drawWipeWarning(ctx, q3, quadSize, '#EAB308', 0.15, 1);

      // Second quadrant (+1m) - orange
      const q2 = (wipeInfo.quadrant + 1) % TOTAL_QUADRANTS;
      drawWipeWarning(ctx, q2, quadSize, '#F97316', 0.2, 1.5);

      // Imminent wipe - red with pulse
      const pulseAlpha = wipeInfo.secondsUntil <= 10
        ? 0.25 + 0.1 * Math.sin(Date.now() / 200)
        : 0.2;
      drawWipeWarning(ctx, wipeInfo.quadrant, quadSize, '#EF4444', pulseAlpha, 2);
    }

    // Highlight my player's home quadrant if known
    if (myPlayerNum !== null) {
      // Find quadrant with most of my territory
      let myQuadrant = -1;
      let maxMyCells = 0;
      stats.forEach((stat, q) => {
        const myCells = stat.ownerCounts.get(myPlayerNum) || 0;
        if (myCells > maxMyCells) {
          maxMyCells = myCells;
          myQuadrant = q;
        }
      });

      if (myQuadrant >= 0 && myQuadrant !== currentQuadrant) {
        const qRow = Math.floor(myQuadrant / QUADRANTS_PER_ROW);
        const qCol = myQuadrant % QUADRANTS_PER_ROW;
        const region = REGIONS[myPlayerNum];
        if (region) {
          ctx.strokeStyle = region.primaryColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.strokeRect(qCol * quadSize + 2, qRow * quadSize + 2, quadSize - 4, quadSize - 4);
          ctx.setLineDash([]);
        }
      }
    }

    // Current viewport indicator (gold rectangle)
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    const curRow = Math.floor(currentQuadrant / QUADRANTS_PER_ROW);
    const curCol = currentQuadrant % QUADRANTS_PER_ROW;
    ctx.strokeRect(curCol * quadSize + 1, curRow * quadSize + 1, quadSize - 2, quadSize - 2);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= QUADRANTS_PER_ROW; i++) {
      const pos = i * quadSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

  }, [cells, currentQuadrant, wipeInfo, myPlayerNum, size, quadSize]);

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const qCol = Math.floor(x / quadSize);
    const qRow = Math.floor(y / quadSize);
    const quadrant = qRow * QUADRANTS_PER_ROW + qCol;

    if (quadrant >= 0 && quadrant < TOTAL_QUADRANTS) {
      onQuadrantClick(quadrant);
    }
  }, [quadSize, size, onQuadrantClick]);

  if (collapsed) {
    return (
      <motion.button
        className="flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 hover:border-white/20 transition-colors"
        onClick={onToggleCollapsed}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
      >
        <span className="text-xs text-gray-400">Map</span>
        <span className="text-xs font-mono text-cyan-400">Q{currentQuadrant}</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      className="flex flex-col gap-1"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">World Map</span>
        {onToggleCollapsed && (
          <button
            onClick={onToggleCollapsed}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            −
          </button>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="cursor-pointer border border-gray-700/50 rounded-lg hover:border-gray-600/50 transition-colors"
        style={{ width: size, height: size }}
        onClick={handleClick}
      />

      {/* Quadrant label */}
      <div className="text-xs text-gray-500 font-mono">
        Q{currentQuadrant}
        {wipeInfo && wipeInfo.quadrant === currentQuadrant && (
          <span className="ml-2 text-red-400 animate-pulse">
            Wipe: {wipeInfo.secondsUntil}s
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1 mt-1">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 border-2 border-yellow-400 rounded-sm" />
          <span className="text-[10px] text-gray-500">View</span>
        </div>
        {wipeInfo && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500/50 rounded-sm" />
            <span className="text-[10px] text-gray-500">Wipe</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Helper to draw wipe warning overlay on a quadrant
 */
function drawWipeWarning(
  ctx: CanvasRenderingContext2D,
  quadrant: number,
  quadSize: number,
  color: string,
  fillAlpha: number,
  strokeWidth: number
) {
  const qRow = Math.floor(quadrant / QUADRANTS_PER_ROW);
  const qCol = quadrant % QUADRANTS_PER_ROW;
  const x = qCol * quadSize;
  const y = qRow * quadSize;

  ctx.fillStyle = color;
  ctx.globalAlpha = fillAlpha;
  ctx.fillRect(x + 1, y + 1, quadSize - 2, quadSize - 2);
  ctx.globalAlpha = 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.strokeRect(x, y, quadSize, quadSize);
}

export default Minimap;
