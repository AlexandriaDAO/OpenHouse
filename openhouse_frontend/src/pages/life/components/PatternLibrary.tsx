/**
 * PatternLibrary - Browsable pattern picker with previews
 *
 * Features:
 * - Categorized patterns (Spaceships, Guns, Bombs, etc.)
 * - Pattern preview thumbnails rendered on mini canvas
 * - Animated preview on hover
 * - Search/filter functionality
 * - Quick-select favorites
 * - Framer Motion animations
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PATTERNS,
  CATEGORY_INFO,
  type PatternInfo,
  type PatternCategory,
} from '../../lifeConstants';
import { parseRLE, rotatePattern } from '../../lifeUtils';

export interface PatternLibraryProps {
  selectedPattern: PatternInfo;
  onSelectPattern: (pattern: PatternInfo) => void;
  parsedPattern: [number, number][];
  patternRotation: number;
  onRotate: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  playerColor?: string;
}

// Pattern thumbnail size
const THUMB_SIZE = 40;
const PREVIEW_SIZE = 80;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.02 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 }
};

const previewVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 }
};

// Category display order (strategic priority)
const CATEGORY_ORDER: PatternCategory[] = [
  'spaceship',
  'puffer',
  'gun',
  'methuselah',
  'bigBomb',
  'stillLife',
  'oscillator',
  'special'
];

/**
 * Render pattern cells to a canvas
 */
function renderPatternToCanvas(
  ctx: CanvasRenderingContext2D,
  coords: [number, number][],
  size: number,
  color: string,
  animated: boolean = false,
  frame: number = 0
) {
  ctx.clearRect(0, 0, size, size);

  if (coords.length === 0) return;

  // Calculate bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const patternWidth = maxX - minX + 1;
  const patternHeight = maxY - minY + 1;
  const maxDim = Math.max(patternWidth, patternHeight);

  // Calculate cell size with padding
  const padding = 4;
  const availableSize = size - padding * 2;
  const cellSize = Math.min(Math.floor(availableSize / maxDim), 6);

  // Center the pattern
  const offsetX = Math.floor((size - patternWidth * cellSize) / 2);
  const offsetY = Math.floor((size - patternHeight * cellSize) / 2);

  // Draw cells
  ctx.fillStyle = color;
  if (animated) {
    // Subtle pulse effect for animated preview
    const pulse = 0.8 + 0.2 * Math.sin(frame * 0.1);
    ctx.globalAlpha = pulse;
  }

  for (const [x, y] of coords) {
    const px = offsetX + (x - minX) * cellSize;
    const py = offsetY + (y - minY) * cellSize;
    ctx.fillRect(px, py, cellSize - 1, cellSize - 1);
  }

  ctx.globalAlpha = 1;
}

/**
 * Pattern thumbnail component with canvas rendering
 */
const PatternThumbnail: React.FC<{
  pattern: PatternInfo;
  isSelected: boolean;
  onClick: () => void;
  onHover: (pattern: PatternInfo | null) => void;
  color: string;
}> = React.memo(({ pattern, isSelected, onClick, onHover, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const catInfo = CATEGORY_INFO[pattern.category];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = parseRLE(pattern.rle);
    renderPatternToCanvas(ctx, coords, THUMB_SIZE, color);
  }, [pattern, color]);

  return (
    <motion.button
      variants={itemVariants}
      onClick={onClick}
      onMouseEnter={() => onHover(pattern)}
      onMouseLeave={() => onHover(null)}
      className={`relative flex flex-col items-center p-1.5 rounded-lg border transition-all ${
        isSelected
          ? `${catInfo.color} ring-1 ring-white/40`
          : 'bg-black/40 border-white/10 hover:bg-white/10 hover:border-white/20'
      }`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`${pattern.name}: ${pattern.description}`}
    >
      <canvas
        ref={canvasRef}
        width={THUMB_SIZE}
        height={THUMB_SIZE}
        className="rounded"
      />
      <span className="text-[9px] font-mono text-gray-300 mt-1 truncate w-full text-center">
        {pattern.name}
      </span>
      {/* Cell count badge */}
      {pattern.cells && (
        <span className="absolute top-0.5 right-0.5 text-[8px] bg-black/60 px-1 rounded text-gray-400">
          {pattern.cells}
        </span>
      )}
    </motion.button>
  );
});

