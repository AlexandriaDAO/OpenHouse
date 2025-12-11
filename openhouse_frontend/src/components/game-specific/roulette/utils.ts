import type { Bet, SpinResult } from '../../declarations/roulette_backend/roulette_backend.did';
import { TABLE_LAYOUT, RED_NUMBERS, BLACK_NUMBERS } from './constants';

// Helper to ensure types match backend if imports fail (fallback)
export interface LocalBet {
  bet_type: any;
  amount: bigint;
}

export function mapUIBetToBackend(zoneId: string, amount: bigint): Bet {
  const parts = zoneId.split('-');
  const type = parts[0];

  let bet_type: any;

  switch (type) {
    case 'straight': {
      const num = parseInt(parts[1]);
      if (isNaN(num) || num < 0 || num > 36) throw new Error(`Invalid straight number: ${parts[1]}`);
      bet_type = { Straight: num };
      break;
    }
    case 'split': {
      const n1 = parseInt(parts[1]);
      const n2 = parseInt(parts[2]);
      if (isNaN(n1) || isNaN(n2)) throw new Error(`Invalid split numbers: ${parts[1]}, ${parts[2]}`);
      // Validation: Are they adjacent? 
      // Diff is 1 (horizontal) or 3 (vertical) usually, or specific cases for 0.
      // This is a basic sanity check.
      bet_type = { Split: [n1, n2] };
      break;
    }
    case 'street': {
      const start = parseInt(parts[1]);
      if (isNaN(start) || start < 1 || start > 34) throw new Error(`Invalid street start: ${parts[1]}`);
      bet_type = { Street: start }; // Start number
      break;
    }
    case 'corner': {
      const top = parseInt(parts[1]);
      if (isNaN(top) || top < 1 || top > 35) throw new Error(`Invalid corner top-left: ${parts[1]}`);
      bet_type = { Corner: top }; // Top-left number
      break;
    }
    case 'sixline': {
      const start = parseInt(parts[1]);
      if (isNaN(start) || start < 1 || start > 31) throw new Error(`Invalid sixline start: ${parts[1]}`);
      bet_type = { SixLine: start }; // Start number of first row
      break;
    }
    case 'column': {
      const col = parseInt(parts[1]);
      if (col < 1 || col > 3) throw new Error(`Invalid column: ${parts[1]}`);
      bet_type = { Column: col };
      break;
    }
    case 'dozen': {
      const doz = parseInt(parts[1]);
      if (doz < 1 || doz > 3) throw new Error(`Invalid dozen: ${parts[1]}`);
      bet_type = { Dozen: doz };
      break;
    }
    case 'red':
      bet_type = { Red: null };
      break;
    case 'black':
      bet_type = { Black: null };
      break;
    case 'even':
      bet_type = { Even: null };
      break;
    case 'odd':
      bet_type = { Odd: null };
      break;
    case 'low':
      bet_type = { Low: null };
      break;
    case 'high':
      bet_type = { High: null };
      break;
    default:
      throw new Error(`Unknown bet type: ${type}`);
  }

  return { bet_type, amount };
}

export function getWinningZones(result: SpinResult): string[] {
  const num = result.winning_number;
  const zones: string[] = [`straight-${num}`];

  if (result.color === 'Red' || (typeof result.color === 'object' && 'Red' in result.color)) zones.push('red');
  if (result.color === 'Black' || (typeof result.color === 'object' && 'Black' in result.color)) zones.push('black');

  if (num !== 0) {
    if (num % 2 === 0) zones.push('even');
    else zones.push('odd');

    if (num <= 18) zones.push('low');
    else zones.push('high');

    const col = getColumnForNumber(num);
    if (col) zones.push(`column-${col}`);

    const dozen = getDozenForNumber(num);
    if (dozen) zones.push(`dozen-${dozen}`);
    
    // Complex bets: Split, Street, Corner, SixLine
    // We reverse engineer which bets would have won with this number.
    
    // Splits: Check adjacent numbers
    // Vertical (diff 3): num-3 and num+3
    if (num > 3) zones.push(`split-${num-3}-${num}`); // The split above
    if (num <= 33) zones.push(`split-${num}-${num+3}`); // The split below
    
    // Horizontal (diff 1): num-1 and num+1, but respect row boundaries
    // Row 1: 1,2,3. 1-2, 2-3.
    // If num is 1: split-1-2.
    // If num is 2: split-1-2, split-2-3.
    // Check if num and num-1 are in same row?
    // Rows are usually defined by ceiling(num/3)? No, rows are vertical columns in physical table, horizontal in numbers.
    // 1,2,3 is a row (Street). 4,5,6 is a row.
    // So 1 and 2 are horizontal neighbors.
    // Check if num-1 is in same row: Math.ceil(num/3) == Math.ceil((num-1)/3)
    if (num > 1 && Math.ceil(num/3) === Math.ceil((num-1)/3)) zones.push(`split-${num-1}-${num}`);
    if (num < 36 && Math.ceil(num/3) === Math.ceil((num+1)/3)) zones.push(`split-${num}-${num+1}`);
    
    // Streets (Rows of 3): 1,2,3 -> street-1. 4,5,6 -> street-4.
    // Start of street is: (Math.ceil(num/3) - 1) * 3 + 1
    const streetStart = (Math.ceil(num/3) - 1) * 3 + 1;
    zones.push(`street-${streetStart}`);
    
    // Corners (Square of 4):
    // If num is 5. Corners: 1,2,4,5 (corner-1); 2,3,5,6 (corner-2); 4,5,7,8 (corner-4); 5,6,8,9 (corner-5).
    // Valid corners usually identified by top-left (smallest) number.
    // Logic: A corner is valid if the other 3 numbers exist and are validly placed.
    // Potential top-lefts relative to num:
    // 1. num itself (if num is TL): num, num+1, num+3, num+4. Valid if num % 3 != 0 and num < 34.
    if (num % 3 !== 0 && num < 34) zones.push(`corner-${num}`);
    
    // 2. num-1 (if num is TR): num-1, num, num+2, num+3. Valid if (num-1)%3!=0 -> num%3!=1. And num-1 < 34.
    if (num % 3 !== 1 && num > 1 && num < 35) zones.push(`corner-${num-1}`);
    
    // 3. num-3 (if num is BL): num-3, num-2, num, num+1. Valid if num-3 % 3 != 0 -> num%3!=0. And num > 3.
    if (num % 3 !== 0 && num > 3) zones.push(`corner-${num-3}`);
    
    // 4. num-4 (if num is BR): num-4, num-3, num-1, num. Valid if num-4 % 3 != 0 -> num%3!=1. And num > 4.
    if (num % 3 !== 1 && num > 4) zones.push(`corner-${num-4}`);
    
    // SixLines (2 rows):
    // Sixline covers street X and street X+3. Identified by start of first street.
    // If num is in street S. 
    // It wins if sixline is S or S-3.
    // Sixline-S covers S and S+3.
    // Sixline-(S-3) covers S-3 and S.
    zones.push(`sixline-${streetStart}`); // Covers this street and next
    if (streetStart > 3) zones.push(`sixline-${streetStart-3}`); // Covers prev street and this
  }

  return zones;
}

