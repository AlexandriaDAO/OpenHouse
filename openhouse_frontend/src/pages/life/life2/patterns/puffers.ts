// Puffers - Spaceships that leave debris trails behind them
// These expand territory as they move, perfect for claiming land
import type { PatternInfo } from './types';

export const PUFFERS: PatternInfo[] = [
  {
    name: 'Pufferfish',
    category: 'puffer',
    description: 'Creates perfect block walls as it moves',
    cells: 34,
    speed: 'c/2',
    period: 4,
    essential: true,
    rle: `x = 15, y = 12, rule = B3/S23
3bo7bo$2b3o5b3o$b2o2bo3bo2b2o$3b3o3b3o2$4bo5bo$2bo2bo3bo2bo$o5bobo5bo$2o4bobo4b2o$6bobo$3bobo3bobo$4bo5bo!`,
  },
  {
    name: 'Blinker Puffer 1',
    category: 'puffer',
    description: 'Creates a perfect blinker wall trail',
    cells: 23,
    speed: 'c/2',
    period: 8,
    essential: true,
    rle: `x = 9, y = 18, rule = B3/S23
3bo5b$bo3bo3b$o8b$o4bo3b$5o4b4$b2o6b$2ob3o3b$b4o4b$2b2o5b2$5b2o2b$3bo4bo$2bo6b$2bo5bo$2b6o!`,
  },
  {
    name: 'B-52 Bomber',
    category: 'puffer',
    description: 'Shoots gliders in both directions',
    cells: 77,
    period: 104,
    essential: true,
    rle: `x = 39, y = 21, rule = B3/S23
b2o36b$b2o17bo18b$19bobo12bobo2b$20bo12bo5b$2o7b2o23bo2bob$2obo5b2o23bobobo$3bo23bo7bo2bo$3bo23b2o7b2ob$o2bo17b2o5bo10b$b2o18bo17b$21b3o15b$36b2ob$36b2ob$b2o36b$o2bo35b$obobo16bobo4b2o5b2o2b$bo2bo17b2o4b2o5b2obo$5bo12bo3bo15bo$2bobo12bobo18bo$18bo16bo2bo$36b2o!`,
  },
  {
    name: 'Space Rake',
    category: 'puffer',
    description: 'Shoots gliders forward while advancing',
    cells: 45,
    speed: 'c/2',
    period: 20,
    essential: true,
    rle: `x = 22, y = 19, rule = B3/S23
11b2o5b4o$9b2ob2o3bo3bo$9b4o8bo$10b2o5bo2bob2$8bo13b$7b2o8b2o3b$6bo9bo2bo2b$7b5o4bo2bo2b$8b4o3b2ob2o2b$11bo4b2o4b4$18b4o$o2bo13bo3bo$4bo16bo$o3bo12bo2bob$b4o!`,
  },
];