PatternThumbnail.displayName = 'PatternThumbnail';

/**
 * Animated pattern preview with Game of Life simulation
 */
const AnimatedPreview: React.FC<{
  pattern: PatternInfo;
  color: string;
}> = ({ pattern, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const coordsRef = useRef<[number, number][]>([]);

  useEffect(() => {
    coordsRef.current = parseRLE(pattern.rle);
  }, [pattern]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const animate = () => {
      frameRef.current++;
      renderPatternToCanvas(ctx, coordsRef.current, PREVIEW_SIZE, color, true, frameRef.current);
      animationId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationId);
  }, [color]);

  const catInfo = CATEGORY_INFO[pattern.category];

  return (
    <motion.div
      variants={previewVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute left-full ml-2 top-0 z-50 bg-gray-900/95 backdrop-blur-sm border border-white/20 rounded-lg p-3 shadow-xl"
      style={{ minWidth: '180px' }}
    >
      <div className="flex items-start gap-3">
        <canvas
          ref={canvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          className="rounded bg-black/50"
        />
        <div className="flex-1 min-w-0">
          <div className={`font-mono text-sm font-medium ${catInfo.color.split(' ')[0]}`}>
            {pattern.name}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {pattern.description}
          </div>
          {/* Pattern stats */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px]">
            {pattern.cells && (
              <span className="text-gray-500">
                <span className="text-gray-400">{pattern.cells}</span> cells
              </span>
            )}
            {pattern.speed && (
              <span className="text-gray-500">
                <span className="text-blue-400">{pattern.speed}</span> speed
              </span>
            )}
            {pattern.period && (
              <span className="text-gray-500">
                <span className="text-purple-400">P{pattern.period}</span>
              </span>
            )}
            {pattern.lifespan && (
              <span className="text-gray-500">
                <span className="text-orange-400">{pattern.lifespan.toLocaleString()}</span> gens
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Category tab button
 */
const CategoryTab: React.FC<{
  category: PatternCategory | 'all';
  isSelected: boolean;
  onClick: () => void;
  count: number;
}> = ({ category, isSelected, onClick, count }) => {
  const info = category === 'all'
    ? { label: 'All', color: 'text-white border-white/30 bg-white/10', icon: '◈' }
    : CATEGORY_INFO[category];

  return (
    <motion.button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border whitespace-nowrap ${
        isSelected ? info.color : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <span className="opacity-70">{info.icon}</span>
      <span>{info.label}</span>
      <span className="text-[10px] opacity-60">({count})</span>
    </motion.button>
  );
};

/**
 * Selected pattern info panel
 */
const SelectedPatternInfo: React.FC<{
  pattern: PatternInfo;
  parsedPattern: [number, number][];
  rotation: number;
  onRotate: () => void;
  color: string;
}> = ({ pattern, parsedPattern, rotation, onRotate, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const catInfo = CATEGORY_INFO[pattern.category];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderPatternToCanvas(ctx, parsedPattern, 64, color);
  }, [parsedPattern, color]);

  const rotationDeg = rotation * 90;

  return (
    <motion.div
      className="bg-black/60 border border-white/10 rounded-lg p-3"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        {/* Pattern preview */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={64}
            height={64}
            className="rounded bg-black/50"
          />
          {/* Rotation indicator */}
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-800 border border-white/20 rounded-full flex items-center justify-center text-[10px] text-gray-400"
            title={`Rotation: ${rotationDeg}°`}
          >
            {rotationDeg}°
          </div>
        </div>

        {/* Pattern info */}
        <div className="flex-1 min-w-0">
          <div className={`font-mono text-sm font-medium ${catInfo.color.split(' ')[0]}`}>
            {pattern.name}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {catInfo.label}
          </div>
          <div className="text-xs text-gray-400 mt-1 line-clamp-2">
            {pattern.description}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 mt-2 text-[10px]">
            <span className="px-1.5 py-0.5 bg-white/10 rounded text-gray-300">
              {parsedPattern.length} cells
            </span>
            {pattern.speed && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 rounded text-blue-400">
                {pattern.speed}
              </span>
            )}
            {pattern.period && (
              <span className="px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-400">
                P{pattern.period}
              </span>
            )}
          </div>
        </div>

        {/* Rotate button */}
        <motion.button
          onClick={onRotate}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95, rotate: 90 }}
          title="Rotate pattern 90° (R key)"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
};

/**
 * Main Pattern Library Component
 */
export const PatternLibrary: React.FC<PatternLibraryProps> = ({
  selectedPattern,
  onSelectPattern,
  parsedPattern,
  patternRotation,
  onRotate,
  showAdvanced,
  onToggleAdvanced,
  playerColor = '#00d4aa',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<PatternCategory | 'all'>('spaceship');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPattern, setHoveredPattern] = useState<PatternInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter patterns based on advanced mode
  const basePatterns = useMemo(() =>
    showAdvanced ? PATTERNS : PATTERNS.filter(p => p.essential),
    [showAdvanced]
  );

  // Get categories that have patterns
  const categoriesWithPatterns = useMemo(() =>
    new Set(basePatterns.map(p => p.category)),
    [basePatterns]
  );

  // Get pattern counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: basePatterns.length };
    for (const pattern of basePatterns) {
      counts[pattern.category] = (counts[pattern.category] || 0) + 1;
    }
    return counts;
  }, [basePatterns]);

  // Filter patterns by category and search
  const filteredPatterns = useMemo(() => {
    let patterns = selectedCategory === 'all'
      ? basePatterns
      : basePatterns.filter(p => p.category === selectedCategory);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      patterns = patterns.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    return patterns;
  }, [basePatterns, selectedCategory, searchQuery]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in search
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        onRotate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRotate]);

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Header with search and advanced toggle */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400 font-medium">Patterns</span>
        <motion.button
          onClick={onToggleAdvanced}
          className={`text-[10px] px-2 py-0.5 rounded font-mono ${
            showAdvanced
              ? 'bg-purple-600/50 text-purple-200 border border-purple-500/50'
              : 'bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-600/50'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {showAdvanced ? 'Essential' : 'All'}
        </motion.button>
      </div>

      {/* Search input */}
      <div className="relative mb-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search patterns..."
          className="w-full px-3 py-1.5 bg-black/40 border border-white/10 rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            ×
          </button>
        )}
      </div>

      {/* Category tabs - horizontal scroll */}
      <div className="flex gap-1 mb-2 pb-1 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
        <CategoryTab
          category="all"
          isSelected={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
          count={categoryCounts.all}
        />
        {CATEGORY_ORDER
          .filter(cat => categoriesWithPatterns.has(cat))
          .map(cat => (
            <CategoryTab
              key={cat}
              category={cat}
              isSelected={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              count={categoryCounts[cat] || 0}
            />
          ))
        }
      </div>

      {/* Pattern grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <motion.div
          className="grid grid-cols-3 gap-1.5 relative"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          key={`${selectedCategory}-${showAdvanced}-${searchQuery}`}
        >
          {filteredPatterns.map((pattern) => (
            <PatternThumbnail
              key={pattern.name}
              pattern={pattern}
              isSelected={selectedPattern.name === pattern.name}
              onClick={() => onSelectPattern(pattern)}
              onHover={setHoveredPattern}
              color={playerColor}
            />
          ))}

          {filteredPatterns.length === 0 && (
            <div className="col-span-3 py-8 text-center text-gray-500 text-xs">
              No patterns found
            </div>
          )}
        </motion.div>

        {/* Hover preview popup */}
        <AnimatePresence>
          {hoveredPattern && hoveredPattern.name !== selectedPattern.name && (
            <AnimatedPreview
              key={hoveredPattern.name}
              pattern={hoveredPattern}
              color={playerColor}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Selected pattern info */}
      <div className="mt-2 pt-2 border-t border-white/10">
        <SelectedPatternInfo
          pattern={selectedPattern}
          parsedPattern={parsedPattern}
          rotation={patternRotation}
          onRotate={onRotate}
          color={playerColor}
        />
      </div>
    </div>
  );
};

export default PatternLibrary;
