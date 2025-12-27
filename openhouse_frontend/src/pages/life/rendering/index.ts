// Public API exports for the rendering module

export type { ElementRenderer, RGB } from './types';

export { hexToRgb, lighten, darken, rgbToCss, add3DEdges } from './colorUtils';
export { seededRandom } from './seededRandom';

export {
  getElementRenderer,
  registerElementRenderer,
  getRegisteredElementIds,
} from './elementRegistry';

export {
  initTerritoryPatterns,
  getTerritoryPattern,
  arePatternsInitialized,
  renderTerritoryLayer,
  resetTerritoryPatterns,
  TERRITORY_BRIGHTNESS,
} from './territoryRenderer';

// Re-export individual element renderers for customization
export { earthRenderer } from './elements/earth';
export { waterRenderer } from './elements/water';
export { fireRenderer } from './elements/fire';
export { stoneRenderer } from './elements/stone';
export { lightRenderer } from './elements/light';
export { iceRenderer } from './elements/ice';
export { plasmaRenderer } from './elements/plasma';
export { voidRenderer } from './elements/void';
