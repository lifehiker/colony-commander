import Phaser from 'phaser';
import { WEAPONS } from '../config/GameConfig';

/** Max distance (px) a bullet can travel before being recycled. */
const MAX_BULLET_RANGE = 800;

/** Number of pellets in a shotgun blast. */
const SHOTGUN_PELLET_COUNT = 5;

/**
 * Manages projectile creation, pooling, fire-rate limiting, and cleanup.
 */
export class WeaponSystem {
  private scene: Phaser.Scene;
  private bullets: Phaser.Physics.Arcade.Group;

  /** Tracks last-fire time per owner key so each entity has its own cooldown. */
  private lastFired: Map<string, number> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Object-pooled bullet group
    this.bullets = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 200,
      runChildUpdate: false,
      allowGravity: false,
    });
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Attempt to fire a weapon.
   * Returns `true` if a shot was actually produced (passed fire-rate check).
   */
  fire(
    x: number,
    y: number,
    angle: number,
    weaponType: string,
    owner: 'player' | 'enemy',
  ): boolean {
    const config = WEAPONS[weaponType];
    if (!config) return false;

    // ── Fire-rate limiting ────────────────────────────────────
    const cooldownMs = 1000 / config.fireRate;
    const now = this.scene.time.now;
    const ownerKey = `${owner}_${weaponType}`;
    const last = this.lastFired.get(ownerKey) ?? 0;
    if (now - last < cooldownMs) return false;
    this.lastFired.set(ownerKey, now);

    // ── Spawn projectiles ────────────────────────────────────
    if (weaponType === 'shotgun') {
      this.fireShotgun(x, y, angle, config, owner);
    } else {
      this.fireSingle(x, y, angle, config, weaponType, owner);
    }

    // ── Muzzle flash ─────────────────────────────────────────
    this.muzzleFlash(x, y, angle);

    return true;
  }

  /** Returns the bullet group so scenes can set up overlap/collider. */
  getBullets(): Phaser.Physics.Arcade.Group {
    return this.bullets;
  }

  /** Call every frame – recycles bullets that exceeded max range or left world. */
  update(): void {
    this.bullets.getChildren().forEach((obj) => {
      const bullet = obj as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return;

      const data = bullet.getData('meta') as BulletMeta | undefined;
      if (!data) return;

      const dist = Phaser.Math.Distance.Between(data.originX, data.originY, bullet.x, bullet.y);
      if (dist >= MAX_BULLET_RANGE || !this.isInWorldBounds(bullet)) {
        this.recycleBullet(bullet);
      }
    });
  }

  // ── Internals ────────────────────────────────────────────────

  private fireSingle(
    x: number,
    y: number,
    angle: number,
    config: typeof WEAPONS[string],
    weaponType: string,
    owner: 'player' | 'enemy',
  ): void {
    const spreadRad = Phaser.Math.DegToRad(config.spread);
    const finalAngle = angle + Phaser.Math.FloatBetween(-spreadRad, spreadRad);
    this.spawnBullet(x, y, finalAngle, config.projectileSpeed, config.damage, weaponType, owner);
  }

  private fireShotgun(
    x: number,
    y: number,
    angle: number,
    config: typeof WEAPONS[string],
    owner: 'player' | 'enemy',
  ): void {
    const spreadRad = Phaser.Math.DegToRad(config.spread);
    const halfSpread = spreadRad;

    for (let i = 0; i < SHOTGUN_PELLET_COUNT; i++) {
      // Evenly distribute pellets across the spread cone, with a touch of randomness
      const pelletCount = SHOTGUN_PELLET_COUNT as number;
      const t = pelletCount === 1 ? 0 : (i / (pelletCount - 1)) * 2 - 1; // -1..1
      const pelletAngle =
        angle + t * halfSpread + Phaser.Math.FloatBetween(-spreadRad * 0.15, spreadRad * 0.15);

      // Per-pellet speed varies slightly for a natural feel
      const speedVariance = Phaser.Math.FloatBetween(0.9, 1.1);

      this.spawnBullet(
        x,
        y,
        pelletAngle,
        config.projectileSpeed * speedVariance,
        config.damage,
        'shotgun',
        owner,
      );
    }
  }

  private spawnBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    weaponType: string,
    owner: 'player' | 'enemy',
  ): void {
    const textureKey = `bullet-${weaponType}`;
    const bullet = this.bullets.get(x, y, textureKey) as Phaser.Physics.Arcade.Image | null;

    if (!bullet) return; // pool exhausted

    bullet.setActive(true).setVisible(true);
    bullet.setPosition(x, y);
    bullet.setRotation(angle);
    bullet.setDepth(9);

    // Store metadata for collision handlers & range check
    const meta: BulletMeta = { damage, owner, originX: x, originY: y };
    bullet.setData('meta', meta);

    // Physics
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);
    this.scene.physics.velocityFromRotation(angle, speed, body.velocity);
  }

  /** Brief white circle at the muzzle position. */
  private muzzleFlash(x: number, y: number, angle: number): void {
    const offsetDist = 16; // pixels in front of the shooter
    const fx = x + Math.cos(angle) * offsetDist;
    const fy = y + Math.sin(angle) * offsetDist;

    const flash = this.scene.add.circle(fx, fy, 6, 0xffffaa, 1).setDepth(11);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 80,
      onComplete: () => flash.destroy(),
    });
  }

  private recycleBullet(bullet: Phaser.Physics.Arcade.Image): void {
    bullet.setActive(false).setVisible(false);
    (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
  }

  private isInWorldBounds(obj: Phaser.GameObjects.GameObject & { x: number; y: number }): boolean {
    const bounds = this.scene.physics.world.bounds;
    return (
      obj.x >= bounds.x &&
      obj.x <= bounds.x + bounds.width &&
      obj.y >= bounds.y &&
      obj.y <= bounds.y + bounds.height
    );
  }
}

// ── Types ────────────────────────────────────────────────────────

export interface BulletMeta {
  damage: number;
  owner: 'player' | 'enemy';
  originX: number;
  originY: number;
}
