import Phaser from 'phaser';
import { Building } from './Building';
import type { Enemy } from './Enemy';
import type { ResourceManager } from '../systems/ResourceManager';

/**
 * Automated defense turret that extends Building.
 *
 * After construction is complete, scans for nearby enemies and fires
 * simple projectiles at the closest one within range.
 */
export class Turret extends Building {
  range: number = 200;
  damage: number = 10;
  fireRate: number = 2; // shots per second
  lastFired: number = 0;
  target: Enemy | null = null;
  barrel: Phaser.GameObjects.Graphics;

  /** Turret bullet group — shared across all turrets (set by BuildingManager). */
  private bullets: Phaser.Physics.Arcade.Group | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'turret');

    // Rotating barrel drawn on top
    this.barrel = scene.add.graphics();
    this.barrel.setDepth(7);
    this.drawBarrel(0);
  }

  /** Inject the shared bullet group so turrets can spawn projectiles. */
  setBulletGroup(group: Phaser.Physics.Arcade.Group): void {
    this.bullets = group;
  }

  // ── Update Loop ──────────────────────────────────────────────

  updateTurret(
    time: number,
    delta: number,
    enemies: Phaser.Physics.Arcade.Group,
    resourceManager?: ResourceManager,
    commanderX?: number,
    commanderY?: number,
  ): void {
    // Run base building update (construction / production)
    super.update(time, delta, resourceManager, commanderX, commanderY);

    if (!this.active) return;

    // Don't fire while still under construction
    if (this.isConstructing) return;

    // Acquire target
    this.acquireTarget(enemies);

    if (this.target) {
      // Rotate barrel toward target
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
      this.drawBarrel(angle);

      // Fire at fire rate
      const cooldownMs = 1000 / this.fireRate;
      if (time - this.lastFired >= cooldownMs) {
        this.fire(angle);
        this.lastFired = time;
      }
    }
  }

  // ── Target Acquisition ────────────────────────────────────────

  acquireTarget(enemies: Phaser.Physics.Arcade.Group): void {
    let closestDist = this.range;
    let closest: Enemy | null = null;

    enemies.getChildren().forEach((obj) => {
      const enemy = obj as Enemy;
      if (!enemy.active || enemy.state === 'dead') return;

      const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    });

    this.target = closest;
  }

  // ── Firing ────────────────────────────────────────────────────

  fire(angle: number): void {
    if (!this.bullets) return;

    // Generate turret bullet texture once
    if (!this.scene.textures.exists('bullet-turret')) {
      const g = this.scene.add.graphics();
      g.fillStyle(0xff4444);
      g.fillCircle(3, 3, 3);
      g.fillStyle(0xffaa88);
      g.fillCircle(2, 2, 1.5);
      g.generateTexture('bullet-turret', 6, 6);
      g.destroy();
    }

    const bullet = this.bullets.get(this.x, this.y, 'bullet-turret') as Phaser.Physics.Arcade.Image | null;
    if (!bullet) return;

    bullet.setActive(true).setVisible(true);
    bullet.setPosition(this.x, this.y);
    bullet.setRotation(angle);
    bullet.setDepth(9);

    // Store metadata for collision handler
    bullet.setData('meta', {
      damage: this.damage,
      owner: 'turret' as const,
      originX: this.x,
      originY: this.y,
    });

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(this.x, this.y);
    this.scene.physics.velocityFromRotation(angle, 500, body.velocity);

    // Store origin for distance-based cleanup (no timer — avoids stale callback bug)
    bullet.setData('originX', this.x);
    bullet.setData('originY', this.y);
    bullet.setData('maxRange', this.range + 50);

    // Muzzle flash
    const fx = this.x + Math.cos(angle) * 16;
    const fy = this.y + Math.sin(angle) * 16;
    const flash = this.scene.add.circle(fx, fy, 4, 0xff6644, 1).setDepth(11);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 60,
      onComplete: () => flash.destroy(),
    });
  }

  // ── Barrel Drawing ────────────────────────────────────────────

  private drawBarrel(angle: number): void {
    const g = this.barrel;
    g.clear();

    // Base circle
    g.fillStyle(0x666666);
    g.fillCircle(this.x, this.y, 10);
    g.fillStyle(0x888888);
    g.fillCircle(this.x, this.y, 6);

    // Barrel line pointing toward angle
    const barrelLen = 16;
    const endX = this.x + Math.cos(angle) * barrelLen;
    const endY = this.y + Math.sin(angle) * barrelLen;

    g.lineStyle(4, 0x555555);
    g.lineBetween(this.x, this.y, endX, endY);
    g.lineStyle(2, 0x777777);
    g.lineBetween(this.x, this.y, endX, endY);
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    if (this.barrel) {
      this.barrel.destroy();
    }
    super.destroy(fromScene);
  }
}
