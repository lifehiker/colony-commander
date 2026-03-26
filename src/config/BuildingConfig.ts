// ── Building Definitions ─────────────────────────────────────────

export interface BuildingDef {
  name: string;
  key: string; // texture key
  width: number; // in tiles
  height: number; // in tiles
  cost: { ore: number; energy: number };
  buildTime: number; // seconds
  maxHealth: number;
  description: string;
  produces?: { resource: string; amount: number; interval: number }; // passive generation
  trainsUnits?: string[]; // unit types this building can train
}

export const BUILDINGS: Record<string, BuildingDef> = {
  command_center: {
    name: 'Command Center',
    key: 'building-command-center',
    width: 3,
    height: 3,
    cost: { ore: 0, energy: 0 }, // free starting building
    buildTime: 0,
    maxHealth: 500,
    description: 'Core of your colony. If destroyed, you lose the colony.',
  },
  barracks: {
    name: 'Barracks',
    key: 'building-barracks',
    width: 2,
    height: 2,
    cost: { ore: 100, energy: 50 },
    buildTime: 30,
    maxHealth: 200,
    description: 'Train infantry units.',
    trainsUnits: ['marine'],
  },
  refinery: {
    name: 'Refinery',
    key: 'building-refinery',
    width: 2,
    height: 2,
    cost: { ore: 75, energy: 25 },
    buildTime: 20,
    maxHealth: 150,
    description: 'Generates Ore passively.',
    produces: { resource: 'ore', amount: 5, interval: 10 }, // 5 ore every 10 seconds
  },
  solar_plant: {
    name: 'Solar Plant',
    key: 'building-solar',
    width: 2,
    height: 1,
    cost: { ore: 50, energy: 0 },
    buildTime: 15,
    maxHealth: 100,
    description: 'Generates Energy passively.',
    produces: { resource: 'energy', amount: 3, interval: 10 },
  },
  turret: {
    name: 'Turret',
    key: 'building-turret',
    width: 1,
    height: 1,
    cost: { ore: 60, energy: 40 },
    buildTime: 15,
    maxHealth: 120,
    description: 'Automated defense. Shoots nearby enemies.',
  },
  wall: {
    name: 'Wall',
    key: 'building-wall',
    width: 1,
    height: 1,
    cost: { ore: 10, energy: 0 },
    buildTime: 3,
    maxHealth: 200,
    description: 'Physical barrier. Blocks movement.',
  },
  bridge: {
    name: 'Bridge',
    key: 'building-bridge',
    width: 1,
    height: 1,
    cost: { ore: 20, energy: 5 },
    buildTime: 5,
    maxHealth: 100,
    description: 'Build over water to create a walkable path.',
  },
};

// ── Unit Definitions ─────────────────────────────────────────────

export interface UnitDef {
  name: string;
  key: string;
  cost: { ore: number; energy: number };
  trainTime: number;
  health: number;
  damage: number;
  speed: number;
  range: number;
}

export const UNITS: Record<string, UnitDef> = {
  marine: {
    name: 'Marine',
    key: 'unit-marine',
    cost: { ore: 30, energy: 10 },
    trainTime: 10,
    health: 50,
    damage: 12,
    speed: 100,
    range: 150,
  },
};
