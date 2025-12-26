# Textured Grid Rendering Plan

## Goal
Apply the Minecraft-style textured block visuals to all cells in the game grid, making each region's territory visually distinct with procedural textures rather than flat colors.

## Current State

### How Cells Are Rendered Now
- **Location**: `Life.tsx` lines ~930-940
- **Method**: Simple `ctx.fillStyle = PLAYER_COLORS[owner]` + `ctx.fillRect()`
- **Performance**: Very fast - just solid color fills
- **Cell sizes**: Variable based on zoom (1-8+ pixels per cell in overview, larger in quadrant view)

### Existing Computation Load
- Local Conway simulation running at 8 gen/sec (125ms ticks)
- 512x512 grid = 262,144 cells processed per generation
- Backend sync every 500ms
- Canvas re-render on every frame
- Territory counting, base coin tracking, etc.

## The Challenge

### Why Textures Are Expensive
1. **Per-cell operations**: Drawing detailed textures for 262k cells per frame is prohibitive
2. **Pattern creation**: `ctx.createPattern()` has overhead
3. **Draw calls**: Complex shapes (arcs, gradients) are slower than `fillRect()`
4. **Memory**: Storing 8 different texture canvases at multiple sizes

### Cell Size Reality
| View Mode | Cell Size | Texture Viability |
|-----------|-----------|-------------------|
| Overview (512x512 grid) | 1-2px | No detail visible anyway |
| Quadrant view (128x128) | 4-8px | Minimal detail visible |
| Zoomed quadrant | 8-16px | Some detail possible |

## Proposed Approaches

### Option A: Size-Adaptive Rendering (Recommended)
**Concept**: Only apply textures when cells are large enough to see detail.

```
if (cellSize >= 8) {
  // Use textured rendering
  drawTexturedCell(ctx, x, y, cellSize, owner);
} else if (cellSize >= 4) {
  // Use simplified texture (just 3D shading)
  drawShadedCell(ctx, x, y, cellSize, owner);
} else {
  // Use solid color (current behavior)
  ctx.fillStyle = PLAYER_COLORS[owner];
  ctx.fillRect(x, y, cellSize, cellSize);
}
```

**Pros**:
- No overhead at small sizes where texture isn't visible
- Full visual impact when zoomed in
- Graceful degradation

**Cons**:
- Visual inconsistency between zoom levels
- More complex rendering logic

### Option B: Pre-rendered Sprite Sheets
**Concept**: Pre-render each region's cell at common sizes (4px, 8px, 16px), use `drawImage()` to stamp them.

```typescript
// On init: generate sprite sheet
const sprites: Record<number, Record<number, HTMLCanvasElement>> = {};
for (regionId of [1..8]) {
  sprites[regionId] = {
    4: generateTexture(regionId, 4),
    8: generateTexture(regionId, 8),
    16: generateTexture(regionId, 16),
  };
}

// On render: stamp sprites
ctx.drawImage(sprites[owner][cellSize], x, y);
```

**Pros**:
- `drawImage()` is GPU-accelerated, very fast
- Consistent look at each size
- Textures generated once, reused forever

**Cons**:
- Fixed sizes only (need interpolation or multiple sizes)
- Memory for sprite sheets
- Cells must align to sprite sizes

### Option C: GPU Shaders (WebGL)
**Concept**: Move rendering to WebGL with fragment shaders that procedurally generate textures.

**Pros**:
- Massively parallel - GPU renders all cells simultaneously
- True procedural textures at any size
- Can add animations (fire flickering, water shimmer)

**Cons**:
- Major refactor - current canvas 2D API won't work
- Shader complexity
- Browser compatibility concerns
- Overkill for current needs

### Option D: Territory-Only Texturing
**Concept**: Only texture the territory overlay (faded background), keep living cells as solid colors with simple 3D borders.

**Pros**:
- Territory is rendered once per region (not per cell)
- Living cells stay fast
- Clear visual distinction: textured territory vs solid living cells