function getColumnForNumber(num: number): number | null {
  if (num === 0) return null;
  if (num % 3 === 1) return 1;
  if (num % 3 === 2) return 2;
  return 3;
}

function getDozenForNumber(num: number): number | null {
  if (num === 0) return null;
  if (num <= 12) return 1;
  if (num <= 24) return 2;
  return 3;
}

export function getChipPosition(zoneId: string): { x: number, y: number } {
  const { GRID, ZERO, OUTSIDE_BOTTOM, OUTSIDE_SIDE } = TABLE_LAYOUT;
  const parts = zoneId.split('-');
  const type = parts[0];

  if (type === 'straight') {
    const num = parseInt(parts[1]);
    if (num === 0) {
      return { x: ZERO.X + ZERO.WIDTH / 2, y: ZERO.Y + ZERO.HEIGHT / 2 };
    }
    const col = Math.floor((num - 1) / 3);
    const row = 2 - ((num - 1) % 3);
    
    return {
      x: GRID.X + col * GRID.CELL_WIDTH + GRID.CELL_WIDTH / 2,
      y: GRID.Y + row * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT / 2
    };
  }

  if (type === 'split') {
    const n1 = parseInt(parts[1]);
    const n2 = parseInt(parts[2]);
    const pos1 = getChipPosition(`straight-${n1}`);
    const pos2 = getChipPosition(`straight-${n2}`);
    return { x: (pos1.x + pos2.x) / 2, y: (pos1.y + pos2.y) / 2 };
  }

  if (type === 'corner') {
    const n = parseInt(parts[1]);
    const pos1 = getChipPosition(`straight-${n}`);
    // Corner involves n, n+1, n+3, n+4. Center is avg of n and n+4
    const pos2 = getChipPosition(`straight-${n + 4}`);
    return { x: (pos1.x + pos2.x) / 2, y: (pos1.y + pos2.y) / 2 };
  }

  if (type === 'column') {
    const colNum = parseInt(parts[1]); 
    const row = 3 - colNum; 
    return {
      x: GRID.X + 12 * GRID.CELL_WIDTH + GRID.CELL_WIDTH / 2,
      y: GRID.Y + row * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT / 2
    };
  }

  if (type === 'dozen') {
    const dozNum = parseInt(parts[1]); 
    const centerCol = (dozNum - 1) * 4 + 1.5; 
    return {
      x: GRID.X + centerCol * GRID.CELL_WIDTH,
      y: GRID.Y + 3 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT / 2 
    };
  }
  
  if (type === 'low') return { x: GRID.X + 1 * GRID.CELL_WIDTH, y: GRID.Y + 4 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT/2 }; 
  if (type === 'even') return { x: GRID.X + 3 * GRID.CELL_WIDTH, y: GRID.Y + 4 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT/2 };
  if (type === 'red') return { x: GRID.X + 5 * GRID.CELL_WIDTH, y: GRID.Y + 4 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT/2 };
  if (type === 'black') return { x: GRID.X + 7 * GRID.CELL_WIDTH, y: GRID.Y + 4 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT/2 };
  if (type === 'odd') return { x: GRID.X + 9 * GRID.CELL_WIDTH, y: GRID.Y + 4 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT/2 };
  if (type === 'high') return { x: GRID.X + 11 * GRID.CELL_WIDTH, y: GRID.Y + 4 * GRID.CELL_HEIGHT + GRID.CELL_HEIGHT/2 };

  return { x: 0, y: 0 };
}
