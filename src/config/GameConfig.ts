// ── World / Map ──────────────────────────────────────────────
export const TILE_SIZE = 32;
export const CHUNK_SIZE = 16;   // tiles per chunk
export const WORLD_SIZE = 100;  // chunks

// ── Commander ────────────────────────────────────────────────
export const COMMANDER_SPEED = 200;
export const COMMANDER_SPRINT_SPEED = 350;
export const COMMANDER_HEALTH = 100;

// ── Weapons ──────────────────────────────────────────────────
export interface WeaponConfig {
  name: string;
  damage: number;
  fireRate: number;        // shots per second
  ammoCapacity: number;
  projectileSpeed: number;
  spread: number;          // degrees of inaccuracy
}

export const WEAPONS: Record<string, WeaponConfig> = {
  pistol: {
    name: 'Pistol',
    damage: 15,
    fireRate: 4,
    ammoCapacity: 12,
    projectileSpeed: 600,
    spread: 2,
  },
  rifle: {
    name: 'Rifle',
    damage: 25,
    fireRate: 8,
    ammoCapacity: 30,
    projectileSpeed: 900,
    spread: 1,
  },
  shotgun: {
    name: 'Shotgun',
    damage: 40,
    fireRate: 1.5,
    ammoCapacity: 6,
    projectileSpeed: 500,
    spread: 15,
  },
};

// ── Rover ────────────────────────────────────────────────────
export const ROVER_SPEED = 400;

// ── Enemy Types ──────────────────────────────────────────────
export interface EnemyConfig {
  name: string;
  health: number;
  speed: number;
  damage: number;
  detectionRange: number;
}

export const ENEMIES: Record<string, EnemyConfig> = {
  basicAlien: {
    name: 'Basic Alien',
    health: 30,
    speed: 80,
    damage: 10,
    detectionRange: 200,
  },
  spitter: {
    name: 'Spitter',
    health: 20,
    speed: 60,
    damage: 15,
    detectionRange: 300,
  },
  brute: {
    name: 'Brute',
    health: 100,
    speed: 40,
    damage: 30,
    detectionRange: 150,
  },
};

// ── Loot ─────────────────────────────────────────────────────
export const LOOT_TYPES = [
  'ammo',
  'health_pack',
  'weapon_upgrade',
  'building_material',
  'rare_mineral',
] as const;

export type LootType = (typeof LOOT_TYPES)[number];
