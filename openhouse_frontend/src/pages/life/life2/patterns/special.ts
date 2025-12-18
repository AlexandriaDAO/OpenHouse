// Special Patterns - Unique interaction patterns
// These have special behaviors like consuming, reflecting, or complex movement
import type { PatternInfo } from './types';

export const SPECIAL: PatternInfo[] = [
  {
    name: 'Eater 1',
    category: 'special',
    description: 'Consumes gliders without dying',
    cells: 7,
    rle: `x = 4, y = 4, rule = B3/S23
2o2b$obob$2bob$2b2o!`,
  },
  {
    name: 'Backrake 1',
    category: 'special',
    description: 'Complete domination clean sweep bomber',
    cells: 53,
    speed: 'c/2',
    period: 8,
    essential: true,
    rle: `x = 27, y = 18, rule = B3/S23
5b3o11b3o5b$4bo3bo9bo3bo4b$3b2o4bo7bo4b2o3b$2bobob2ob2o5b2ob2obobo2b$b2obo4bob2ob2obo4bob2ob$o4bo3bo2bobo2bo3bo4bo$12bobo12b$2o7b2obobob2o7b2o$12bobo12b$6b3o9b3o6b$6bo3bo9bo6b$6bobo4b3o11b$12bo2bo4b2o5b$15bo11b$11bo3bo11b$11bo3bo11b$15bo11b$12bobo!`,
  },
  {
    name: 'Boojum Reflector',
    category: 'special',
    description: 'Smallest stable glider reflector',
    cells: 44,
    rle: `x = 44, y = 32, rule = B3/S23
4bobo6b2o29b$5b2o6b2o29b$5bo38b7$40bo3b$39bobo2b$39bobo2b$20b2o16b2ob2ob$20b2o22b$38b2ob2ob$2b2o34b2obo2b$bobo39bo$bo40b2o$2o42b2$34b2o8b$34b2o4b2o2b$11b2o27bobob$10bobo29bob$10bo31b2o$9b2o23b2o8b$34b2o8b3$29bo14b$28bobo13b$29bo!`,
  },
  {
    name: '2-Engine Cordership',
    category: 'special',
    description: 'Crazy blob that covers thick space slowly, like a tank',
    cells: 72,
    speed: 'c/12',
    period: 96,
    essential: true,
    rle: `x = 41, y = 49, rule = B3/S23
19b2o$19b4o$19bob2o2$20bo$19b2o$19b3o$21bo$33b2o$33b2o7$36bo$35b2o$34bo3bo$35b2o2bo$40bo$37bobo$38bo$38bo$38b2o$38b2o3$13bo10bo$12b5o5bob2o11bo$11bo10bo3bo9bo$12b2o8b3obo9b2o$13b2o9b2o12bo$2o13bo21b3o$2o35b3o7$8b2o$8b2o11b2o$19b2o2bo$24bo3bo$18bo5bo3bo$19bo2b2o3bobo$20b3o5bo$28bo!`,
  },
  {
    name: 'Enterprise',
    category: 'special',
    description: 'Fast diagonal c/4 explorer, boldly goes forward',
    cells: 52,
    speed: 'c/4',
    period: 4,
    essential: true,
    rle: `x = 21, y = 21, rule = B3/S23
8bo12b$6b2obo11b$4b2o3bo11b$3bo3b2o12b$2bo4b2obo10b$bo2b2ob3obo9b$bo19b$3bobo3b2o10b$2o3bobo13b$o3bo3b2o11b$bo2b2o2bo2bo9b$4b2o3bo8bo2b$10bobo3bobobo$12b2ob3o2bo$12b2o4b2ob$13bob2o4b2$11bobo7b$11bo9b$11b3o7b$12bobo!`,
  },
];
