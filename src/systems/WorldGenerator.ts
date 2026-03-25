import { TILE_SIZE, CHUNK_SIZE, WORLD_SIZE } from '../config/GameConfig';

// ── Simplex Noise (self-contained, no dependencies) ─────────────
// Based on Stefan Gustavson's simplex noise implementation

const GRAD3: number[][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

class SimplexNoise {
  private perm: number[] = [];
  private permMod12: number[] = [];

  constructor(seed: number) {
    const p: number[] = new Array(256);
    // Seed-based permutation using a simple LCG
    let s = seed;
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = ((s >>> 0) % (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  private dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }

  noise2D(xin: number, yin: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;

    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1: number, j1: number;
    if (x0 > y0) { i1 = 1; j1 = 0; }
    else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      const gi0 = this.permMod12[ii + this.perm[jj]];
      n0 = t0 * t0 * this.dot(GRAD3[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
      n1 = t1 * t1 * this.dot(GRAD3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
      n2 = t2 * t2 * this.dot(GRAD3[gi2], x2, y2);
    }

    // Returns value in [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Fractal Brownian Motion — layer multiple octaves for natural terrain.
   */
  fbm(x: number, y: number, octaves: number, lacunarity: number, persistence: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxAmplitude;
  }
}

// ── Tile types ──────────────────────────────────────────────────
export const TileType = {
  WATER: 'water',
  DIRT: 'dirt',
  GRASS: 'grass',
  ROCK: 'rock',
  ORE: 'ore',
  TREE: 'tree',
} as const;

export type TileTypeValue = typeof TileType[keyof typeof TileType];

const TEXTURE_MAP: Record<TileTypeValue, string> = {
  [TileType.WATER]: 'tile-water',
  [TileType.DIRT]: 'tile-dirt',
  [TileType.GRASS]: 'tile-grass',
  [TileType.ROCK]: 'tile-rock',
  [TileType.ORE]: 'tile-ore',
  [TileType.TREE]: 'tile-tree',
};

// Tiles that block movement
const COLLIDABLE_TILES = new Set<TileTypeValue>([
  TileType.WATER,
  TileType.ROCK,
  TileType.TREE,
]);

// ── Chunk data ──────────────────────────────────────────────────
interface ChunkData {
  /** Column index of the chunk in the world grid */
  cx: number;
  /** Row index of the chunk in the world grid */
  cy: number;
  /** Flat array of tile types (CHUNK_SIZE * CHUNK_SIZE) */
  tiles: TileTypeValue[];
  /** Phaser sprites for every tile in this chunk */
  sprites: Phaser.GameObjects.Sprite[];
  /** Whether collision bodies have been registered */
  registered: boolean;
}

// ── Chunk render radius ─────────────────────────────────────────
const CHUNK_RENDER_RADIUS = 3; // 3 chunks in each direction => 7x7 visible area
const CHUNK_UNLOAD_RADIUS = CHUNK_RENDER_RADIUS + 2; // hysteresis — keep a buffer before unloading

// ── Noise tuning ────────────────────────────────────────────────
const TERRAIN_SCALE = 0.02;   // lower = bigger biome regions
const TERRAIN_OCTAVES = 5;
const TERRAIN_LACUNARITY = 2.0;
const TERRAIN_PERSISTENCE = 0.5;

const VEG_SCALE = 0.08;       // vegetation is more fine-grained
const VEG_OCTAVES = 3;
const VEG_LACUNARITY = 2.0;
const VEG_PERSISTENCE = 0.45;
const VEG_THRESHOLD = 0.25;   // noise > this on grass => tree

// River carving — a separate noise pass with high frequency
const RIVER_SCALE = 0.03;
const RIVER_OCTAVES = 4;
const RIVER_WIDTH = 0.06;     // how thin the "zero-crossing band" is

// ─────────────────────────────────────────────────────────────────
export class WorldGenerator {
  private scene: Phaser.Scene;
  private seed: number;
  private terrainNoise: SimplexNoise;
  private vegNoise: SimplexNoise;
  private riverNoise: SimplexNoise;

  /** chunk key "cx,cy" -> ChunkData */
  private chunks: Map<string, ChunkData> = new Map();

  /** Static group for all collidable tiles (shared across chunks) */
  private collisionGroup: Phaser.Physics.Arcade.StaticGroup;

  /** Cached ore positions discovered so far */
  private orePositions: { x: number; y: number }[] = [];

  /** Track the last chunk the player was in to avoid redundant updates */
  private lastPlayerChunkX = Number.MIN_SAFE_INTEGER;
  private lastPlayerChunkY = Number.MIN_SAFE_INTEGER;

  /** Queue of chunks waiting to be loaded (spread across frames to avoid stutter) */
  private chunkLoadQueue: { cx: number; cy: number }[] = [];
  /** Max chunks to load per frame */
  private readonly CHUNKS_PER_FRAME = 2;

  // ──────────────────────────────────────────────────────────────
  constructor(scene: Phaser.Scene, seed?: number) {
    this.scene = scene;
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);

    // Each noise layer uses a different seed offset to keep them uncorrelated
    this.terrainNoise = new SimplexNoise(this.seed);
    this.vegNoise = new SimplexNoise(this.seed + 31337);
    this.riverNoise = new SimplexNoise(this.seed + 90210);

    this.collisionGroup = this.scene.physics.add.staticGroup();
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Call every frame (or on player move). Loads/unloads chunks around the
   * player so only a manageable neighbourhood is in memory.
   */
  update(playerX: number, playerY: number): void {
    const chunkPixelSize = CHUNK_SIZE * TILE_SIZE;
    const pcx = Math.floor(playerX / chunkPixelSize);
    const pcy = Math.floor(playerY / chunkPixelSize);

    // Process queued chunk loads (spread across frames to avoid stutter)
    const loadCount = Math.min(this.chunkLoadQueue.length, this.CHUNKS_PER_FRAME);
    for (let i = 0; i < loadCount; i++) {
      const queued = this.chunkLoadQueue.shift()!;
      const key = `${queued.cx},${queued.cy}`;
      if (!this.chunks.has(key)) {
        this.loadChunk(queued.cx, queued.cy);
      }
    }

    // Skip heavy recalculation if the player hasn't moved to a new chunk
    if (pcx === this.lastPlayerChunkX && pcy === this.lastPlayerChunkY) return;
    this.lastPlayerChunkX = pcx;
    this.lastPlayerChunkY = pcy;

    // 1. Queue chunks in render radius that don't exist yet
    // Sort by distance to player so nearest chunks load first
    const toLoad: { cx: number; cy: number; dist: number }[] = [];
    for (let dx = -CHUNK_RENDER_RADIUS; dx <= CHUNK_RENDER_RADIUS; dx++) {
      for (let dy = -CHUNK_RENDER_RADIUS; dy <= CHUNK_RENDER_RADIUS; dy++) {
        const cx = pcx + dx;
        const cy = pcy + dy;
        if (cx < 0 || cy < 0 || cx >= WORLD_SIZE || cy >= WORLD_SIZE) continue;
        const key = `${cx},${cy}`;
        if (!this.chunks.has(key)) {
          // Skip if already in queue
          const alreadyQueued = this.chunkLoadQueue.some(q => q.cx === cx && q.cy === cy);
          if (!alreadyQueued) {
            toLoad.push({ cx, cy, dist: dx * dx + dy * dy });
          }
        }
      }
    }
    // Load nearest chunks first
    toLoad.sort((a, b) => a.dist - b.dist);
    this.chunkLoadQueue.push(...toLoad);

    // 2. Unload distant chunks
    for (const [key, chunk] of this.chunks) {
      const dx = Math.abs(chunk.cx - pcx);
      const dy = Math.abs(chunk.cy - pcy);
      if (dx > CHUNK_UNLOAD_RADIUS || dy > CHUNK_UNLOAD_RADIUS) {
        this.unloadChunk(key, chunk);
      }
    }
  }

  getCollisionGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.collisionGroup;
  }

  /**
   * Returns the tile type at an arbitrary world-pixel position.
   * Works even if the chunk hasn't been loaded (generates on the fly).
   */
  getTileAt(worldX: number, worldY: number): string {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const key = `${cx},${cy}`;

    const chunk = this.chunks.get(key);
    if (chunk) {
      const localX = tileX - cx * CHUNK_SIZE;
      const localY = tileY - cy * CHUNK_SIZE;
      return chunk.tiles[localY * CHUNK_SIZE + localX];
    }

    // Chunk not loaded — compute on the fly without creating sprites
    return this.computeTileType(tileX, tileY);
  }

  getOrePositions(): { x: number; y: number }[] {
    return this.orePositions;
  }

  // ── Chunk lifecycle ───────────────────────────────────────────

  private loadChunk(cx: number, cy: number): void {
    const tiles: TileTypeValue[] = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const sprites: Phaser.GameObjects.Sprite[] = [];
    const originTileX = cx * CHUNK_SIZE;
    const originTileY = cy * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const tileX = originTileX + lx;
        const tileY = originTileY + ly;
        const tileType = this.computeTileType(tileX, tileY);
        const idx = ly * CHUNK_SIZE + lx;
        tiles[idx] = tileType;

        const worldPx = tileX * TILE_SIZE + TILE_SIZE * 0.5;
        const worldPy = tileY * TILE_SIZE + TILE_SIZE * 0.5;

        const sprite = this.scene.add.sprite(worldPx, worldPy, TEXTURE_MAP[tileType]);
        sprite.setOrigin(0.5, 0.5);
        // Depth-sort: ground layer at 0, trees slightly above
        sprite.setDepth(tileType === TileType.TREE ? 1 : 0);

        sprites.push(sprite);

        // Collision registration
        if (COLLIDABLE_TILES.has(tileType)) {
          this.collisionGroup.add(sprite);
          const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
          body.setSize(TILE_SIZE, TILE_SIZE);
          body.updateFromGameObject();
        }

        // Track ore
        if (tileType === TileType.ORE) {
          this.orePositions.push({ x: worldPx, y: worldPy });
        }
      }
    }

    const chunk: ChunkData = { cx, cy, tiles, sprites, registered: true };
    this.chunks.set(`${cx},${cy}`, chunk);
  }

  private unloadChunk(key: string, chunk: ChunkData): void {
    // Remove ore positions belonging to this chunk
    const originPx = chunk.cx * CHUNK_SIZE * TILE_SIZE;
    const originPy = chunk.cy * CHUNK_SIZE * TILE_SIZE;
    const extentPx = originPx + CHUNK_SIZE * TILE_SIZE;
    const extentPy = originPy + CHUNK_SIZE * TILE_SIZE;

    this.orePositions = this.orePositions.filter(
      (p) => p.x < originPx || p.x >= extentPx || p.y < originPy || p.y >= extentPy,
    );

    // Destroy all sprites (also removes them from the collision group)
    for (const sprite of chunk.sprites) {
      sprite.destroy();
    }

    this.chunks.delete(key);
  }

  // ── Terrain evaluation ────────────────────────────────────────

  /**
   * Determines the tile type for a given world-tile coordinate.
   * Pure function of (tileX, tileY) + seed — same input always gives
   * the same output regardless of chunk loading state.
   */
  private computeTileType(tileX: number, tileY: number): TileTypeValue {
    // --- River pass (overrides terrain where it cuts through) ---
    const riverVal = this.riverNoise.fbm(
      tileX * RIVER_SCALE,
      tileY * RIVER_SCALE,
      RIVER_OCTAVES,
      TERRAIN_LACUNARITY,
      TERRAIN_PERSISTENCE,
    );
    if (Math.abs(riverVal) < RIVER_WIDTH) {
      // River carving — always water
      return TileType.WATER;
    }

    // --- Main terrain pass ---
    const n = this.terrainNoise.fbm(
      tileX * TERRAIN_SCALE,
      tileY * TERRAIN_SCALE,
      TERRAIN_OCTAVES,
      TERRAIN_LACUNARITY,
      TERRAIN_PERSISTENCE,
    );

    if (n < -0.3) return TileType.WATER;
    if (n < -0.1) return TileType.DIRT;
    if (n > 0.7) return TileType.ORE;
    if (n > 0.5) return TileType.ROCK;

    // Grass — but maybe a tree?
    const v = this.vegNoise.fbm(
      tileX * VEG_SCALE,
      tileY * VEG_SCALE,
      VEG_OCTAVES,
      VEG_LACUNARITY,
      VEG_PERSISTENCE,
    );
    if (v > VEG_THRESHOLD) return TileType.TREE;

    return TileType.GRASS;
  }
}