**Cons**:
- Less dramatic visual impact
- Living cells still look flat

## Recommended Implementation: Option A + B Hybrid

### Phase 1: Simple 3D Shading (Low Risk)
Add basic 3D depth to cells without full textures:
- Lighter top-left pixel
- Darker bottom-right pixel
- Works at any cell size ≥ 3px

```typescript
function drawShadedCell(ctx, x, y, size, owner) {
  const color = PLAYER_COLORS[owner];
  const rgb = hexToRgb(color);

  // Base fill
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);

  // Highlight (top-left)
  ctx.fillStyle = lighten(rgb, 20);
  ctx.fillRect(x, y, size, 1);
  ctx.fillRect(x, y, 1, size);

  // Shadow (bottom-right)
  ctx.fillStyle = darken(rgb, 30);
  ctx.fillRect(x, y + size - 1, size, 1);
  ctx.fillRect(x + size - 1, y, 1, size);
}
```

**Overhead**: ~4 extra fillRect calls per cell (still very fast)

### Phase 2: Sprite Stamps for Larger Cells
When `cellSize >= 8`, use pre-rendered sprite stamps:

```typescript
// Cache sprites on component mount
const cellSprites = useMemo(() => {
  const sprites: Map<string, HTMLCanvasElement> = new Map();
  for (const regionId of Object.keys(REGIONS)) {
    for (const size of [8, 12, 16, 24, 32]) {
      sprites.set(`${regionId}-${size}`, getRegionTexture(parseInt(regionId), size));
    }
  }
  return sprites;
}, []);

// In render loop
if (cellSize >= 8) {
  const spriteSize = nearestSpriteSize(cellSize); // 8, 12, 16, 24, or 32
  const sprite = cellSprites.get(`${owner}-${spriteSize}`);
  ctx.drawImage(sprite, x, y, cellSize, cellSize);
} else {
  drawShadedCell(ctx, x, y, cellSize, owner);
}
```

### Phase 3: Territory Texture Overlay (Optional)
For territory (faded background), render region-specific patterns:
- Earth: subtle dirt texture
- Water: faint wave pattern
- Fire: ember glow
- etc.

This is lower priority since territory is less visually prominent.

## Performance Benchmarks to Validate

Before implementing, measure:
1. Current frame time for full grid render
2. Frame time with Phase 1 (3D shading)
3. Frame time with Phase 2 (sprite stamps)

Target: Stay under 16ms per frame (60fps) or 33ms (30fps minimum)

## Implementation Steps

### Step 1: Add 3D Shading Helper
- [ ] Create `drawShadedCell()` function in `cellTextures.ts`
- [ ] Export `lighten()` and `darken()` helpers

### Step 2: Modify Cell Rendering
- [ ] In `Life.tsx` cell rendering loop (~line 930)
- [ ] Replace `ctx.fillRect()` with conditional logic
- [ ] Test performance impact

### Step 3: Pre-generate Sprite Cache
- [ ] Add sprite generation on component mount
- [ ] Create `nearestSpriteSize()` helper
- [ ] Implement sprite stamping for large cells

### Step 4: Optimize if Needed
- [ ] Profile with Chrome DevTools
- [ ] Consider only texturing visible cells (viewport culling)
- [ ] Consider reducing texture detail at medium sizes

## Files to Modify

| File | Changes |
|------|---------|
| `cellTextures.ts` | Add `drawShadedCell()`, export color helpers |
| `Life.tsx` | Modify cell render loop, add sprite cache |
| `lifeConstants.ts` | Possibly add texture quality settings |

## Rollback Plan

If performance degrades unacceptably:
1. Feature flag: `ENABLE_CELL_TEXTURES = false`
2. Revert to current `fillRect()` only rendering
3. Keep textures only for preview cards (current state)

## Open Questions

1. Should texture detail vary by device capability? (detect low-end devices)
2. Should users have a "performance mode" toggle?
3. Do we want animated textures later? (fire flicker, water shimmer) - would require WebGL
