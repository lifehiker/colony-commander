import Phaser from 'phaser';
import { ENEMIES, type EnemyConfig } from '../config/GameConfig';

type EnemyState = 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  detectionRange: number;
  enemyType: string;
  state: EnemyState;
  xpReward: number;

  healthBar: Phaser.GameObjects.Graphics;

  private stateTimer: number = 0;
  private attackCooldown: number = 0;
  private patrolTarget: Phaser.Math.Vector2 | null = null;
  private hasBeenDamaged: boolean = false;
  private isDying: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, type: string) {
    // Determine texture key based on enemy type
    const textureKey = `enemy-${type}`;

    // Generate placeholder texture if it doesn't exist
    if (!scene.textures.exists(textureKey)) {
      Enemy.generateTexture(scene, type, textureKey);
    }

    // Generate enemy bullet texture if it doesn't exist (for spitters)
    if (!scene.textures.exists('bullet-enemy')) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0x44ff44, 1);
      gfx.fillCircle(3, 3, 3);
      gfx.generateTexture('bullet-enemy', 6, 6);
      gfx.destroy();
    }

    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const config: EnemyConfig = ENEMIES[type] ?? ENEMIES.basicAlien;

    this.enemyType = type;
    this.maxHealth = config.health;
    this.health = config.health;
    this.speed = config.speed;
    this.damage = config.damage;
    this.detectionRange = config.detectionRange;
    this.state = 'idle';
    this.stateTimer = Phaser.Math.Between(2000, 4000);

    // XP reward scales with difficulty
    this.xpReward = type === 'brute' ? 50 : type === 'spitter' ? 30 : 15;

    // Set up physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCollideWorldBounds(false);
      const halfSize = type === 'brute' ? 12 : 8;
      body.setSize(halfSize * 2, halfSize * 2);
      body.setOffset(this.width / 2 - halfSize, this.height / 2 - halfSize);
    }

    // Render above terrain (grass=0, trees=1)
    this.setDepth(6);

    // Health bar graphics
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(10);
  }

  // -------------------------------------------------------------------
  // Texture generation (coloured placeholder sprites per type)
  // -------------------------------------------------------------------
  private static generateTexture(
    scene: Phaser.Scene,
    type: string,
    key: string,
  ): void {
    const gfx = scene.add.graphics();
    const size = type === 'brute' ? 28 : 20;

    let colour: number;
    switch (type) {
      case 'spitter':
        colour = 0x44cc44; // green
        break;
      case 'brute':
        colour = 0xcc4444; // red
        break;
      default:
        colour = 0x8844cc; // purple (basic alien)
    }

    gfx.fillStyle(colour, 1);
    gfx.fillCircle(size / 2, size / 2, size / 2);

    // Eyes
    gfx.fillStyle(0xffffff, 1);
    const eyeOffset = size * 0.18;
    gfx.fillCircle(size / 2 - eyeOffset, size / 2 - eyeOffset, 2);
    gfx.fillCircle(size / 2 + eyeOffset, size / 2 - eyeOffset, 2);

    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  // -------------------------------------------------------------------
  // Main update — called every frame by the spawner / scene
  // -------------------------------------------------------------------
  update(time: number, delta: number, playerX: number, playerY: number): void {
    if (this.isDying || this.state === 'dead') return;

    // Reduce cooldowns
    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);

    switch (this.state) {
      case 'idle':
        this.handleIdle(delta, distToPlayer);
        break;
      case 'patrol':
        this.handlePatrol(delta, distToPlayer, playerX, playerY);
        break;
      case 'chase':
        this.handleChase(delta, distToPlayer, playerX, playerY);
        break;
      case 'attack':
        this.handleAttack(delta, distToPlayer, playerX, playerY);
        break;
    }

    this.drawHealthBar();
  }

  // -------------------------------------------------------------------
  // State handlers
  // -------------------------------------------------------------------
  private handleIdle(delta: number, distToPlayer: number): void {
    this.setVelocity(0, 0);

    // Occasionally rotate to "look around"
    if (Math.random() < 0.01) {
      this.setAngle(Phaser.Math.Between(0, 360));
    }

    this.stateTimer -= delta;
    if (this.stateTimer <= 0) {
      this.transitionTo('patrol');
    }

    if (distToPlayer <= this.detectionRange) {
      this.transitionTo('chase');
    }
  }

  private handlePatrol(
    _delta: number,
    distToPlayer: number,
    playerX: number,
    playerY: number,
  ): void {
    // Pick a patrol target if we don't have one
    if (!this.patrolTarget) {
      this.patrolTarget = new Phaser.Math.Vector2(
        this.x + Phaser.Math.Between(-100, 100),
        this.y + Phaser.Math.Between(-100, 100),
      );
    }

    const distToTarget = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.patrolTarget.x,
      this.patrolTarget.y,
    );

    if (distToTarget < 8) {
      this.patrolTarget = null;
      this.transitionTo('idle');
      return;
    }

    // Move toward patrol target
    this.scene.physics.moveToObject(this, this.patrolTarget, this.speed * 0.5);

    // Face movement direction
    this.rotation = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      this.patrolTarget.x,
      this.patrolTarget.y,
    );

    // Player detection
    if (distToPlayer <= this.detectionRange) {
      this.transitionTo('chase');
    }
  }

  private handleChase(
    _delta: number,
    distToPlayer: number,
    playerX: number,
    playerY: number,
  ): void {
    // Attack range depends on type
    const attackRange = this.enemyType === 'spitter' ? 200 : 40;

    if (distToPlayer <= attackRange) {
      this.transitionTo('attack');
      return;
    }

    // Give up chase if player is too far
    if (distToPlayer > this.detectionRange * 1.5) {
      this.transitionTo('patrol');
      return;
    }

    // Move toward player
    this.scene.physics.moveTo(this, playerX, playerY, this.speed);

    // Face player
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
  }

  private handleAttack(
    _delta: number,
    distToPlayer: number,
    playerX: number,
    playerY: number,
  ): void {
    const attackRange = this.enemyType === 'spitter' ? 200 : 40;

    // If player left attack range, chase again
    if (distToPlayer > attackRange * 1.2) {
      this.transitionTo('chase');
      return;
    }

    // Face the player
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);

    // If on cooldown, just track
    if (this.attackCooldown > 0) {
      // Melee types still close distance slowly while on cooldown
      if (this.enemyType !== 'spitter') {
        this.scene.physics.moveTo(this, playerX, playerY, this.speed * 0.4);
      } else {
        this.setVelocity(0, 0);
      }
      return;
    }

    // Execute attack
    switch (this.enemyType) {
      case 'spitter':
        this.attackRanged(playerX, playerY);
        this.attackCooldown = 2000;
        break;
      case 'brute':
        this.attackMeleeBrute(playerX, playerY);
        this.attackCooldown = 1000;
        break;
      default:
        this.attackMelee(playerX, playerY);
        this.attackCooldown = 1000;
        break;
    }
  }

  // -------------------------------------------------------------------
  // Attack implementations
  // -------------------------------------------------------------------
  private attackMelee(playerX: number, playerY: number): void {
    // Charge at player
    this.scene.physics.moveTo(this, playerX, playerY, this.speed * 2);
  }

  private attackMeleeBrute(playerX: number, playerY: number): void {
    // Slow but powerful charge
    this.scene.physics.moveTo(this, playerX, playerY, this.speed * 1.5);

    // Visual cue: tint briefly to show winding up
    this.setTint(0xff6666);
    this.scene.time.delayedCall(300, () => {
      if (this.active) this.clearTint();
    });
  }

  private attackRanged(playerX: number, playerY: number): void {
    this.setVelocity(0, 0);

    const bullet = this.scene.physics.add.sprite(this.x, this.y, 'bullet-enemy');
    bullet.setDepth(5);

    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    const speed = 250;
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    bullet.rotation = angle;

    // Store damage on the bullet so collision handler can read it
    (bullet as any).damage = this.damage;

    // Auto-destroy after 3 seconds or if it goes too far
    this.scene.time.delayedCall(3000, () => {
      if (bullet.active) bullet.destroy();
    });

    // Emit event so the scene can wire up collision with the player
    this.scene.events.emit('enemy-bullet-fired', bullet);
  }

  // -------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------
  private transitionTo(newState: EnemyState): void {
    this.state = newState;
    this.patrolTarget = null;

    switch (newState) {
      case 'idle':
        this.setVelocity(0, 0);
        this.stateTimer = Phaser.Math.Between(2000, 4000);
        break;
      case 'patrol':
        break;
      case 'chase':
        break;
      case 'attack':
        break;
      case 'dead':
        break;
    }
  }

  // -------------------------------------------------------------------
  // Damage & Death
  // -------------------------------------------------------------------
  takeDamage(amount: number): void {
    if (this.isDying) return;

    this.health -= amount;
    this.hasBeenDamaged = true;

    // Flash white on hit
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.active) this.clearTint();
    });

    // Aggro — always chase when hit
    if (this.state !== 'attack' && this.state !== 'dead') {
      this.transitionTo('chase');
    }

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  die(): void {
    if (this.isDying) return;
    this.isDying = true;
    this.state = 'dead';
    this.setVelocity(0, 0);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) body.enable = false;

    // Emit death event BEFORE the tween so listeners fire immediately
    // (cleanup() may remove us from the group before onComplete)
    this.emit('enemy-died', this);

    // Death animation: flash white, shrink, fade out
    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.healthBar.destroy();
        this.destroy();
      },
    });
  }

  // -------------------------------------------------------------------
  // Loot
  // -------------------------------------------------------------------
  dropLoot(): { type: string; x: number; y: number }[] {
    const lootCount = Phaser.Math.Between(1, 3);
    const lootTypes = ['ammo', 'health_pack', 'weapon_upgrade', 'building_material', 'rare_mineral'];
    const lootSpriteMap: Record<string, string> = {
      ammo: 'loot-ammo',
      health_pack: 'loot-health',
      weapon_upgrade: 'loot-weapon',
      building_material: 'loot-material',
      rare_mineral: 'loot-mineral',
    };

    const drops: { type: string; x: number; y: number }[] = [];

    for (let i = 0; i < lootCount; i++) {
      // Weighted drop — rarer items have lower chance
      let roll = Math.random();
      let type: string;
      if (roll < 0.35) {
        type = 'ammo';
      } else if (roll < 0.60) {
        type = 'health_pack';
      } else if (roll < 0.80) {
        type = 'building_material';
      } else if (roll < 0.95) {
        type = 'weapon_upgrade';
      } else {
        type = 'rare_mineral';
      }

      const offsetX = Phaser.Math.Between(-20, 20);
      const offsetY = Phaser.Math.Between(-20, 20);
      const dropX = this.x + offsetX;
      const dropY = this.y + offsetY;

      drops.push({ type, x: dropX, y: dropY });

      // Create the sprite in-world
      const spriteKey = lootSpriteMap[type] ?? 'loot-ammo';
      if (this.scene.textures.exists(spriteKey)) {
        const lootSprite = this.scene.physics.add.sprite(dropX, dropY, spriteKey);
        lootSprite.setDepth(4);
        (lootSprite as any).lootType = type;

        // Emit event so scene can wire up collection
        this.scene.events.emit('loot-dropped', lootSprite);
      }
    }

    return drops;
  }

  // -------------------------------------------------------------------
  // Health bar rendering
  // -------------------------------------------------------------------
  private drawHealthBar(): void {
    this.healthBar.clear();

    if (!this.hasBeenDamaged || this.health >= this.maxHealth) return;

    const barWidth = 24;
    const barHeight = 3;
    const offsetY = this.enemyType === 'brute' ? -20 : -16;
    const x = this.x - barWidth / 2;
    const y = this.y + offsetY;

    // Background (dark)
    this.healthBar.fillStyle(0x000000, 0.6);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    // Fill
    const ratio = this.health / this.maxHealth;
    let colour: number;
    if (ratio > 0.5) {
      colour = 0x00ff00;
    } else if (ratio > 0.25) {
      colour = 0xffff00;
    } else {
      colour = 0xff0000;
    }

    this.healthBar.fillStyle(colour, 1);
    this.healthBar.fillRect(x, y, barWidth * ratio, barHeight);
  }

  // -------------------------------------------------------------------
  // Cleanup on destroy
  // -------------------------------------------------------------------
  destroy(fromScene?: boolean): void {
    if (this.healthBar) {
      this.healthBar.destroy();
    }
    super.destroy(fromScene);
  }
}
