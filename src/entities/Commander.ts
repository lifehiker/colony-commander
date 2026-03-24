import Phaser from 'phaser';
import {
  COMMANDER_SPEED,
  COMMANDER_SPRINT_SPEED,
  COMMANDER_HEALTH,
  WEAPONS,
} from '../config/GameConfig';
import { WeaponSystem } from '../systems/WeaponSystem';

export class Commander extends Phaser.Physics.Arcade.Sprite {
  // ── Health / Stats ───────────────────────────────────────────
  health: number;
  maxHealth: number;
  speed: number;
  sprintSpeed: number;
  isSprinting: boolean = false;

  // ── Progression ──────────────────────────────────────────────
  xp: number = 0;
  level: number = 1;
  score: number = 0;

  // ── Vehicle ──────────────────────────────────────────────────
  isInVehicle: boolean = false;

  // ── Weapons / Ammo ───────────────────────────────────────────
  currentWeapon: string = 'pistol';
  ammo: Record<string, number> = {
    pistol: 50,
    rifle: 30,
    shotgun: 12,
  };
  private weaponSystem!: WeaponSystem;

  // ── Input ────────────────────────────────────────────────────
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    E: Phaser.Input.Keyboard.Key;
    ONE: Phaser.Input.Keyboard.Key;
    TWO: Phaser.Input.Keyboard.Key;
    THREE: Phaser.Input.Keyboard.Key;
  };

  // ── Direction / Animation ──────────────────────────────────
  /** Current facing direction — readable by other systems */
  currentDirection: string = 'down';
  private isShooting: boolean = false;
  private aimAngle: number = 0;

  // ── Internal state ───────────────────────────────────────────
  private isDead: boolean = false;
  private spawnX: number;
  private spawnY: number;
  private damageFlashTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Use the sprite sheet if available, fall back to programmatic texture
    const textureKey = scene.textures.exists('commander-sheet')
      ? 'commander-sheet'
      : 'commander';
    super(scene, x, y, textureKey);

    this.spawnX = x;
    this.spawnY = y;

    // Stats from config
    this.maxHealth = COMMANDER_HEALTH;
    this.health = this.maxHealth;
    this.speed = COMMANDER_SPEED;
    this.sprintSpeed = COMMANDER_SPRINT_SPEED;

    // Add to scene + physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Forgiving collision body – slightly smaller than sprite
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.7, this.height * 0.7);
    body.setOffset(this.width * 0.15, this.height * 0.15);
    body.setCollideWorldBounds(true);

    // Depth so commander renders above terrain
    this.setDepth(10);

    this.setupInput();
    this.setupMouseInput();

    // Start with idle-down animation if using sprite sheet
    if (textureKey === 'commander-sheet') {
      this.play('commander-idle-down');
    }
  }

  // ── Input Binding ────────────────────────────────────────────

  private setupInput(): void {
    const kb = this.scene.input.keyboard!;

    this.cursors = kb.createCursorKeys();

    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SHIFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      E: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      ONE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      TWO: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      THREE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    };
  }

  private setupMouseInput(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.isDead) {
        // Don't shoot while in build mode
        const buildingManager = (this.scene as any).buildingManager;
        if (buildingManager?.isBuildModeActive?.()) return;
        this.shoot();
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────

  /** Must be called after WeaponSystem is created in the scene */
  setWeaponSystem(ws: WeaponSystem): void {
    this.weaponSystem = ws;
  }

  // ── Update Loop ──────────────────────────────────────────────

  update(_time: number, _delta: number): void {
    if (this.isDead || this.isInVehicle) return;

    this.handleMovement();
    this.handleWeaponSwitch();
    this.aimAtPointer();
    this.updateAnimation();
  }

  // ── Movement ─────────────────────────────────────────────────

  private handleMovement(): void {
    let vx = 0;
    let vy = 0;

    // WASD + arrow keys
    if (this.wasd.A.isDown || this.cursors.left.isDown) vx -= 1;
    if (this.wasd.D.isDown || this.cursors.right.isDown) vx += 1;
    if (this.wasd.W.isDown || this.cursors.up.isDown) vy -= 1;
    if (this.wasd.S.isDown || this.cursors.down.isDown) vy += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len > 0) {
      vx /= len;
      vy /= len;
    }

    // Sprint
    this.isSprinting = this.wasd.SHIFT.isDown && len > 0;
    const currentSpeed = this.isSprinting ? this.sprintSpeed : this.speed;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(vx * currentSpeed, vy * currentSpeed);
  }

  private handleWeaponSwitch(): void {
    // Skip weapon switching when build mode is active (1-6 are used for building selection)
    const buildingManager = (this.scene as any).buildingManager;
    if (buildingManager?.isBuildModeActive?.()) return;

    if (Phaser.Input.Keyboard.JustDown(this.wasd.ONE)) {
      this.switchWeapon('pistol');
    } else if (Phaser.Input.Keyboard.JustDown(this.wasd.TWO)) {
      this.switchWeapon('rifle');
    } else if (Phaser.Input.Keyboard.JustDown(this.wasd.THREE)) {
      this.switchWeapon('shotgun');
    }
  }

  // ── Aiming ───────────────────────────────────────────────────

  aimAtPointer(): void {
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.aimAngle = Phaser.Math.Angle.Between(this.x, this.y, worldPoint.x, worldPoint.y);
    // No longer rotating the sprite — direction is shown via animation frames
  }

  // ── Direction Helpers ──────────────────────────────────────────

  /**
   * Converts a radian angle to one of 8 direction names.
   * Used to select the correct animation row/column.
   */
  private getDirectionFromAngle(angle: number): string {
    // Normalize angle to 0-360
    const deg = ((Phaser.Math.RadToDeg(angle) % 360) + 360) % 360;

    // 8 directions, each covering 45 degrees
    if (deg >= 337.5 || deg < 22.5) return 'right';
    if (deg >= 22.5 && deg < 67.5) return 'down-right';
    if (deg >= 67.5 && deg < 112.5) return 'down';
    if (deg >= 112.5 && deg < 157.5) return 'down-left';
    if (deg >= 157.5 && deg < 202.5) return 'left';
    if (deg >= 202.5 && deg < 247.5) return 'up-left';
    if (deg >= 247.5 && deg < 292.5) return 'up';
    return 'up-right'; // 292.5 to 337.5
  }

  // ── Animation ──────────────────────────────────────────────────

  /**
   * Picks the correct directional animation each frame.
   *  - Shooting: face aim (mouse) direction, play shoot anim
   *  - Moving:   face movement direction, play walk/sprint anim
   *  - Idle:     face last known direction, play idle anim
   */
  private updateAnimation(): void {
    // Skip if using the fallback programmatic texture (no sheet animations)
    if (this.texture.key !== 'commander-sheet') return;

    // If a shoot animation is currently playing, let it finish
    if (this.isShooting) {
      if (this.anims.isPlaying && this.anims.currentAnim?.key.startsWith('commander-shoot-')) {
        return;
      }
      // Shoot animation finished
      this.isShooting = false;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const isMoving = body.velocity.length() > 0;

    if (isMoving) {
      // Determine direction from movement velocity
      const moveAngle = Math.atan2(body.velocity.y, body.velocity.x);
      this.currentDirection = this.getDirectionFromAngle(moveAngle);

      const animKey = this.isSprinting
        ? `commander-sprint-${this.currentDirection}`
        : `commander-walk-${this.currentDirection}`;

      if (this.anims.currentAnim?.key !== animKey) {
        this.play(animKey);
      }
    } else {
      // Idle — face the mouse direction when standing still
      this.currentDirection = this.getDirectionFromAngle(this.aimAngle);

      const animKey = `commander-idle-${this.currentDirection}`;
      if (this.anims.currentAnim?.key !== animKey) {
        this.play(animKey);
      }
    }
  }

  // ── Shooting ─────────────────────────────────────────────────

  shoot(): void {
    if (!this.weaponSystem) return;
    if (this.ammo[this.currentWeapon] <= 0) return;

    const fired = this.weaponSystem.fire(
      this.x,
      this.y,
      this.aimAngle,
      this.currentWeapon,
      'player',
    );

    if (fired) {
      this.ammo[this.currentWeapon]--;

      // Play shoot animation facing the aim direction
      if (this.texture.key === 'commander-sheet') {
        const aimDir = this.getDirectionFromAngle(this.aimAngle);
        this.currentDirection = aimDir;
        this.isShooting = true;
        this.play(`commander-shoot-${aimDir}`);
      }
    }
  }

  // ── Damage / Death ───────────────────────────────────────────

  takeDamage(amount: number): void {
    if (this.isDead) return;

    this.health = Math.max(0, this.health - amount);

    // Flash red
    this.setTint(0xff0000);
    if (this.damageFlashTimer) this.damageFlashTimer.destroy();
    this.damageFlashTimer = this.scene.time.delayedCall(100, () => {
      if (!this.isDead) this.clearTint();
    });

    if (this.health <= 0) {
      this.die();
    }
  }

  die(): void {
    if (this.isDead) return;
    this.isDead = true;

    // Stop any current animation and play death
    if (this.texture.key === 'commander-sheet') {
      this.play('commander-death');
    }

    // Visual feedback
    this.setTint(0xff0000);
    this.setAlpha(0.5);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;

    // Respawn after 2 seconds
    this.scene.time.delayedCall(2000, () => {
      this.respawn();
    });
  }

  private respawn(): void {
    this.isDead = false;
    this.isShooting = false;
    this.health = this.maxHealth;
    this.setPosition(this.spawnX, this.spawnY);
    this.clearTint();
    this.setAlpha(1);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;

    // Reset to idle animation
    if (this.texture.key === 'commander-sheet') {
      this.currentDirection = 'down';
      this.play('commander-idle-down');
    }
  }

  // ── Weapons ──────────────────────────────────────────────────

  switchWeapon(weapon: string): void {
    if (!WEAPONS[weapon]) return;
    this.currentWeapon = weapon;
  }

  // ── Progression ──────────────────────────────────────────────

  addXP(amount: number): void {
    this.xp += amount;

    // Level up every 100 XP
    const newLevel = Math.floor(this.xp / 100) + 1;
    while (this.level < newLevel) {
      this.level++;
      this.maxHealth += 5;
      this.health = Math.min(this.health + 5, this.maxHealth);
    }
  }

  addScore(amount: number): void {
    this.score += amount;
  }

  // ── Loot ─────────────────────────────────────────────────────

  pickupLoot(type: string, amount: number): void {
    switch (type) {
      case 'ammo':
        // Distribute evenly or to current weapon
        this.ammo[this.currentWeapon] = (this.ammo[this.currentWeapon] || 0) + amount;
        break;
      case 'health_pack':
        this.health = Math.min(this.health + amount, this.maxHealth);
        break;
      default:
        // Other loot types handled by inventory/scene
        break;
    }
  }
}
