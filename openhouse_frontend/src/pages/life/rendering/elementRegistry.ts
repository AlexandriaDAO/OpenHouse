import type { ElementRenderer } from './types';
import { earthRenderer } from './elements/earth';
import { waterRenderer } from './elements/water';
import { fireRenderer } from './elements/fire';
import { stoneRenderer } from './elements/stone';
import { lightRenderer } from './elements/light';
import { iceRenderer } from './elements/ice';
import { plasmaRenderer } from './elements/plasma';
import { voidRenderer } from './elements/void';

/** Registry mapping region ID -> element renderer */
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

/** Get all registered element IDs */
export function getRegisteredElementIds(): number[] {
  return Array.from(elementRenderers.keys());
}
