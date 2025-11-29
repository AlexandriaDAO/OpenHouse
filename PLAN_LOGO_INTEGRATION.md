# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-logo-integration"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-logo-integration`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: Replace placeholder branding with OpenHouse slot machine logo"
   git push -u origin feature/logo-integration
   gh pr create --title "feat: Logo Integration - Replace Placeholders with Brand Identity" --body "Implements PLAN_LOGO_INTEGRATION.md

Replaces all placeholder branding with the new OpenHouse slot machine logo suite.

## Changes
- Favicon updated to logo_icon.png
- Header logo replaced with logo_whole.png
- Logo variants organized for different contexts
- Meta tags updated with proper branding

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: pezw3-laaaa-aaaal-qssoa-cai (frontend)"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ⚠️ MAINNET DEPLOYMENT: All changes go directly to production
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/logo-integration`
**Worktree:** `/home/theseus/alexandria/openhouse-logo-integration`

---

# Implementation Plan: Logo Integration

## Task Classification
**NEW FEATURE**: Replace placeholder branding with real OpenHouse logo assets (additive approach)

## Current State

### Logo Assets Available
Located in: `/openhouse_frontend/public/logos/`

1. **logo_icon.png** (1024x1024)
   - Pixel art slot machine showing "VRF", "1%", "OWN"
   - Transparent background
   - Perfect for favicon, small icons, app icons
   - Conveys: provably fair (VRF), transparent odds (1%), player-owned (OWN)

2. **logo_whole.png** (512x512)
   - Slot machine in retro computer window frame
   - Transparent background with vintage green CRT aesthetic
   - Ideal for: header logo, loading screens, social cards

3. **logo_with_background.jpg** (1024x1024)
   - Full scene with dark background and scan lines
   - Retro terminal aesthetic with depth
   - Best for: splash screens, promotional materials, meta tags

### Current Placeholder Usage

#### 1. Browser Tab/Favicon
**File:** `/openhouse_frontend/index.html:5`
```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```
**Issue:** Using generic Vite logo

#### 2. Header Logo
**File:** `/openhouse_frontend/src/components/Layout.tsx:19-26`
```tsx
<Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
  <span className="text-3xl">🎰</span>  {/* ← PLACEHOLDER EMOJI */}
  <div>
    <h1 className="text-2xl font-pixel">OpenHouse Games</h1>
    <p className="text-xs text-dfinity-turquoise font-mono">
      Provably Fair Gaming
    </p>
  </div>
</Link>
```
**Issue:** Using emoji instead of brand logo

#### 3. Game Selection Icons
**File:** `/openhouse_frontend/src/pages/Home.tsx:14,24,35,45`
```tsx
const games: GameInfo[] = [
  { id: 'crash', icon: '🚀', ... },      // ← PLACEHOLDER EMOJI
  { id: 'plinko', icon: '🎯', ... },     // ← PLACEHOLDER EMOJI
  { id: 'plinko-v2', icon: '🎯', ... },  // ← PLACEHOLDER EMOJI
  { id: 'dice', icon: '🎲', ... },       // ← PLACEHOLDER EMOJI
];
```
**Issue:** Using emojis for game cards (less critical - these can stay for now)

#### 4. Meta Tags
**File:** `/openhouse_frontend/index.html:7-8`
```html
<title>OpenHouse Casino - Transparent Odds on the Internet Computer</title>
<meta name="description" content="Open-source casino with provably fair games on the Internet Computer" />
```
**Missing:** Open Graph tags for social sharing with logo

## Implementation Plan

### Phase 1: Favicon & Browser Tab

#### File: `/openhouse_frontend/index.html`
```html
<!-- PSEUDOCODE - Replace favicon -->

<!-- OLD (line 5): -->
<link rel="icon" type="image/svg+xml" href="/vite.svg" />

<!-- NEW: -->
<link rel="icon" type="image/png" href="/logos/logo_icon.png" />
<link rel="apple-touch-icon" href="/logos/logo_icon.png" />

<!-- Add Open Graph meta tags for social sharing -->
<meta property="og:title" content="OpenHouse Casino - Transparent Odds Gaming" />
<meta property="og:description" content="Provably fair casino games on the Internet Computer. VRF randomness, 1% house edge, player-owned." />
<meta property="og:image" content="https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/logos/logo_with_background.jpg" />
<meta property="og:url" content="https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io" />
<meta property="og:type" content="website" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="OpenHouse Casino - Transparent Odds Gaming" />
<meta name="twitter:description" content="Provably fair casino games on the Internet Computer" />
<meta name="twitter:image" content="https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/logos/logo_with_background.jpg" />
```

**Files Modified:**
- `/openhouse_frontend/index.html` (MODIFY lines 5, add meta tags after line 8)

---

### Phase 2: Header Logo Replacement

#### File: `/openhouse_frontend/src/components/Layout.tsx`
```tsx
// PSEUDOCODE - Replace emoji with actual logo

// Import statement at top (after line 3):
import logoWhole from '/logos/logo_whole.png';

