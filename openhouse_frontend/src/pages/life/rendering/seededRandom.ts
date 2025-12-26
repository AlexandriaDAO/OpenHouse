/**
 * Create a seeded random number generator
 * Uses mulberry32 algorithm for deterministic random numbers
 *
 * @param seed - Seed value for reproducible results
 * @returns Function that returns random values 0-1
 */
export function seededRandom(seed: number): () => number {
  let state = seed;

  return function(): number {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
