import Phaser from 'phaser';
import { TILE_SIZE } from '../config/GameConfig';

/**
 * Periodically spawns resource crates near the player.
 * Crates grant ore or energy when the player walks over them.
 */
export class ResourceCrateSpawner {
  private scene: Phaser.Scene;
  private crates: Phaser.Physics.Arcade.Group;
  private spawnTimer: number = 0;
  private spawnInterval: number = 30000; // every 30 seconds
  private maxCrates: number = 5;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.crates = scene.physics.add.group();

    // Generate the crate texture if it doesn't already exist
    if (!scene.textures.exists('resource-crate')) {
      this.generateCrateTexture();
    }
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Call every frame. Handles spawn timing and crate animations.
   */
  update(time: number, delta: number, playerX: number, playerY: number): void {
    this.spawnTimer += delta;

    if (this.spawnTimer >= this.spawnInterval && this.crates.countActive(true) < this.maxCrates) {
      this.spawnTimer = 0;
      const pos = this.pickSpawnPosition(playerX, playerY);
      if (pos) {
        this.spawnCrate(pos.x, pos.y);
      }
    }

    // Bob animation for all active crates
    this.crates.getChildren().forEach((child) => {
      const crate = child as Phaser.Physics.Arcade.Sprite;
      if (crate.active) {
        // Store the base Y in data on first encounter
        if (crate.getData('baseY') === undefined) {
          crate.setData('baseY', crate.y);
        }
        const baseY = crate.getData('baseY') as number;
        crate.y = baseY + Math.sin(time * 0.004) * 3;
      }
    });
  }

  /**
   * Returns the crate group so the scene can set up overlap/collision with the player.
   */
  getCrates(): Phaser.Physics.Arcade.Group {
    return this.crates;
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Spawn a single resource crate at the given world position.
   */
  private spawnCrate(x: number, y: number): void {
    const crate = this.crates.create(x, y, 'resource-crate') as Phaser.Physics.Arcade.Sprite;
    crate.setDepth(5);
    crate.setData('baseY', y);

    // 50/50 chance: ore or energy
    if (Math.random() < 0.5) {
      crate.setData('resourceType', 'ore');
      crate.setData('amount', Phaser.Math.Between(30, 60));
    } else {
      crate.setData('resourceType', 'energy');
      crate.setData('amount', Phaser.Math.Between(15, 30));
    }

    // Fade-in effect
    crate.setAlpha(0);
    this.scene.tweens.add({
      targets: crate,
      alpha: 1,
      duration: 400,
      ease: 'Cubic.easeOut',
    });
  }

  /**
   * Pick a random position 200–400 px from the player that isn't on
   * water, rock, or tree tiles.
   */
  private pickSpawnPosition(
    playerX: number,
    playerY: number,
  ): { x: number; y: number } | null {
    const world = (this.scene as any).world as
      | { getTileAt(x: number, y: number): string }
      | undefined;

    const blockedTypes = new Set(['water', 'rock', 'tree']);

    for (let attempt = 0; attempt < 10; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 200 + Math.random() * 200; // 200–400 px
      const x = playerX + Math.cos(angle) * distance;
      const y = playerY + Math.sin(angle) * distance;

      // Check tile type if the world generator is accessible
      if (world && typeof world.getTileAt === 'function') {
        const tile = world.getTileAt(x, y);
        if (blockedTypes.has(tile)) continue;
      }

      return { x, y };
    }

    // Fallback — couldn't find a clear spot after 10 tries
    return null;
  }

  /**
   * Generate a golden crate texture with a subtle glow.
   */
  private generateCrateTexture(): void {
    const size = 20;
    const gfx = this.scene.add.graphics();

    // Outer glow
    gfx.fillStyle(0xffdd44, 0.25);
    gfx.fillRect(-2, -2, size + 4, size + 4);

    // Main body — golden yellow
    gfx.fillStyle(0xf0c020, 1);
    gfx.fillRect(0, 0, size, size);

    // Highlight top edge
    gfx.fillStyle(0xffe577, 1);
    gfx.fillRect(0, 0, size, 3);

    // Shadow bottom edge
    gfx.fillStyle(0xb8880e, 1);
    gfx.fillRect(0, size - 3, size, 3);

    // Cross detail (crate straps)
    gfx.fillStyle(0x8b6914, 1);
    gfx.fillRect(size / 2 - 1, 0, 2, size);
    gfx.fillRect(0, size / 2 - 1, size, 2);

    gfx.generateTexture('resource-crate', size + 4, size + 4);
    gfx.destroy();
  }
}
