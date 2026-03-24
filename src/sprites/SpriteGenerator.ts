import Phaser from 'phaser';

/**
 * Generates ALL game sprite textures at runtime using Phaser's Graphics API.
 * No external image files needed — everything is pixel art drawn programmatically.
 * Call this once during BootScene.preload().
 */
export function generateSprites(scene: Phaser.Scene): void {
  generateCommander(scene);
  generateCommanderSprint(scene);
  generateBullets(scene);
  generateAlienBasic(scene);
  generateAlienSpitter(scene);
  generateAlienBrute(scene);
  generateRover(scene);
  generateLootItems(scene);
  generateTerrainTiles(scene);
  generateEffects(scene);
  generateHUDElements(scene);
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function gfx(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  return scene.add.graphics();
}

function finish(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number): void {
  g.generateTexture(key, w, h);
  g.destroy();
}

// ─── Commander ───────────────────────────────────────────────────────────────

function generateCommander(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const s = 32;

  // Shadow
  g.fillStyle(0x111122, 0.3);
  g.fillEllipse(16, 24, 18, 8);

  // Boots / lower body – dark blue
  g.fillStyle(0x1a2744);
  g.fillRect(10, 22, 5, 6);
  g.fillRect(17, 22, 5, 6);

  // Legs – dark blue armor
  g.fillStyle(0x223366);
  g.fillRect(11, 18, 4, 6);
  g.fillRect(17, 18, 4, 6);

  // Torso – main armor dark blue
  g.fillStyle(0x2a4080);
  g.fillRect(9, 10, 14, 10);

  // Torso shading – lighter center
  g.fillStyle(0x3355aa);
  g.fillRect(11, 12, 10, 6);

  // Chest plate highlight
  g.fillStyle(0x4466bb);
  g.fillRect(13, 13, 6, 4);

  // Shoulder pads
  g.fillStyle(0x1a2744);
  g.fillRect(7, 10, 4, 5);
  g.fillRect(21, 10, 4, 5);
  // Shoulder highlight
  g.fillStyle(0x2a4080);
  g.fillRect(8, 11, 2, 3);
  g.fillRect(22, 11, 2, 3);

  // Arms
  g.fillStyle(0x223366);
  g.fillRect(7, 14, 3, 6);
  g.fillRect(22, 14, 3, 6);

  // Weapon in right hand
  g.fillStyle(0x555555);
  g.fillRect(23, 12, 2, 8);
  g.fillStyle(0x777777);
  g.fillRect(23, 8, 2, 5);

  // Neck
  g.fillStyle(0xd4a574);
  g.fillRect(14, 8, 4, 3);

  // Helmet base
  g.fillStyle(0x1a2744);
  g.fillRect(11, 2, 10, 8);

  // Helmet front
  g.fillStyle(0x223366);
  g.fillRect(12, 3, 8, 6);

  // Visor – green glow
  g.fillStyle(0x00ff66);
  g.fillRect(13, 4, 6, 3);

  // Visor shine
  g.fillStyle(0x88ffaa);
  g.fillRect(14, 4, 2, 1);

  // Helmet top ridge
  g.fillStyle(0x3355aa);
  g.fillRect(14, 2, 4, 1);

  // Antenna
  g.fillStyle(0x888888);
  g.fillRect(20, 1, 1, 3);
  g.fillStyle(0xff3333);
  g.fillRect(20, 0, 1, 1);

  finish(g, 'commander', s, s);
}

function generateCommanderSprint(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const s = 32;

  // Shadow (stretched for motion)
  g.fillStyle(0x111122, 0.25);
  g.fillEllipse(16, 25, 20, 7);

  // Boots – spread apart for running
  g.fillStyle(0x1a2744);
  g.fillRect(8, 23, 5, 5);
  g.fillRect(19, 21, 5, 5);

  // Legs – spread
  g.fillStyle(0x223366);
  g.fillRect(9, 19, 4, 5);
  g.fillRect(19, 17, 4, 5);

  // Torso – tilted slightly forward
  g.fillStyle(0x2a4080);
  g.fillRect(10, 9, 13, 10);
  g.fillStyle(0x3355aa);
  g.fillRect(12, 11, 9, 6);

  // Shoulder pads
  g.fillStyle(0x1a2744);
  g.fillRect(8, 9, 4, 5);
  g.fillRect(21, 9, 4, 5);

  // Arms (pumping motion)
  g.fillStyle(0x223366);
  g.fillRect(6, 12, 3, 7);
  g.fillRect(23, 10, 3, 7);

  // Weapon bouncing
  g.fillStyle(0x555555);
  g.fillRect(24, 10, 2, 7);
  g.fillStyle(0x777777);
  g.fillRect(24, 7, 2, 4);

  // Neck
  g.fillStyle(0xd4a574);
  g.fillRect(14, 7, 4, 3);

  // Helmet
  g.fillStyle(0x1a2744);
  g.fillRect(12, 1, 10, 8);
  g.fillStyle(0x223366);
  g.fillRect(13, 2, 8, 6);

  // Visor
  g.fillStyle(0x00ff66);
  g.fillRect(14, 3, 6, 3);
  g.fillStyle(0x88ffaa);
  g.fillRect(15, 3, 2, 1);

  // Helmet ridge
  g.fillStyle(0x3355aa);
  g.fillRect(15, 1, 4, 1);

  // Motion lines
  g.fillStyle(0xaaccff, 0.4);
  g.fillRect(2, 8, 6, 1);
  g.fillRect(0, 14, 7, 1);
  g.fillRect(3, 20, 5, 1);

  // Antenna
  g.fillStyle(0x888888);
  g.fillRect(21, 0, 1, 3);
  g.fillStyle(0xff3333);
  g.fillRect(21, 0, 1, 1);

  finish(g, 'commander-sprint', s, s);
}

// ─── Bullets ─────────────────────────────────────────────────────────────────

function generateBullets(scene: Phaser.Scene): void {
  // Pistol bullet – 4x4 yellow dot
  let g = gfx(scene);
  g.fillStyle(0xffff00);
  g.fillCircle(2, 2, 2);
  g.fillStyle(0xffffaa);
  g.fillCircle(1.5, 1.5, 1);
  finish(g, 'bullet-pistol', 4, 4);

  // Rifle bullet – 6x2 yellow-orange line
  g = gfx(scene);
  g.fillStyle(0xff8800);
  g.fillRect(0, 0, 6, 2);
  g.fillStyle(0xffcc00);
  g.fillRect(1, 0, 4, 2);
  g.fillStyle(0xffffaa);
  g.fillRect(4, 0, 2, 2);
  finish(g, 'bullet-rifle', 6, 2);

  // Shotgun pellets – 5 pellets spread across 16x16
  g = gfx(scene);
  const pelletPositions = [
    [3, 3], [8, 1], [13, 4], [5, 10], [11, 9],
  ];
  for (const [px, py] of pelletPositions) {
    g.fillStyle(0xffaa00);
    g.fillCircle(px, py, 1.5);
    g.fillStyle(0xffdd66);
    g.fillRect(px - 1, py - 1, 1, 1);
  }
  finish(g, 'bullet-shotgun', 16, 14);
}

// ─── Enemies ─────────────────────────────────────────────────────────────────

function generateAlienBasic(scene: Phaser.Scene): void {
  const g = gfx(scene);

  // Shadow
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(16, 27, 20, 6);

  // Legs (6 small ones)
  g.fillStyle(0x225522);
  g.fillRect(7, 22, 2, 5);
  g.fillRect(12, 24, 2, 4);
  g.fillRect(18, 24, 2, 4);
  g.fillRect(23, 22, 2, 5);
  g.fillRect(9, 25, 2, 4);
  g.fillRect(21, 25, 2, 4);

  // Body – oval bug shape
  g.fillStyle(0x226622);
  g.fillEllipse(16, 16, 20, 16);

  // Body highlight – lighter green center
  g.fillStyle(0x33aa33);
  g.fillEllipse(16, 15, 14, 10);

  // Body sheen
  g.fillStyle(0x44cc44);
  g.fillEllipse(14, 13, 6, 4);

  // Shell segments
  g.fillStyle(0x1a551a, 0.5);
  g.fillRect(10, 14, 12, 1);
  g.fillRect(11, 18, 10, 1);

  // Mandibles
  g.fillStyle(0x553300);
  g.fillRect(11, 8, 2, 4);
  g.fillRect(19, 8, 2, 4);

  // Eyes – red and menacing
  g.fillStyle(0xff0000);
  g.fillCircle(12, 10, 2);
  g.fillCircle(20, 10, 2);

  // Eye shine
  g.fillStyle(0xff6666);
  g.fillRect(11, 9, 1, 1);
  g.fillRect(19, 9, 1, 1);

  // Antennae
  g.fillStyle(0x338833);
  g.fillRect(13, 6, 1, 4);
  g.fillRect(18, 6, 1, 4);
  g.fillStyle(0x44cc44);
  g.fillRect(13, 5, 1, 1);
  g.fillRect(18, 5, 1, 1);

  finish(g, 'alien-basic', 32, 32);
}

function generateAlienSpitter(scene: Phaser.Scene): void {
  const g = gfx(scene);

  // Shadow
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(16, 27, 18, 6);

  // Legs (4 legs)
  g.fillStyle(0x442266);
  g.fillRect(8, 22, 3, 6);
  g.fillRect(21, 22, 3, 6);
  g.fillRect(11, 24, 3, 5);
  g.fillRect(18, 24, 3, 5);

  // Body
  g.fillStyle(0x552288);
  g.fillEllipse(16, 16, 18, 16);

  // Body lighter center
  g.fillStyle(0x7733aa);
  g.fillEllipse(16, 15, 12, 10);

  // Body sheen
  g.fillStyle(0x9944cc);
  g.fillEllipse(15, 13, 6, 4);

  // Acid sac – greenish bulge on front
  g.fillStyle(0x88cc22);
  g.fillEllipse(16, 10, 8, 6);
  g.fillStyle(0xaaee44);
  g.fillEllipse(16, 9, 4, 3);

  // Mouth / spitter opening
  g.fillStyle(0x331155);
  g.fillEllipse(16, 7, 4, 3);
  g.fillStyle(0x220033);
  g.fillEllipse(16, 7, 2, 2);

  // Dripping acid
  g.fillStyle(0x88cc22, 0.7);
  g.fillRect(15, 5, 1, 2);
  g.fillRect(17, 4, 1, 3);

  // Eyes – yellow/orange
  g.fillStyle(0xffaa00);
  g.fillCircle(12, 12, 2);
  g.fillCircle(20, 12, 2);
  g.fillStyle(0xffdd44);
  g.fillRect(11, 11, 1, 1);
  g.fillRect(19, 11, 1, 1);

  // Back spines
  g.fillStyle(0x6622aa);
  g.fillRect(12, 19, 2, 4);
  g.fillRect(16, 20, 2, 4);
  g.fillRect(20, 19, 2, 4);

  finish(g, 'alien-spitter', 32, 32);
}

function generateAlienBrute(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const w = 48;
  const h = 48;

  // Shadow
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(24, 42, 32, 10);

  // Legs – thick and powerful
  g.fillStyle(0x552211);
  g.fillRect(10, 34, 6, 10);
  g.fillRect(32, 34, 6, 10);
  g.fillRect(16, 36, 5, 9);
  g.fillRect(27, 36, 5, 9);

  // Feet / claws
  g.fillStyle(0x331100);
  g.fillRect(9, 42, 3, 3);
  g.fillRect(14, 42, 3, 3);
  g.fillRect(31, 42, 3, 3);
  g.fillRect(36, 42, 3, 3);

  // Main body – massive
  g.fillStyle(0x883322);
  g.fillEllipse(24, 24, 32, 26);

  // Body highlight
  g.fillStyle(0xaa4433);
  g.fillEllipse(24, 22, 24, 18);

  // Body inner sheen
  g.fillStyle(0xcc5544);
  g.fillEllipse(22, 20, 12, 8);

  // Armored plates
  g.fillStyle(0x662211, 0.6);
  g.fillRect(12, 18, 24, 2);
  g.fillRect(14, 24, 20, 2);
  g.fillRect(12, 30, 24, 2);

  // Massive arms / claws
  g.fillStyle(0x773322);
  g.fillRect(4, 16, 8, 14);
  g.fillRect(36, 16, 8, 14);

  // Arm highlight
  g.fillStyle(0x994433);
  g.fillRect(5, 18, 6, 10);
  g.fillRect(37, 18, 6, 10);

  // Claws on arms
  g.fillStyle(0x331100);
  g.fillRect(3, 28, 3, 4);
  g.fillRect(7, 29, 3, 4);
  g.fillRect(38, 28, 3, 4);
  g.fillRect(42, 29, 3, 4);

  // Head (smaller than body – hunched)
  g.fillStyle(0x773322);
  g.fillEllipse(24, 10, 16, 12);

  // Head highlight
  g.fillStyle(0x994433);
  g.fillEllipse(24, 9, 10, 8);

  // Brow ridge
  g.fillStyle(0x552211);
  g.fillRect(16, 7, 16, 3);

  // Eyes – angry red
  g.fillStyle(0xff2200);
  g.fillCircle(19, 9, 3);
  g.fillCircle(29, 9, 3);

  // Eye inner
  g.fillStyle(0xff6644);
  g.fillCircle(19, 8, 1.5);
  g.fillCircle(29, 8, 1.5);

  // Mouth – jagged teeth
  g.fillStyle(0x331100);
  g.fillRect(18, 13, 12, 3);
  g.fillStyle(0xeeeecc);
  g.fillRect(19, 13, 2, 2);
  g.fillRect(22, 13, 2, 2);
  g.fillRect(25, 13, 2, 2);
  g.fillRect(28, 13, 2, 2);

  // Horn stubs
  g.fillStyle(0x553311);
  g.fillRect(16, 3, 3, 5);
  g.fillRect(29, 3, 3, 5);
  g.fillStyle(0x664422);
  g.fillRect(17, 2, 2, 3);
  g.fillRect(30, 2, 2, 3);

  finish(g, 'alien-brute', w, h);
}

// ─── Rover ───────────────────────────────────────────────────────────────────

function generateRover(scene: Phaser.Scene): void {
  const g = gfx(scene);
  const w = 48;
  const h = 64;

  // Shadow
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(24, 56, 42, 10);

  // Wheels (dark rubber)
  g.fillStyle(0x222222);
  // Left wheels
  g.fillRect(2, 8, 6, 12);
  g.fillRect(2, 28, 6, 12);
  g.fillRect(2, 46, 6, 12);
  // Right wheels
  g.fillRect(40, 8, 6, 12);
  g.fillRect(40, 28, 6, 12);
  g.fillRect(40, 46, 6, 12);

  // Wheel treads
  g.fillStyle(0x333333);
  for (let wy = 0; wy < 3; wy++) {
    const baseY = 8 + wy * 20;
    for (let t = 0; t < 4; t++) {
      g.fillRect(3, baseY + t * 3, 4, 1);
      g.fillRect(41, baseY + t * 3, 4, 1);
    }
  }

  // Main hull – military green
  g.fillStyle(0x3d5c2e);
  g.fillRect(8, 4, 32, 56);

  // Hull lighter center
  g.fillStyle(0x4d7038);
  g.fillRect(10, 6, 28, 52);

  // Hull top highlight
  g.fillStyle(0x5a8042);
  g.fillRect(12, 8, 24, 20);

  // Cockpit / windshield area (front)
  g.fillStyle(0x223322);
  g.fillRect(12, 6, 24, 14);

  // Windshield glass
  g.fillStyle(0x446688);
  g.fillRect(14, 8, 20, 8);

  // Glass reflection
  g.fillStyle(0x6699bb, 0.5);
  g.fillRect(15, 9, 6, 3);

  // Dashboard / interior
  g.fillStyle(0x334433);
  g.fillRect(14, 14, 20, 4);

  // Headlights
  g.fillStyle(0xffffaa);
  g.fillRect(12, 4, 4, 3);
  g.fillRect(32, 4, 4, 3);
  g.fillStyle(0xffff66);
  g.fillRect(13, 5, 2, 1);
  g.fillRect(33, 5, 2, 1);

  // Roof / cargo area
  g.fillStyle(0x3d5c2e);
  g.fillRect(10, 22, 28, 34);

  // Roof panel lines
  g.fillStyle(0x2d4c1e, 0.5);
  g.fillRect(10, 30, 28, 1);
  g.fillRect(10, 40, 28, 1);
  g.fillRect(10, 50, 28, 1);

  // Roof rack / equipment
  g.fillStyle(0x555555);
  g.fillRect(12, 24, 24, 2);
  g.fillRect(12, 32, 24, 2);

  // Turret mount
  g.fillStyle(0x444444);
  g.fillCircle(24, 36, 5);
  g.fillStyle(0x555555);
  g.fillCircle(24, 36, 3);
  // Gun barrel
  g.fillStyle(0x444444);
  g.fillRect(23, 26, 2, 10);
  g.fillStyle(0x555555);
  g.fillRect(23, 24, 2, 4);

  // Tail lights
  g.fillStyle(0xff2222);
  g.fillRect(12, 57, 4, 3);
  g.fillRect(32, 57, 4, 3);

  // Side armor plates
  g.fillStyle(0x2d4c1e);
  g.fillRect(8, 10, 3, 44);
  g.fillRect(37, 10, 3, 44);

  finish(g, 'rover', w, h);
}

// ─── Loot Items ──────────────────────────────────────────────────────────────

function generateLootItems(scene: Phaser.Scene): void {
  const sz = 16;

  // Ammo box – yellow/orange
  let g = gfx(scene);
  // Box body
  g.fillStyle(0xaa7700);
  g.fillRect(2, 3, 12, 10);
  g.fillStyle(0xcc9922);
  g.fillRect(3, 4, 10, 8);
  g.fillStyle(0xddaa33);
  g.fillRect(4, 5, 8, 4);
  // Bullet icon
  g.fillStyle(0xffdd00);
  g.fillRect(6, 6, 2, 5);
  g.fillRect(8, 7, 2, 4);
  // Latch
  g.fillStyle(0x886600);
  g.fillRect(6, 3, 4, 1);
  // Glow
  g.fillStyle(0xffee66, 0.3);
  g.fillCircle(8, 8, 6);
  finish(g, 'loot-ammo', sz, sz);

  // Health pack – red cross
  g = gfx(scene);
  // White box
  g.fillStyle(0xcccccc);
  g.fillRect(2, 2, 12, 12);
  g.fillStyle(0xeeeeee);
  g.fillRect(3, 3, 10, 10);
  // Red cross
  g.fillStyle(0xdd2222);
  g.fillRect(6, 3, 4, 10);
  g.fillRect(3, 6, 10, 4);
  // Cross highlight
  g.fillStyle(0xff4444);
  g.fillRect(7, 4, 2, 8);
  g.fillRect(4, 7, 8, 2);
  // Box border
  g.fillStyle(0x999999);
  g.fillRect(2, 2, 12, 1);
  g.fillRect(2, 13, 12, 1);
  g.fillRect(2, 2, 1, 12);
  g.fillRect(13, 2, 1, 12);
  // Glow
  g.fillStyle(0xff4444, 0.25);
  g.fillCircle(8, 8, 6);
  finish(g, 'loot-health', sz, sz);

  // Weapon crate – blue
  g = gfx(scene);
  g.fillStyle(0x224488);
  g.fillRect(1, 3, 14, 10);
  g.fillStyle(0x3366aa);
  g.fillRect(2, 4, 12, 8);
  g.fillStyle(0x4477cc);
  g.fillRect(3, 5, 10, 4);
  // Gun icon
  g.fillStyle(0xaaccff);
  g.fillRect(4, 6, 8, 2);
  g.fillRect(4, 8, 3, 2);
  // Lock
  g.fillStyle(0xdddd44);
  g.fillRect(7, 3, 2, 2);
  // Glow
  g.fillStyle(0x4488ff, 0.3);
  g.fillCircle(8, 8, 6);
  finish(g, 'loot-weapon', sz, sz);

  // Material – gray ore chunk
  g = gfx(scene);
  // Rock base
  g.fillStyle(0x666666);
  g.fillRect(3, 6, 10, 8);
  g.fillRect(5, 4, 8, 10);
  // Rock highlight
  g.fillStyle(0x888888);
  g.fillRect(5, 6, 6, 6);
  g.fillStyle(0x999999);
  g.fillRect(6, 7, 3, 3);
  // Dark crevices
  g.fillStyle(0x444444);
  g.fillRect(4, 10, 2, 2);
  g.fillRect(10, 7, 2, 2);
  // Metal flecks
  g.fillStyle(0xbbbbbb);
  g.fillRect(7, 5, 1, 1);
  g.fillRect(5, 8, 1, 1);
  g.fillRect(9, 11, 1, 1);
  finish(g, 'loot-material', sz, sz);

  // Mineral – purple crystal
  g = gfx(scene);
  // Crystal base
  g.fillStyle(0x553388);
  g.fillRect(6, 8, 6, 6);
  // Main crystal shard (tall)
  g.fillStyle(0x7744bb);
  g.fillRect(6, 2, 4, 10);
  // Crystal highlight
  g.fillStyle(0x9966dd);
  g.fillRect(7, 3, 2, 7);
  // Bright edge
  g.fillStyle(0xbb88ff);
  g.fillRect(7, 4, 1, 4);
  // Side shards
  g.fillStyle(0x6633aa);
  g.fillRect(3, 6, 3, 6);
  g.fillRect(10, 5, 3, 7);
  // Side shard highlights
  g.fillStyle(0x8855cc);
  g.fillRect(4, 7, 1, 4);
  g.fillRect(11, 6, 1, 5);
  // Glow
  g.fillStyle(0xaa66ff, 0.35);
  g.fillCircle(8, 7, 5);
  // Tip sparkle
  g.fillStyle(0xddbbff);
  g.fillRect(7, 2, 1, 1);
  finish(g, 'loot-mineral', sz, sz);
}

// ─── Terrain Tiles ───────────────────────────────────────────────────────────

function generateTerrainTiles(scene: Phaser.Scene): void {
  const s = 32;

  // Grass
  let g = gfx(scene);
  g.fillStyle(0x3a7d2e);
  g.fillRect(0, 0, s, s);
  // Variation – lighter patches
  g.fillStyle(0x4a9d3e);
  g.fillRect(4, 2, 3, 3);
  g.fillRect(18, 8, 4, 3);
  g.fillRect(8, 20, 3, 4);
  g.fillRect(24, 24, 3, 3);
  g.fillRect(14, 14, 2, 2);
  // Darker patches
  g.fillStyle(0x2a6d1e);
  g.fillRect(10, 4, 3, 2);
  g.fillRect(26, 14, 2, 3);
  g.fillRect(2, 26, 4, 2);
  g.fillRect(20, 28, 3, 2);
  // Tiny grass blades
  g.fillStyle(0x55aa44);
  g.fillRect(6, 10, 1, 2);
  g.fillRect(14, 6, 1, 2);
  g.fillRect(22, 18, 1, 2);
  g.fillRect(28, 6, 1, 2);
  g.fillRect(12, 28, 1, 2);
  finish(g, 'tile-grass', s, s);

  // Dirt
  g = gfx(scene);
  g.fillStyle(0x8b6b3e);
  g.fillRect(0, 0, s, s);
  // Lighter patches
  g.fillStyle(0xa08050);
  g.fillRect(3, 3, 4, 3);
  g.fillRect(16, 10, 5, 3);
  g.fillRect(8, 22, 4, 4);
  g.fillRect(24, 20, 3, 3);
  // Darker patches
  g.fillStyle(0x6b5030);
  g.fillRect(12, 2, 3, 3);
  g.fillRect(26, 8, 3, 2);
  g.fillRect(4, 14, 4, 3);
  g.fillRect(20, 26, 4, 2);
  // Small pebbles
  g.fillStyle(0x7a6040);
  g.fillRect(7, 8, 2, 2);
  g.fillRect(22, 14, 2, 1);
  g.fillRect(14, 26, 1, 2);
  g.fillRect(28, 28, 2, 2);
  finish(g, 'tile-dirt', s, s);

  // Water
  g = gfx(scene);
  g.fillStyle(0x2266aa);
  g.fillRect(0, 0, s, s);
  // Wave ripples – lighter
  g.fillStyle(0x3377bb);
  g.fillRect(2, 4, 8, 2);
  g.fillRect(14, 12, 10, 2);
  g.fillRect(6, 22, 12, 2);
  g.fillRect(22, 28, 6, 2);
  // Highlights
  g.fillStyle(0x4488cc, 0.6);
  g.fillRect(4, 4, 4, 1);
  g.fillRect(16, 12, 6, 1);
  g.fillRect(8, 22, 8, 1);
  // Deep parts
  g.fillStyle(0x1a5599);
  g.fillRect(10, 8, 6, 3);
  g.fillRect(24, 16, 4, 3);
  g.fillRect(2, 16, 5, 4);
  // Sparkle
  g.fillStyle(0x88bbee);
  g.fillRect(6, 5, 1, 1);
  g.fillRect(20, 13, 1, 1);
  g.fillRect(12, 23, 1, 1);
  finish(g, 'tile-water', s, s);

  // Rock
  g = gfx(scene);
  g.fillStyle(0x666666);
  g.fillRect(0, 0, s, s);
  // Rock face variation
  g.fillStyle(0x777777);
  g.fillRect(2, 2, 10, 8);
  g.fillRect(16, 14, 12, 10);
  g.fillRect(4, 20, 8, 8);
  // Highlights
  g.fillStyle(0x888888);
  g.fillRect(3, 3, 6, 4);
  g.fillRect(18, 16, 8, 6);
  // Dark cracks
  g.fillStyle(0x444444);
  g.fillRect(12, 0, 1, 14);
  g.fillRect(0, 12, 16, 1);
  g.fillRect(14, 10, 1, 12);
  g.fillRect(20, 24, 10, 1);
  g.fillRect(28, 6, 1, 20);
  // Moss spots
  g.fillStyle(0x556644);
  g.fillRect(6, 10, 2, 2);
  g.fillRect(24, 12, 3, 2);
  finish(g, 'tile-rock', s, s);

  // Tree (top-down view)
  g = gfx(scene);
  // Canopy shadow on ground
  g.fillStyle(0x2a5520);
  g.fillEllipse(16, 18, 28, 26);
  // Main canopy
  g.fillStyle(0x2d7d1e);
  g.fillEllipse(16, 16, 26, 24);
  // Canopy layers
  g.fillStyle(0x3a9d2e);
  g.fillEllipse(14, 14, 18, 16);
  g.fillEllipse(20, 18, 14, 12);
  // Highlights
  g.fillStyle(0x4aad3e);
  g.fillEllipse(12, 12, 8, 8);
  g.fillEllipse(20, 10, 6, 6);
  // Light spots
  g.fillStyle(0x55bb44);
  g.fillRect(10, 10, 2, 2);
  g.fillRect(18, 8, 2, 2);
  g.fillRect(14, 14, 2, 2);
  // Trunk visible through canopy (center)
  g.fillStyle(0x5a3d1e);
  g.fillCircle(16, 16, 3);
  g.fillStyle(0x6a4d2e);
  g.fillCircle(16, 16, 2);
  finish(g, 'tile-tree', s, s);

  // Ore deposit
  g = gfx(scene);
  // Rock base
  g.fillStyle(0x5a5a5a);
  g.fillRect(0, 0, s, s);
  g.fillStyle(0x6a6a6a);
  g.fillRect(2, 2, 12, 10);
  g.fillRect(14, 16, 14, 12);
  g.fillRect(4, 18, 8, 10);
  // Dark cracks
  g.fillStyle(0x3a3a3a);
  g.fillRect(14, 0, 1, 16);
  g.fillRect(0, 14, 18, 1);
  // Ore spots – glowing blue/cyan
  g.fillStyle(0x22ccff);
  g.fillCircle(8, 8, 3);
  g.fillCircle(22, 22, 3);
  g.fillCircle(6, 24, 2);
  g.fillCircle(24, 10, 2);
  // Ore glow
  g.fillStyle(0x44ddff, 0.5);
  g.fillCircle(8, 8, 5);
  g.fillCircle(22, 22, 5);
  // Ore highlights
  g.fillStyle(0x88eeff);
  g.fillRect(7, 7, 1, 1);
  g.fillRect(21, 21, 1, 1);
  g.fillRect(5, 23, 1, 1);
  g.fillRect(23, 9, 1, 1);
  finish(g, 'tile-ore', s, s);
}

// ─── Effects ─────────────────────────────────────────────────────────────────

function generateEffects(scene: Phaser.Scene): void {
  // Muzzle flash – 16x16
  let g = gfx(scene);
  // Outer glow
  g.fillStyle(0xffaa00, 0.3);
  g.fillCircle(8, 8, 7);
  // Mid glow
  g.fillStyle(0xffcc44, 0.6);
  g.fillCircle(8, 8, 5);
  // Core
  g.fillStyle(0xffee88);
  g.fillCircle(8, 8, 3);
  // Center white-hot
  g.fillStyle(0xffffff);
  g.fillCircle(8, 8, 1.5);
  // Spikes
  g.fillStyle(0xffdd66, 0.7);
  g.fillRect(7, 1, 2, 4);
  g.fillRect(7, 11, 2, 4);
  g.fillRect(1, 7, 4, 2);
  g.fillRect(11, 7, 4, 2);
  finish(g, 'muzzle-flash', 16, 16);

  // Explosion – 32x32
  g = gfx(scene);
  // Outer fireball
  g.fillStyle(0x882200, 0.4);
  g.fillCircle(16, 16, 14);
  // Mid fire
  g.fillStyle(0xcc4400, 0.6);
  g.fillCircle(16, 16, 11);
  // Inner fire
  g.fillStyle(0xff6600);
  g.fillCircle(16, 16, 8);
  // Hot core
  g.fillStyle(0xffaa22);
  g.fillCircle(16, 16, 5);
  // White-hot center
  g.fillStyle(0xffdd66);
  g.fillCircle(16, 16, 3);
  g.fillStyle(0xffffaa);
  g.fillCircle(16, 16, 1.5);
  // Fire tendrils
  g.fillStyle(0xff4400, 0.7);
  g.fillRect(14, 2, 4, 6);
  g.fillRect(14, 24, 4, 6);
  g.fillRect(2, 14, 6, 4);
  g.fillRect(24, 14, 6, 4);
  // Diagonal sparks
  g.fillStyle(0xffaa00, 0.5);
  g.fillRect(4, 4, 4, 4);
  g.fillRect(24, 4, 4, 4);
  g.fillRect(4, 24, 4, 4);
  g.fillRect(24, 24, 4, 4);
  // Smoke edges
  g.fillStyle(0x444444, 0.3);
  g.fillCircle(8, 6, 4);
  g.fillCircle(24, 8, 3);
  g.fillCircle(6, 22, 3);
  finish(g, 'explosion', 32, 32);

  // Particle – tiny 4x4 white dot
  g = gfx(scene);
  g.fillStyle(0xffffff);
  g.fillCircle(2, 2, 2);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(2, 2, 1);
  finish(g, 'particle', 4, 4);
}

// ─── HUD Elements ────────────────────────────────────────────────────────────

function generateHUDElements(scene: Phaser.Scene): void {
  // Minimap player – bright green dot 4x4
  let g = gfx(scene);
  g.fillStyle(0x00ff44);
  g.fillCircle(2, 2, 2);
  g.fillStyle(0x88ffaa);
  g.fillRect(1, 1, 1, 1);
  finish(g, 'minimap-player', 4, 4);

  // Minimap enemy – red dot 4x4
  g = gfx(scene);
  g.fillStyle(0xff2222);
  g.fillCircle(2, 2, 2);
  g.fillStyle(0xff6666);
  g.fillRect(1, 1, 1, 1);
  finish(g, 'minimap-enemy', 4, 4);

  // Minimap rover – blue dot 6x6
  g = gfx(scene);
  g.fillStyle(0x2266ff);
  g.fillCircle(3, 3, 3);
  g.fillStyle(0x4488ff);
  g.fillCircle(2, 2, 1.5);
  finish(g, 'minimap-rover', 6, 6);

  // Crosshair – 32x32 with transparent center
  g = gfx(scene);
  const cx = 16;
  const cy = 16;
  // Outer ring (subtle)
  g.lineStyle(1, 0xffffff, 0.3);
  g.strokeCircle(cx, cy, 10);
  // Cross lines – with gap in center
  g.fillStyle(0xffffff, 0.9);
  // Top
  g.fillRect(15, 2, 2, 8);
  // Bottom
  g.fillRect(15, 22, 2, 8);
  // Left
  g.fillRect(2, 15, 8, 2);
  // Right
  g.fillRect(22, 15, 8, 2);
  // Center dot
  g.fillStyle(0xff3333, 0.8);
  g.fillCircle(cx, cy, 1);
  // Line end caps (thicker parts)
  g.fillStyle(0xffffff, 0.7);
  g.fillRect(14, 3, 4, 2);
  g.fillRect(14, 27, 4, 2);
  g.fillRect(3, 14, 2, 4);
  g.fillRect(27, 14, 2, 4);
  finish(g, 'crosshair', 32, 32);
}
