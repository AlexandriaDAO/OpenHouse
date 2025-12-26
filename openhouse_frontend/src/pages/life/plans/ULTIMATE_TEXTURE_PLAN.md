# Ultimate Textured Grid Rendering Plan

## Executive Summary

This plan unifies two complementary approaches for adding procedural textures to the Life game grid:

| Render Target | Best Approach | Why |
|---------------|---------------|-----|
| **Territory** (background) | Pattern fills | One GPU draw per owner, covers ~100k cells in 8 calls |
| **Living Cells** (foreground) | Size-adaptive sprites | Discrete objects need individual rendering, LOD saves cycles |

**Key insight**: These aren't competing approaches—they solve different problems optimally.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TEXTURE GENERATION                          │
│              (runs once at startup, ~50ms)                      │
├─────────────────────────────────────────────────────────────────┤
│  For each of 8 elements (Earth, Water, Fire, etc.):            │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────────────────────┐    │
│  │ Territory Tile  │    │ Cell Sprites                    │    │
│  │ 128×128 canvas  │    │ 8px, 12px, 16px, 24px, 32px     │    │
│  │ → createPattern │    │ → drawImage() stamps            │    │
│  └─────────────────┘    └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RENDER PIPELINE                             │
│              (runs every frame, target <16ms)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TERRITORY LAYER (background)                                │
│     ┌─────────────────────────────────────────────────────┐    │
│     │ for each owner (1-8):                               │    │
│     │   ctx.save()                                        │    │
│     │   ctx.translate(animOffset.x, animOffset.y)  // FREE│    │
│     │   ctx.fillStyle = pattern[owner]                    │    │
│     │   ctx.beginPath()                                   │    │
│     │   for each cell: ctx.rect(...)  // Build path      │    │
│     │   ctx.fill()  // ONE GPU CALL for ~12k cells       │    │
│     │   ctx.restore()                                     │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│  2. LIVING CELLS LAYER (foreground)                            │
│     ┌─────────────────────────────────────────────────────┐    │
│     │ if cellSize < 3:  FLAT COLOR (fillRect)            │    │
│     │ if cellSize < 8:  3D SHADING (5 fillRects)         │    │
│     │ if cellSize >= 8: SPRITE STAMP (drawImage)         │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 0: Modular Element Architecture

### Design Principle

**Each element (Earth, Water, Fire, etc.) is a self-contained plugin.** Core rendering logic never knows about specific elements—it only interacts through a registry and interface contract.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CORE RENDERING LOGIC                         │
│         (territoryRenderer.ts, cellRenderer.ts)                 │
│                                                                 │
│   Does NOT know about Earth, Water, Fire...                     │
│   Only calls: registry.get(regionId).renderTerritory(ctx, ...)  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ELEMENT REGISTRY                             │
│                   (elementRegistry.ts)                          │
│                                                                 │
│   elementRenderers.set(1, earthRenderer);                       │
│   elementRenderers.set(2, waterRenderer);                       │
│   elementRenderers.set(3, fireRenderer);                        │
│   ...                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────┬─────────┬─┴───────┬─────────┐
        ▼         ▼         ▼         ▼         ▼
    ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
    │ Earth │ │ Water │ │ Fire  │ │ Stone │ │  ...  │
    │ .ts   │ │ .ts   │ │ .ts   │ │ .ts   │ │       │
    └───────┘ └───────┘ └───────┘ └───────┘ └───────┘

    Each file is COMPLETELY INDEPENDENT.
    Changing fire.ts cannot break water.ts.
```

### Interface Contract

```typescript
// src/pages/life/rendering/types.ts

/**
 * Every element must implement this interface.
 * This is the ONLY contract between core logic and element styles.
 */
export interface ElementRenderer {
  /** Unique element name for debugging */
  readonly name: string;

  /**
   * Render a 128x128 tile for territory pattern.
   * Called ONCE at startup, result is cached as a CanvasPattern.
   */
  renderTerritoryTile(
    ctx: CanvasRenderingContext2D,
    size: number,
    colors: { primary: string; secondary: string }
  ): void;

  /**
   * Render a cell sprite at the given size.
   * Called ONCE per size at startup, results are cached.
   * Sizes: 8, 12, 16, 24, 32
   */
  renderCellSprite(
    ctx: CanvasRenderingContext2D,
    size: number,
    colors: { primary: string; secondary: string }
  ): void;

