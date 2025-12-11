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
    case 'straight':
      bet_type = { Straight: parseInt(parts[1]) };
      break;
    case 'split':
      bet_type = { Split: [parseInt(parts[1]), parseInt(parts[2])] };
      break;
    case 'street':
      bet_type = { Street: parseInt(parts[1]) }; // Start number
      break;
    case 'corner':
      bet_type = { Corner: parseInt(parts[1]) }; // Top-left number
      break;
    case 'sixline':
      bet_type = { SixLine: parseInt(parts[1]) }; // Start number of first row
      break;
    case 'column':
      bet_type = { Column: parseInt(parts[1]) };
      break;
    case 'dozen':
      bet_type = { Dozen: parseInt(parts[1]) };
      break;
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