// Replace lines 19-26 with:
<Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
  {/* NEW: Actual logo image */}
  <img
    src={logoWhole}
    alt="OpenHouse Casino Logo"
    className="w-12 h-12 pixelated"
    style={{ imageRendering: 'pixelated' }}
  />
  <div>
    <h1 className="text-2xl font-pixel">OpenHouse Games</h1>
    <p className="text-xs text-dfinity-turquoise font-mono">
      Provably Fair Gaming
    </p>
  </div>
</Link>
```

**Rationale:**
- `logo_whole.png` shows the slot machine in a retro window - perfect for header
- `pixelated` class and `imageRendering` preserve crisp pixel art at any size
- 48px x 48px (`w-12 h-12`) provides good visibility without overwhelming header
- Maintains existing text branding alongside visual identity

**Files Modified:**
- `/openhouse_frontend/src/components/Layout.tsx` (MODIFY lines 19-26, add import)

---

### Phase 3: CSS Enhancement (Optional)

#### File: `/openhouse_frontend/src/index.css` (or global styles)
```css
/* PSEUDOCODE - Add utility class for pixel art */

/* Add at end of file: */
.pixelated {
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
```

**Rationale:**
- Ensures pixel art logos stay crisp at all sizes
- Prevents browser anti-aliasing that blurs pixel art
- Reusable utility for other pixel art assets

**Files Modified:**
- `/openhouse_frontend/src/index.css` (ADD at end, if exists)
- OR add inline styles where logos used (already shown in Phase 2)

---

### Phase 4: Manifest & PWA (Future Enhancement - NOT IN THIS PR)

**OUT OF SCOPE** for this PR, but document for future:
```json
// Future: /openhouse_frontend/public/manifest.json
{
  "name": "OpenHouse Casino",
  "short_name": "OpenHouse",
  "icons": [
    {
      "src": "/logos/logo_icon.png",
      "sizes": "1024x1024",
      "type": "image/png"
    }
  ],
  "theme_color": "#00D4AA",
  "background_color": "#000000",
  "display": "standalone"
}
```

---

## Logo Usage Guide (For Future Reference)

### When to Use Each Logo Variant

| Variant | Best For | Example Contexts |
|---------|----------|------------------|
| **logo_icon.png** | Small squares, icons, favicons | Browser tab, app icon, avatar, 32-64px usage |
| **logo_whole.png** | Headers, medium rectangles | Site header, loading screens, 48-128px |
| **logo_with_background.jpg** | Hero images, social cards | OG image, splash screen, promotional materials |

### Logo Meanings

The slot machine displays three critical OpenHouse values:
1. **VRF** - Verifiable Random Function (provably fair)
2. **1%** - Transparent house edge (honest odds)
3. **OWN** - Player-owned platform (open source)

---

## Testing Requirements

**Manual Verification Only** (experimental pre-production):

1. **Browser Tab:**
   - Check favicon appears in browser tab
   - Verify it's the slot machine icon, not Vite logo

2. **Header:**
   - Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
   - Confirm logo appears in header (not emoji)
   - Verify pixel art is crisp, not blurry
   - Test hover opacity transition

3. **Social Sharing:**
   - Share URL on Discord/Twitter/Slack
   - Verify OpenGraph image shows correctly
   - Check preview shows logo_with_background.jpg

4. **Build Check:**
   ```bash
   cd openhouse_frontend
   npm run build
   # Check for errors, verify logo files copied to dist/
   ```

---

## Deployment Strategy

**Affected Canister:**
- Frontend only: `pezw3-laaaa-aaaal-qssoa-cai`

**Deployment Command:**
```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

**Verification:**
```bash
# Check live site
echo "Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"

# Verify logo files accessible
curl -I https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/logos/logo_icon.png
curl -I https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/logos/logo_whole.png
curl -I https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/logos/logo_with_background.jpg
```

---

## Files Changed Summary

### Modified Files
1. `/openhouse_frontend/index.html`
   - Replace favicon reference (line 5)
   - Add Open Graph meta tags (after line 8)
   - Add Twitter Card meta tags

2. `/openhouse_frontend/src/components/Layout.tsx`
   - Add logo import (after line 3)
   - Replace emoji with `<img>` tag (lines 19-26)
   - Add pixelated styling

### New Files
- NONE (logos already exist in `/public/logos/`)

### Total Impact
- **2 files modified**
- **0 files created**
- **Frontend-only change**
- **Zero backend impact**

---

## Success Criteria

✅ Favicon shows slot machine icon in browser tab
✅ Header displays logo_whole.png instead of emoji
✅ Pixel art renders crisp without blur
✅ Social sharing shows proper OG image
✅ Build completes without errors
✅ Deployment succeeds to mainnet
✅ Live site reflects all branding changes

---

## Notes

- **Game icons (emojis) intentionally preserved** - They provide quick visual recognition and complement the header branding
- **No PWA manifest yet** - Save for future PR when we want installable app
- **Logo perfectly captures brand** - VRF (provably fair), 1% (transparent odds), OWN (player-owned) messaging is brilliant
- **Pixel art aesthetic** - Reinforces retro gaming vibe, aligns with IC's technical/nerdy audience
- **Three variants give flexibility** - Can use appropriate logo for each context
