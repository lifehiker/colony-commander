import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { TILE_SIZE } from '../config/GameConfig';

export class EnemySpawner {
  private scene: Phaser.Scene;
  private enemies: Phaser.Physics.Arcade.Group;
  private maxEnemies: number;
  private spawnTimer: number;
  private nextSpawnDelay: number;

  constructor(scene: Phaser.Scene, maxEnemies: number = 15) {
    this.scene = scene;
    this.maxEnemies = maxEnemies;
    this.spawnTimer = 0;
    this.nextSpawnDelay = this.randomSpawnDelay();

    this.enemies = scene.physics.add.group({
      classType: Enemy,
      runChildUpdate: false, // we call update manually to pass player pos
    });
  }

  // -------------------------------------------------------------------
  // Main update — call from scene.update()
  // -------------------------------------------------------------------
  update(time: number, delta: number, playerX: number, playerY: number): void {
    this.spawnTimer += delta;

    // Adjust spawn rate when population is low
    const currentDelay =
      this.enemies.countActive(true) < 5
        ? Math.min(this.nextSpawnDelay, Phaser.Math.Between(1000, 2000))
        : this.nextSpawnDelay;

    if (this.spawnTimer >= currentDelay && this.enemies.countActive(true) < this.maxEnemies) {
      this.spawnAroundPlayer(playerX, playerY);
      this.spawnTimer = 0;
      this.nextSpawnDelay = this.randomSpawnDelay();
    }

    // Tick each enemy's AI
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (enemy.active) {
        enemy.update(time, delta, playerX, playerY);
      }
    });

    this.cleanup();
  }

  // -------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------
  getEnemies(): Phaser.Physics.Arcade.Group {
    return this.enemies;
  }

  spawnEnemy(x: number, y: number, type: string): Enemy {
    const enemy = new Enemy(this.scene, x, y, type);
    this.enemies.add(enemy);

    // Wire up death handler: drop loot and emit XP event
    enemy.once('enemy-died', (e: Enemy) => {
      e.dropLoot();
      this.scene.events.emit('enemy-killed', e);
    });

    return enemy;
  }

  cleanup(): void {
    const toRemove: Enemy[] = [];
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy;
      if (!enemy.active) {
        toRemove.push(enemy);
      }
    });
    for (const enemy of toRemove) {
      this.enemies.remove(enemy, true, true);
    }
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------
  private spawnAroundPlayer(playerX: number, playerY: number): void {
    const type = this.pickEnemyType();

    // Random position 400-600 px from player (outside camera)
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(400, 600);
    const x = playerX + Math.cos(angle) * dist;
    const y = playerY + Math.sin(angle) * dist;

    // Basic collision-tile check — skip spawning on water/rock tiles
    // If the scene has a tilemap layer called 'collision', verify the tile is clear
    if (!this.isSpawnLocationValid(x, y)) {
      // Try once more at a different angle rather than skipping entirely
      const retryAngle = angle + Math.PI * 0.5;
      const rx = playerX + Math.cos(retryAngle) * dist;
      const ry = playerY + Math.sin(retryAngle) * dist;
      if (this.isSpawnLocationValid(rx, ry)) {
        this.spawnEnemy(rx, ry, type);
      }
      return;
    }

    this.spawnEnemy(x, y, type);
  }

  private isSpawnLocationValid(x: number, y: number): boolean {
    // If the scene exposes a collision tilemap layer, check it
    const collisionLayer = (this.scene as any).collisionLayer as
      | Phaser.Tilemaps.TilemapLayer
      | undefined;
    if (collisionLayer) {
      const tile = collisionLayer.getTileAtWorldXY(x, y);
      if (tile && tile.index !== -1) {
        return false; // occupied collision tile
      }
    }
    return true;
  }

  /**
   * Pick enemy type according to distribution:
   * 60% basicAlien, 25% spitter, 15% brute
   */
  private pickEnemyType(): string {
    const roll = Math.random();
    if (roll < 0.60) return 'basicAlien';
    if (roll < 0.85) return 'spitter';
    return 'brute';
  }

  private randomSpawnDelay(): number {
    return Phaser.Math.Between(3000, 5000);
  }
}