  /**
   * Optional: Custom animation parameters.
   * If not provided, defaults are used.
   */
  animation?: {
    /** Speed multiplier for territory pattern drift (default: 1.0) */
    territorySpeed?: number;
    /** Amplitude of territory drift in pixels (default: 2) */
    territoryAmplitude?: number;
  };
}
```

### Element Registry

```typescript
// src/pages/life/rendering/elementRegistry.ts

import type { ElementRenderer } from './types';
import { earthRenderer } from './elements/earth';
import { waterRenderer } from './elements/water';
import { fireRenderer } from './elements/fire';
import { stoneRenderer } from './elements/stone';
import { lightRenderer } from './elements/light';
import { iceRenderer } from './elements/ice';
import { plasmaRenderer } from './elements/plasma';
import { voidRenderer } from './elements/void';

/** Registry mapping region ID → element renderer */
const elementRenderers: Map<number, ElementRenderer> = new Map([
  [1, earthRenderer],
  [2, waterRenderer],
  [3, fireRenderer],
  [4, stoneRenderer],
  [5, lightRenderer],
  [6, iceRenderer],
  [7, plasmaRenderer],
  [8, voidRenderer],
]);

/** Get renderer for a region ID. Returns null for unknown IDs. */
export function getElementRenderer(regionId: number): ElementRenderer | null {
  return elementRenderers.get(regionId) ?? null;
}

/** Register a custom renderer (for mods/testing) */
export function registerElementRenderer(regionId: number, renderer: ElementRenderer): void {
  elementRenderers.set(regionId, renderer);
}
```

### Example Element Implementation

```typescript
// src/pages/life/rendering/elements/earth.ts

import type { ElementRenderer } from '../types';
import { seededRandom } from '../seededRandom';

/**
 * EARTH ELEMENT
 *
 * Visual style: Organic, soil-like
 * Territory: Brown/green patches, scattered circles
 * Cells: Mossy block with organic spots
 *
 * To modify Earth's appearance, ONLY edit this file.
 * No other files need to change.
 */
