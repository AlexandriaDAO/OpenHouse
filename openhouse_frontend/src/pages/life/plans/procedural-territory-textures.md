# Procedural Territory Textures - Implementation Plan

## Goal

Replace flat-colored territory rendering with procedurally generated animated textures that match each player's elemental theme (Earth, Water, Fire, Stone, Light, Ice, Plasma, Void) while maintaining acceptable performance on a 512x512 grid.

## Performance Constraints

### Current State
- **Grid size**: 512x512 = 262,144 cells
- **Territory coverage**: Typically 10-40% of grid = 26,000-105,000 territory cells
- **Render rate**: Canvas redraws every frame during animation
- **Existing overhead**: Conway simulation, sync with backend, cell rendering

### Tutorial Implementation (Won't Scale)
The tutorial uses per-cell procedural drawing:
- 4 circles per cell × 576 cells (24x24) = 2,304 arc() calls per frame
- Scaling to main game: 4 × 100,000 = 400,000 arc() calls = **unacceptable**

## Proposed Solution: Pre-rendered Tile Patterns

### Core Concept
1. **Pre-render** a larger procedural texture tile (e.g., 64x64 or 128x128 pixels) for each element at startup
2. **Use Canvas patterns** (`createPattern()`) to tile the texture across territory
3. **Animate by offsetting** the pattern origin over time (cheap transform vs. redrawing)
4. **Cache aggressively** - one texture per element type, reused everywhere

### Why This Works
- Pattern rendering is GPU-accelerated
- Single `fillRect()` with pattern fills entire territory region
- Animation via `ctx.translate()` before pattern fill = near-zero cost
- 8 elements × 1 texture each = 8 pre-rendered canvases total

## Implementation Phases

### Phase 1: Texture Atlas Generation

Create a texture generator that runs once at app startup.

```typescript
// src/pages/life/rendering/elementTextures.ts

interface ElementTexture {
  canvas: HTMLCanvasElement;
  pattern: CanvasPattern | null;
  animationOffset: { x: number; y: number };
}

const TEXTURE_SIZE = 128; // Larger = more variety before repeat
const textureCache: Map<number, ElementTexture> = new Map();

function generateElementTexture(region: RegionInfo): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Draw element-specific procedural pattern
  switch (region.name) {
    case 'Earth': drawEarthTexture(ctx, region); break;
    case 'Water': drawWaterTexture(ctx, region); break;
    case 'Fire': drawFireTexture(ctx, region); break;
    // ... etc
  }

  return canvas;
}
```

### Phase 2: Element-Specific Texture Renderers

Each element gets a unique procedural generation function:

| Element | Visual Style | Key Features |
|---------|-------------|--------------|
| Earth | Organic, soil-like | Brown/green circles, irregular shapes |
| Water | Flowing, ripples | Horizontal wave lines, bubbles |
| Fire | Energetic, flames | Vertical gradients, bright spots |
| Stone | Rocky, crystalline | Angular shapes, cracks |
| Light | Radiant, pure | Soft glows, star points |
| Ice | Crystalline, sharp | Hexagonal shapes, frost lines |
| Plasma | Chaotic, electric | Lightning bolts, bright sparks |
| Void | Dark, consuming | Inward gradients, dark spots |

### Phase 3: Pattern-Based Territory Rendering

Replace per-cell rendering with pattern fills:

```typescript
function renderTerritory(
  ctx: CanvasRenderingContext2D,
  territoryCells: Map<number, Set<string>>, // owner -> "x,y" set
  cellSize: number,
  time: number
) {
  for (const [owner, cells] of territoryCells) {
    const texture = getOrCreateTexture(owner);
    if (!texture.pattern) {
      texture.pattern = ctx.createPattern(texture.canvas, 'repeat');
    }

    // Animate by offsetting pattern
    const offsetX = Math.sin(time * 0.1) * 2;
    const offsetY = Math.cos(time * 0.15) * 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.fillStyle = texture.pattern;

    // Draw all cells for this owner in one pass
    ctx.beginPath();
    for (const coord of cells) {
      const [x, y] = coord.split(',').map(Number);
      ctx.rect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
    ctx.fill();
    ctx.restore();
  }
}
```

### Phase 4: Optimization - Region Batching

Instead of per-cell rects, batch into contiguous regions:

```typescript
// Group adjacent cells into larger rectangles
function batchTerritoryCells(cells: Set<string>): Rectangle[] {
  // Use run-length encoding per row
  // Merge adjacent rows with same x-ranges
  // Returns fewer, larger rectangles
}
```

**Expected improvement**: 100,000 cells → ~5,000 rectangles (20x fewer draw calls)

### Phase 5: LOD (Level of Detail)

When zoomed out (overview mode), use simpler rendering:

```typescript
if (viewMode === 'overview' || zoomLevel < 0.5) {
  // Use flat colors - too zoomed out to see detail
  ctx.fillStyle = region.territoryColor;
} else {
  // Use procedural pattern
  ctx.fillStyle = texture.pattern;
}
```

## Animation Strategy

### Low-Cost Animation Options

1. **Pattern offset** (recommended)
   - Shift pattern origin using `ctx.translate()`
   - Cost: ~0 (just a transform matrix update)

2. **Opacity pulse**
   - Vary `globalAlpha` over time
   - Cost: Very low

3. **Pattern rotation** (subtle)
   - Rotate pattern slightly over time
   - Cost: Low (matrix transform)

### NOT Recommended
- Regenerating textures per frame
- Per-cell procedural drawing
- Particle systems per cell

## File Structure

```
src/pages/life/rendering/
├── elementTextures.ts      # Texture generation & caching
├── textureRenderers/
│   ├── earth.ts
│   ├── water.ts
│   ├── fire.ts
│   ├── stone.ts
│   ├── light.ts
│   ├── ice.ts
│   ├── plasma.ts
│   └── void.ts
├── territoryRenderer.ts    # Pattern-based territory drawing
└── index.ts                # Public API
```

## Performance Budget

| Operation | Tutorial (24x24) | Main Game Target |
|-----------|------------------|------------------|
| Texture generation | N/A (per-frame) | Once at startup (~50ms) |
| Pattern fill | N/A | 8 fills × 8 owners max |
| Transform updates | 576 cells | 8 transforms |
| Total draw calls | ~2,300 arcs | ~50 rects (batched) |

## Migration Path

1. **Keep tutorial as-is** - It's small enough that current approach works
2. **Implement for main game separately** - Different renderer, same visual style
3. **Share texture generation** - Same procedural algorithms, different usage

## Open Questions

1. **Texture size**: 64x64 vs 128x128 vs 256x256?
   - Larger = more variety, more memory
   - Suggest: Start with 128x128, profile

2. **Animation frequency**: Every frame vs every N frames?
   - Pattern offset is so cheap, every frame is fine
   - If perf issues, throttle to 30fps texture updates

3. **WebGL alternative?**
   - Could use WebGL shaders for truly zero-cost procedural textures
   - Higher complexity, may not be worth it for this use case

## Success Criteria

- [ ] All 8 element types have distinct, recognizable textures
- [ ] Animation is smooth (no jank) on mid-range hardware
- [ ] No measurable FPS drop vs flat color rendering
- [ ] Visual consistency with tutorial textures
- [ ] Memory usage < 10MB for all cached textures

## Next Steps

1. Create `elementTextures.ts` with texture generation
2. Implement one element (Earth) as proof of concept
3. Profile performance on 512x512 grid
4. If acceptable, implement remaining 7 elements
5. Integrate with main Life.tsx renderer
