// Spaceships - Moving patterns that traverse the grid
// These are your attack units for invading enemy territory
import type { PatternInfo } from './types';

export const SPACESHIPS: PatternInfo[] = [
  {
    name: 'Glider',
    category: 'spaceship',
    description: 'Classic diagonal scout, c/4',
    cells: 5,
    speed: 'c/4',
    period: 4,
    essential: true,
    rle: `x = 3, y = 3, rule = B3/S23
bob$2bo$3o!`,
  },
  {
    name: 'LWSS',
    category: 'spaceship',
    description: 'Lightweight spaceship, c/2',
    cells: 9,
    speed: 'c/2',
    period: 4,
    rle: `x = 5, y = 4, rule = B3/S23
bo2bo$o4b$o3bo$4o!`,
  },
  {
    name: 'MWSS',
    category: 'spaceship',
    description: 'Middleweight spaceship, c/2',
    cells: 11,
    speed: 'c/2',
    period: 4,
    rle: `x = 6, y = 5, rule = B3/S23
3bo2b$bo3bo$o5b$o4bo$5o!`,
  },
  {
    name: 'HWSS',
    category: 'spaceship',
    description: 'Heavyweight spaceship, c/2',
    cells: 13,
    speed: 'c/2',
    period: 4,
    rle: `x = 7, y = 5, rule = B3/S23
3b2o2b$bo4bo$o6b$o5bo$6o!`,
  },
  {
    name: 'Copperhead',
    category: 'spaceship',
    description: 'Modern c/10 orthogonal ship',
    cells: 28,
    speed: 'c/10',
    period: 10,
    rle: `x = 8, y = 12, rule = B3/S23
b2o2b2o$3b2o$3b2o$obo2bobo$o6bo2$o6bo$b2o2b2o$2b4o2$3b2o$3b2o!`,
  },
  {
    name: 'Weekender',
    category: 'spaceship',
    description: 'Fast 2c/7 orthogonal ship',
    cells: 36,
    speed: '2c/7',
    period: 7,
    rle: `x = 16, y = 11, rule = B3/S23
bo12bob$bo12bob$obo10bobo$bo12bob$bo12bob$2bo3b4o3bo2b$6b4o6b$2b4o4b4o2b2$4bo6bo4b$5b2o2b2o!`,
  },
  {
    name: 'Spider',
    category: 'spaceship',
    description: 'Absolute tank that moves forward efficiently',
    cells: 47,
    speed: 'c/5',
    period: 5,
    essential: true,
    rle: `x = 27, y = 8, rule = B3/S23
9bo7bo9b$3b2obobob2o3b2obobob2o3b$3obob3o9b3obob3o$o3bobo5bobo5bobo3bo$4b2o6bobo6b2o4b$b2o9bobo9b2ob$b2ob2o15b2ob2ob$5bo15bo!`,
  },
  {
    name: 'Dragon',
    category: 'spaceship',
    description: 'First c/6 spaceship ever built, a beast',
    cells: 102,
    speed: 'c/6',
    period: 6,
    essential: true,
    rle: `x = 29, y = 18, rule = B3/S23
12bo16b$12b2o14bo$10bob2o5bobo4b2ob$5bo3bo3b3o2bo4bo5b$2o3bo2bo6bobo5b3o2bo$2o3bob2o6bo3bobobo5b$2o3bo10bobo7b2ob$5b2o14bo6bo$7bo12bobo6b$7bo12bobo6b$5b2o14bo6bo$2o3bo10bobo7b2ob$2o3bob2o6bo3bobobo5b$2o3bo2bo6bobo5b3o2bo$5bo3bo3b3o2bo4bo5b$10bob2o5bobo4b2ob$12b2o14bo$12bo!`,
  },
  {
    name: 'Dart',
    category: 'spaceship',
    description: 'Fast c/3 striker, quick and deadly',
    cells: 26,
    speed: 'c/3',
    period: 3,
    essential: true,
    rle: `x = 15, y = 10, rule = B3/S23
7bo7b$6bobo6b$5bo3bo5b$6b3o6b2$4b2o3b2o4b$2bo3bobo3bo2b$b2o3bobo3b2ob$o5bobo5bo$bob2obobob2obo!`,
  },
  {
    name: 'Hammerhead',
    category: 'spaceship',
    description: 'Brutal c/2 warship with many variants',
    cells: 49,
    speed: 'c/2',
    period: 4,
    essential: true,
    rle: `x = 18, y = 16, rule = B3/S23
5o13b$o4bo7b2o3b$o11b2ob3o$bo9b2ob4o$3b2o3b2ob2o2b2ob$5bo4bo2bo4b$6bobobo5b$7bo10b$7bo10b$6bobobo5b$5bo4bo2bo4b$3b2o3b2ob2o2b2ob$bo9b2ob4o$o11b2ob3o$o4bo7b2o3b$5o!`,
  },
  {
    name: 'Loafer',
    category: 'spaceship',
    description: 'Small elegant c/7 flanker',
    cells: 20,
    speed: 'c/7',
    period: 7,
    rle: `x = 9, y = 9, rule = B3/S23
b2o2bob2o$o2bo2b2o$bobo$2bo$8bo$6b3o$5bo$6bo$7b2o!`,
  },
  {
    name: 'Crab',
    category: 'spaceship',
    description: 'Cheap medium-speed diagonal, smallest after Glider',
    cells: 19,
    speed: 'c/4',
    period: 4,
    essential: true,
    rle: `x = 13, y = 12, rule = B3/S23
8b2o3b$7b2o4b$9bo3b$11b2o$10bo2b2$9bo2bo$b2o5b2o3b$2o5bo5b$2bo4bobo3b$4b2o2bo4b$4b2o!`,
  },
];