export const earthRenderer: ElementRenderer = {
  name: 'Earth',

  renderTerritoryTile(ctx, size, colors) {
    const rng = seededRandom(1);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(0, 0, size, size);

    // Organic circles (dirt patches)
    const numCircles = Math.floor(size / 10);
    for (let i = 0; i < numCircles; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = 3 + rng() * (size * 0.15);

      ctx.fillStyle = rng() > 0.5 ? colors.primary : colors.secondary;
      ctx.globalAlpha = 0.08 + rng() * 0.08;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },

  renderCellSprite(ctx, size, colors) {
    const rng = seededRandom(42);

    // Base fill
    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, size, size);

    // Organic spots
    const numSpots = Math.max(2, Math.floor(size / 6));
    for (let i = 0; i < numSpots; i++) {
      const x = rng() * size;
      const y = rng() * size;
      const r = size * (0.1 + rng() * 0.15);

      ctx.fillStyle = colors.secondary;
      ctx.globalAlpha = 0.3 + rng() * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    // 3D edges (shared helper, but called here for consistency)
    add3DEdges(ctx, size, colors.primary);
  },

  animation: {
    territorySpeed: 0.8,      // Earth drifts slowly
    territoryAmplitude: 1.5,  // Subtle movement
  },
};
```

### Core Logic (Element-Agnostic)

```typescript
// src/pages/life/rendering/territoryRenderer.ts

import { getElementRenderer } from './elementRegistry';
import { REGIONS } from '../../lifeConstants';

/**
 * Core territory rendering - knows NOTHING about specific elements.
 * All element-specific logic lives in the element files.
 */
export function generateTerritoryPattern(
  ctx: CanvasRenderingContext2D,
  regionId: number,
  tileSize: number
): CanvasPattern | null {
  const renderer = getElementRenderer(regionId);
  if (!renderer) return null;

  const region = REGIONS[regionId];
  const colors = {
    primary: region.primaryColor,
    secondary: region.secondaryColor || region.primaryColor,
  };

  // Create offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const tileCtx = canvas.getContext('2d')!;

  // Delegate to element-specific renderer
  renderer.renderTerritoryTile(tileCtx, tileSize, colors);

  return ctx.createPattern(canvas, 'repeat');
}
```

### Adding a New Element

To add a new element (e.g., "Lightning"):

1. Create `src/pages/life/rendering/elements/lightning.ts`
2. Implement `ElementRenderer` interface
3. Add to registry: `elementRenderers.set(9, lightningRenderer)`
4. Add colors to `REGIONS` in `lifeConstants.ts`

**No changes needed to:**
- `territoryRenderer.ts`
- `cellRenderer.ts`
- Any other element files
- Core rendering pipeline

### Modifying an Existing Element

To change how Fire looks:

1. Open `src/pages/life/rendering/elements/fire.ts`
2. Modify `renderTerritoryTile()` and/or `renderCellSprite()`
3. Done. No other files affected.

---

## Part 1: Territory Rendering (Pattern Fills)

### Why Pattern Fills Win for Territory

```
NAIVE APPROACH (100k drawImage calls):
  for each territory cell:
    ctx.drawImage(sprite, x, y)  // 100,000 GPU calls = SLOW

PATTERN APPROACH (8 fill calls):
  for each owner:
    ctx.fillStyle = pattern
    ctx.beginPath()
    for each cell: ctx.rect(x, y, w, h)  // Just builds a path
    ctx.fill()  // ONE GPU call renders all cells for this owner
```

**Performance math**:
- 100k cells ÷ 8 owners = ~12.5k cells per owner average
- Pattern fill: 8 `fill()` calls total
- Naive: 100,000 `drawImage()` calls
- **Improvement: 12,500x fewer GPU calls**

### Territory Texture Generation

```typescript
// src/pages/life/rendering/territoryTextures.ts

const TILE_SIZE = 128;  // Pixels - larger = more variety before repeat
const territoryPatterns: Map<number, CanvasPattern> = new Map();

interface TerritoryStyle {
  baseColor: string;
  accentColor: string;
  renderFn: (ctx: CanvasRenderingContext2D, size: number, style: TerritoryStyle) => void;
}

const TERRITORY_STYLES: Record<string, TerritoryStyle> = {
  Earth: {
    baseColor: 'rgba(34, 139, 34, 0.12)',
    accentColor: 'rgba(139, 69, 19, 0.08)',
    renderFn: renderEarthTerritory,  // Organic circles, soil patches
  },
  Water: {
    baseColor: 'rgba(0, 191, 255, 0.12)',
    accentColor: 'rgba(30, 144, 255, 0.08)',
    renderFn: renderWaterTerritory,  // Horizontal wave lines, ripples
  },
  Fire: {
    baseColor: 'rgba(255, 69, 0, 0.12)',
    accentColor: 'rgba(255, 215, 0, 0.08)',
    renderFn: renderFireTerritory,   // Upward gradients, ember spots
  },
  Stone: {
    baseColor: 'rgba(112, 128, 144, 0.12)',
    accentColor: 'rgba(169, 169, 169, 0.08)',
    renderFn: renderStoneTerritory,  // Angular cracks, rocky texture
  },
  Light: {
    baseColor: 'rgba(255, 250, 205, 0.12)',
    accentColor: 'rgba(255, 255, 255, 0.08)',
    renderFn: renderLightTerritory,  // Soft radial glows, star points
  },
  Ice: {
    baseColor: 'rgba(224, 255, 255, 0.12)',
    accentColor: 'rgba(176, 224, 230, 0.08)',
    renderFn: renderIceTerritory,    // Hexagonal crystals, frost lines
  },
  Plasma: {
    baseColor: 'rgba(153, 50, 204, 0.12)',
    accentColor: 'rgba(255, 215, 0, 0.08)',
    renderFn: renderPlasmaTerritory, // Electric arcs, bright nodes
  },
  Void: {
    baseColor: 'rgba(26, 26, 46, 0.15)',
    accentColor: 'rgba(22, 33, 62, 0.10)',
    renderFn: renderVoidTerritory,   // Inward spirals, dark pools
  },
};

function generateTerritoryTile(regionId: number): HTMLCanvasElement {
  const region = REGIONS[regionId];
  const style = TERRITORY_STYLES[region.name];

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d')!;

  style.renderFn(ctx, TILE_SIZE, style);
  return canvas;
}

function initTerritoryPatterns(mainCtx: CanvasRenderingContext2D): void {
  for (const regionId of Object.keys(REGIONS)) {
    const tile = generateTerritoryTile(parseInt(regionId));
    const pattern = mainCtx.createPattern(tile, 'repeat')!;
    territoryPatterns.set(parseInt(regionId), pattern);
  }
}
```

### Territory Render Function

```typescript
function renderTerritoryLayer(
  ctx: CanvasRenderingContext2D,
  grid: Cell[][],
  cellSize: number,
  time: number,
  viewportBounds?: { minX: number, maxX: number, minY: number, maxY: number }
): void {
  // Group cells by owner for batched rendering
  const cellsByOwner: Map<number, Array<[number, number]>> = new Map();

  const minX = viewportBounds?.minX ?? 0;
  const maxX = viewportBounds?.maxX ?? grid[0].length;
  const minY = viewportBounds?.minY ?? 0;
  const maxY = viewportBounds?.maxY ?? grid.length;

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const territory = grid[y][x].territory;
      if (territory === 0) continue;

      if (!cellsByOwner.has(territory)) {
        cellsByOwner.set(territory, []);
      }
      cellsByOwner.get(territory)!.push([x, y]);
    }
  }

  // Render each owner's territory with ONE fill call
  for (const [owner, cells] of cellsByOwner) {
    const pattern = territoryPatterns.get(owner);
    if (!pattern) continue;

    // Animate via transform offset (essentially FREE)
    const animSpeed = 0.1 + (owner * 0.02);  // Slight variation per element
    const offsetX = Math.sin(time * animSpeed) * 2;
    const offsetY = Math.cos(time * animSpeed * 1.3) * 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = pattern;

    // Build path for ALL cells of this owner
    ctx.beginPath();
    for (const [x, y] of cells) {
      ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
    ctx.fill();  // ONE GPU CALL

    ctx.restore();
  }
}
```

### Optional: Run-Length Batching for Even Fewer Rects

```typescript
// Convert 100k cells → ~5k rectangles by merging horizontal runs
function batchToRectangles(cells: Array<[number, number]>): Array<{x: number, y: number, w: number, h: number}> {
  // Sort by y, then x
  cells.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

  const rects: Array<{x: number, y: number, w: number, h: number}> = [];
  let currentRect: {x: number, y: number, w: number, h: number} | null = null;

  for (const [x, y] of cells) {
    if (currentRect && currentRect.y === y && currentRect.x + currentRect.w === x) {
      // Extend current rect
      currentRect.w++;
    } else {
      // Start new rect
      if (currentRect) rects.push(currentRect);
      currentRect = { x, y, w: 1, h: 1 };
    }
  }
  if (currentRect) rects.push(currentRect);

  return rects;
}
```

---

## Part 2: Living Cell Rendering (Size-Adaptive)

### Why Size-Adaptive Rendering

| Cell Size | What's Visible | Best Approach | Overhead |
|-----------|----------------|---------------|----------|
| 1-2px | Just a dot | Flat color | 0 extra calls |
| 3-7px | Shape + edges | 3D shading | +4 fillRects |
| 8-15px | Some detail | Small sprite | 1 drawImage |
| 16+px | Full detail | Large sprite | 1 drawImage |

### Cell Sprite Generation

```typescript
// src/pages/life/rendering/cellSprites.ts

const SPRITE_SIZES = [8, 12, 16, 24, 32];
const cellSprites: Map<string, HTMLCanvasElement> = new Map();

function generateCellSprite(regionId: number, size: number): HTMLCanvasElement {
  const region = REGIONS[regionId];
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Use existing getRegionTexture from cellTextures.ts
  // This already renders element-specific procedural textures
  drawRegionTexture(ctx, size, region);

  return canvas;
}

function initCellSprites(): void {
  for (const regionId of Object.keys(REGIONS)) {
    for (const size of SPRITE_SIZES) {
      const sprite = generateCellSprite(parseInt(regionId), size);
      cellSprites.set(`${regionId}-${size}`, sprite);
    }
  }
}

function nearestSpriteSize(cellSize: number): number {
  // Find smallest sprite that's >= cellSize, or largest available
  for (const size of SPRITE_SIZES) {
    if (size >= cellSize) return size;
  }
  return SPRITE_SIZES[SPRITE_SIZES.length - 1];
}
```

### 3D Shading for Medium Cells

```typescript
// Lightweight 3D effect - just 4 extra fillRects per cell
function drawShadedCell(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number,
  color: string
): void {
  const rgb = hexToRgb(color);

  // Base fill
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  // Highlight (top + left edges) - 20% lighter
  ctx.fillStyle = `rgb(${Math.min(255, rgb.r * 1.2)}, ${Math.min(255, rgb.g * 1.2)}, ${Math.min(255, rgb.b * 1.2)})`;
  ctx.fillRect(x, y, size, 1);      // Top edge
  ctx.fillRect(x, y, 1, size);      // Left edge

  // Shadow (bottom + right edges) - 30% darker
  ctx.fillStyle = `rgb(${rgb.r * 0.7}, ${rgb.g * 0.7}, ${rgb.b * 0.7})`;
  ctx.fillRect(x, y + size - 1, size, 1);  // Bottom edge
  ctx.fillRect(x + size - 1, y, 1, size);  // Right edge
}
```

### Living Cell Render Function

```typescript
function renderLivingCells(
  ctx: CanvasRenderingContext2D,
  grid: Cell[][],
  cellSize: number,
  viewportBounds?: { minX: number, maxX: number, minY: number, maxY: number }
): void {
  const minX = viewportBounds?.minX ?? 0;
  const maxX = viewportBounds?.maxX ?? grid[0].length;
  const minY = viewportBounds?.minY ?? 0;
  const maxY = viewportBounds?.maxY ?? grid.length;

  // Determine rendering mode based on cell size
  const useSprites = cellSize >= 8;
  const useShading = cellSize >= 3 && cellSize < 8;

  // Pre-fetch sprite size if needed
  const spriteSize = useSprites ? nearestSpriteSize(cellSize) : 0;

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const cell = grid[y][x];
      if (!cell.alive) continue;

      const px = x * cellSize;
      const py = y * cellSize;
      const owner = cell.owner;

      if (useSprites) {
        // Full textured sprite
        const sprite = cellSprites.get(`${owner}-${spriteSize}`);
        if (sprite) {
          ctx.drawImage(sprite, px, py, cellSize, cellSize);
        }
      } else if (useShading) {
        // 3D shaded cell
        drawShadedCell(ctx, px, py, cellSize, PLAYER_COLORS[owner]);
      } else {
        // Flat color (fastest)
        ctx.fillStyle = PLAYER_COLORS[owner];
        ctx.fillRect(px, py, cellSize, cellSize);
      }
    }
  }
}
```

---

## Part 3: Element-Specific Texture Designs

### Visual Language per Element

| Element | Territory Feel | Cell Feel | Key Shapes |
|---------|---------------|-----------|------------|
| **Earth** | Fertile soil, grass patches | Mossy block | Irregular circles, organic blobs |
| **Water** | Gentle ripples, depth | Liquid cube | Horizontal waves, bubbles |
| **Fire** | Smoldering embers | Burning block | Upward flames, bright spots |
| **Stone** | Cracked bedrock | Rough hewn | Angular shapes, sharp lines |
| **Light** | Radiant glow | Pure crystal | Soft gradients, star points |
| **Ice** | Frozen surface | Frost cube | Hexagons, crystalline lines |
| **Plasma** | Electric field | Energy core | Lightning arcs, bright nodes |
| **Void** | Consuming darkness | Dark matter | Inward spirals, black pools |

### Example: Earth Texture Implementation

```typescript
function renderEarthTerritory(ctx: CanvasRenderingContext2D, size: number, style: TerritoryStyle): void {
  const rng = seededRandom(1);  // Deterministic for consistency

  // Base: earthy green-brown gradient
  ctx.fillStyle = style.baseColor;
  ctx.fillRect(0, 0, size, size);

  // Organic circles (dirt patches, grass clumps)
  const numCircles = Math.floor(size / 10);
  for (let i = 0; i < numCircles; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 3 + rng() * (size * 0.15);

    ctx.fillStyle = rng() > 0.5 ? style.baseColor : style.accentColor;
    ctx.globalAlpha = 0.3 + rng() * 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawEarthCellSprite(ctx: CanvasRenderingContext2D, size: number, region: RegionInfo): void {
  const primary = hexToRgb(region.primaryColor);
  const secondary = hexToRgb(region.secondaryColor || '#228B22');

  // Base fill
  ctx.fillStyle = region.primaryColor;
  ctx.fillRect(0, 0, size, size);

  // Organic spots
  const rng = seededRandom(42);
  const numSpots = Math.max(2, Math.floor(size / 6));
  for (let i = 0; i < numSpots; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = size * (0.1 + rng() * 0.15);

    ctx.fillStyle = `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, ${0.3 + rng() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3D edges
  add3DEdges(ctx, size, primary);
}
```

---

## Part 4: Animation Strategy

### Territory Animation (Zero Cost)

```typescript
// In renderTerritoryLayer:
const offsetX = Math.sin(time * 0.1) * 2;  // Gentle drift
const offsetY = Math.cos(time * 0.15) * 2;
ctx.translate(offsetX, offsetY);
// Pattern fill happens at new offset - GPU handles it
```

**Cost**: One matrix multiply per owner = effectively free.

### Living Cell Animation

Living cells don't need texture animation—**Conway movement IS the animation**.

Cells are born, die, and move every 125ms. Adding texture animation would:
1. Be visually confusing (too much motion)
2. Be wasted (cells change so fast)
3. Add overhead for no benefit

### Future: WebGL for Advanced Effects

If we ever want fire flickering, water shimmer, plasma crackle:
- Would require WebGL fragment shaders
- Massive refactor of render pipeline
- Save for v2 if there's demand

---

## Part 5: Implementation Phases

### Phase 1: 3D Shading (Low Risk, Immediate Impact)

**Scope**: Add simple 3D edges to living cells
**Overhead**: +4 `fillRect` per cell (negligible)
**Visual impact**: Significant—cells look 3D like Minecraft blocks

```typescript
// Just modify the cell rendering loop in Life.tsx
if (cellSize >= 3) {
  drawShadedCell(ctx, px, py, cellSize, PLAYER_COLORS[owner]);
} else {
  ctx.fillStyle = PLAYER_COLORS[owner];
  ctx.fillRect(px, py, cellSize, cellSize);
}
```

**Deliverables**:
- [ ] `drawShadedCell()` function
- [ ] `hexToRgb()`, `lighten()`, `darken()` helpers
- [ ] Modified cell render loop

### Phase 2: Territory Pattern Fills

**Scope**: Replace flat territory colors with animated patterns
**Overhead**: 8 `fill()` calls replace ~100k individual draws
**Visual impact**: Territory becomes alive and element-specific

**Deliverables**:
- [ ] `territoryTextures.ts` with pattern generation
- [ ] Element-specific territory renderers (8 functions)
- [ ] `renderTerritoryLayer()` function
- [ ] Integration with Life.tsx render loop

### Phase 3: Cell Sprite Stamps

**Scope**: Full textured sprites for large cells (cellSize >= 8)
**Overhead**: One `drawImage()` per cell (GPU-accelerated)
**Visual impact**: Detailed element textures when zoomed in

**Deliverables**:
- [ ] `cellSprites.ts` with sprite generation
- [ ] Element-specific cell renderers (8 functions)
- [ ] `nearestSpriteSize()` helper
- [ ] Modified cell render loop with size detection

### Phase 4: Optimization & Polish

**Scope**: Performance tuning based on profiling
**Potential optimizations**:
- [ ] Run-length batching for territory rectangles
- [ ] Viewport culling (only render visible cells)
- [ ] Web Worker for texture generation
- [ ] Performance mode toggle for users

---

## Part 6: Performance Budget

### Target Frame Time

| Quality Level | Target FPS | Frame Budget |
|---------------|------------|--------------|
| Minimum | 30 fps | 33ms |
| Target | 60 fps | 16ms |

### Expected Performance

| Operation | Time (estimate) | Notes |
|-----------|-----------------|-------|
| Territory patterns (8 fills) | <1ms | GPU batch fill |
| Living cells (50k cells) | 5-10ms | Depends on cell size |
| Conway simulation | 10-20ms | Already exists |
| **Total** | **<33ms** | Within budget |

### Benchmarking Plan

```typescript
// Add to render loop during development
const t0 = performance.now();
renderTerritoryLayer(ctx, grid, cellSize, time);
const t1 = performance.now();
renderLivingCells(ctx, grid, cellSize);
const t2 = performance.now();

console.log(`Territory: ${(t1-t0).toFixed(2)}ms, Cells: ${(t2-t1).toFixed(2)}ms`);
```

---

## Part 7: File Structure

```
src/pages/life/rendering/
├── index.ts                    # Public API exports
├── types.ts                    # Shared types and interfaces
├── colorUtils.ts               # hexToRgb, lighten, darken
├── seededRandom.ts             # Deterministic RNG for textures
│
├── territory/
│   ├── territoryTextures.ts    # Pattern generation & caching
│   ├── territoryRenderer.ts    # Pattern-based territory drawing
│   └── elements/
│       ├── earth.ts
│       ├── water.ts
│       ├── fire.ts
│       ├── stone.ts
│       ├── light.ts
│       ├── ice.ts
│       ├── plasma.ts
│       └── void.ts
│
└── cells/
    ├── cellSprites.ts          # Sprite generation & caching
    ├── cellRenderer.ts         # Size-adaptive cell drawing
    ├── shadedCell.ts           # 3D shading function
    └── elements/
        ├── earth.ts
        ├── water.ts
        ├── fire.ts
        ├── stone.ts
        ├── light.ts
        ├── ice.ts
        ├── plasma.ts
        └── void.ts
```

---

## Part 8: Rollback & Safety

### Feature Flags

```typescript
// lifeConstants.ts
export const TEXTURE_CONFIG = {
  ENABLE_TERRITORY_PATTERNS: true,   // Phase 2
  ENABLE_CELL_SPRITES: true,         // Phase 3
  ENABLE_3D_SHADING: true,           // Phase 1
  ENABLE_TERRITORY_ANIMATION: true,  // Pattern offset
  MIN_CELL_SIZE_FOR_SPRITES: 8,
  MIN_CELL_SIZE_FOR_SHADING: 3,
};
```

### Graceful Degradation

```typescript
function renderCells(ctx, grid, cellSize, config) {
  if (config.ENABLE_CELL_SPRITES && cellSize >= config.MIN_CELL_SIZE_FOR_SPRITES) {
    renderWithSprites(ctx, grid, cellSize);
  } else if (config.ENABLE_3D_SHADING && cellSize >= config.MIN_CELL_SIZE_FOR_SHADING) {
    renderWithShading(ctx, grid, cellSize);
  } else {
    renderFlat(ctx, grid, cellSize);  // Current behavior - always works
  }
}
```

### Performance Mode

```typescript
// User-accessible toggle
if (performanceMode) {
  TEXTURE_CONFIG.ENABLE_TERRITORY_PATTERNS = false;
  TEXTURE_CONFIG.ENABLE_CELL_SPRITES = false;
  TEXTURE_CONFIG.ENABLE_3D_SHADING = false;
}
```

---

## Part 9: Success Criteria

### Visual Quality
- [ ] Each of 8 elements is immediately recognizable by texture
- [ ] Territory feels alive (subtle animation)
- [ ] Cells have satisfying 3D depth
- [ ] Consistent visual language between territory and cells
- [ ] Graceful degradation at small cell sizes

### Performance
- [ ] No measurable FPS drop in overview mode (1-2px cells)
- [ ] <5ms added frame time in quadrant mode (4-8px cells)
- [ ] Maintains 30+ FPS with 50k living cells
- [ ] Texture generation completes in <100ms at startup
- [ ] Memory usage <2MB for all cached textures

### Code Quality
- [ ] All texture code isolated in `rendering/` directory
- [ ] Feature flags allow instant rollback
- [ ] No changes to Conway simulation logic
- [ ] Benchmark logging available for profiling

---

## Appendix: Quick Reference

### Draw Call Comparison

| Approach | Territory (100k cells) | Living Cells (50k) |
|----------|------------------------|---------------------|
| Current (flat) | 100k fillRect | 50k fillRect |
| Pattern + Shading | 8 fill | 50k × 5 fillRect |
| Pattern + Sprites | 8 fill | 50k drawImage |
| **Optimal (this plan)** | **8 fill** | **LOD-based** |

### Memory Usage

| Asset | Size | Count | Total |
|-------|------|-------|-------|
| Territory tiles (128×128) | 64KB | 8 | 512KB |
| Cell sprites (avg 16×16) | 1KB | 8×5 | 40KB |
| **Total** | | | **~550KB** |

### Cell Size Thresholds

```
cellSize < 3   → FLAT COLOR     (0 overhead)
cellSize 3-7   → 3D SHADING     (+4 fillRect)
cellSize 8+    → SPRITE STAMP   (1 drawImage)
```
