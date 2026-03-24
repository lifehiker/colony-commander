import Phaser from 'phaser';

export type UnitCommand = 'follow' | 'guard' | 'patrol' | 'attack';

/** Config for each trainable unit type. */
export interface UnitTypeConfig {
  name: string;
  health: number;
  damage: number;
  speed: number;
  range: number;
  trainingTime: number; // seconds
}

export const UNIT_TYPES: Record<string, UnitTypeConfig> = {
  marine: {
    name: 'Marine',
    health: 50,
    damage: 10,
    speed: 120,
    range: 150,
    trainingTime: 10,
  },
};

type UnitState = 'idle' | 'moving' | 'combat' | 'returning';

export class FriendlyUnit extends Phaser.Physics.Arcade.Sprite {
  unitType: string;
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  range: number;
  command: UnitCommand;

  // Guard / patrol
  guardPosition: { x: number; y: number } | null = null;
  patrolPoints: { x: number; y: number }[] = [];
  currentPatrolIndex: number = 0;

  // Combat
  target: Phaser.Physics.Arcade.Sprite | null = null;
  attackCooldown: number = 0;

  // Visual
  healthBar: Phaser.GameObjects.Graphics;
  commandIndicator: Phaser.GameObjects.Graphics;

  // Internal — named unitState to avoid conflict with Phaser's base `state` property
  private unitState: UnitState = 'idle';
  private hasBeenDamaged: boolean = false;
  private isDying: boolean = false;
  private formationOffset: { x: number; y: number } = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, type: string) {
    const textureKey = `unit-${type}`;

    // Generate unit texture if missing
    if (!scene.textures.exists(textureKey)) {
      FriendlyUnit.generateUnitTexture(scene, type, textureKey);
    }

    // Generate friendly bullet texture if missing
    if (!scene.textures.exists('bullet-friendly')) {
      const gfx = scene.add.graphics();
      gfx.fillStyle(0x4488ff, 1);
      gfx.fillCircle(2, 2, 2);
      gfx.generateTexture('bullet-friendly', 4, 4);
      gfx.destroy();
    }

    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const config = UNIT_TYPES[type] ?? UNIT_TYPES.marine;

    this.unitType = type;
    this.maxHealth = config.health;
    this.health = config.health;
    this.damage = config.damage;
    this.speed = config.speed;
    this.range = config.range;
    this.command = 'follow';

    // Physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setCollideWorldBounds(false);
      body.setSize(16, 16);
      body.setOffset(this.width / 2 - 8, this.height / 2 - 8);
    }

    // Assign a random formation offset so units spread around the commander
    this.formationOffset = {
      x: Phaser.Math.Between(-50, 50),
      y: Phaser.Math.Between(-50, 50),
    };

    // Graphics objects
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(10);

    this.commandIndicator = scene.add.graphics();
    this.commandIndicator.setDepth(10);

    this.setDepth(6);
  }

  // -------------------------------------------------------------------
  // Texture generation
  // -------------------------------------------------------------------
  private static generateUnitTexture(
    scene: Phaser.Scene,
    _type: string,
    key: string,
  ): void {
    const size = 24;
    const gfx = scene.add.graphics();

    // Body (green soldier)
    gfx.fillStyle(0x336633, 1);
    gfx.fillCircle(size / 2, size / 2, size / 2 - 2);

    // Helmet (darker green band across top)
    gfx.fillStyle(0x224422, 1);
    gfx.fillRect(size / 2 - 8, 2, 16, 6);

    // Visor / eyes
    gfx.fillStyle(0xaaddaa, 1);
    gfx.fillCircle(size / 2 - 3, size / 2 - 2, 2);
    gfx.fillCircle(size / 2 + 3, size / 2 - 2, 2);

    // Weapon indicator (small line)
    gfx.lineStyle(2, 0x666666, 1);
    gfx.beginPath();
    gfx.moveTo(size / 2, size / 2);
    gfx.lineTo(size / 2, 2);
    gfx.strokePath();

    gfx.generateTexture(key, size, size);
    gfx.destroy();
  }

  // -------------------------------------------------------------------
  // Main update
  // -------------------------------------------------------------------
  update(
    time: number,
    delta: number,
    commanderX: number,
    commanderY: number,
    enemies: Phaser.Physics.Arcade.Group,
  ): void {
    if (this.isDying) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - delta);

    // Find nearest enemy within range
    const nearestEnemy = this.findNearestEnemy(enemies, commanderX, commanderY);

    switch (this.command) {
      case 'follow':
        this.behaviorFollow(delta, commanderX, commanderY, nearestEnemy);
        break;
      case 'guard':
        this.behaviorGuard(delta, nearestEnemy);
        break;
      case 'patrol':
        this.behaviorPatrol(delta, nearestEnemy);
        break;
      case 'attack':
        this.behaviorAttack(delta, commanderX, commanderY, nearestEnemy, enemies);
        break;
    }

    this.drawHealthBar();
    this.drawCommandIndicator();
  }

  // -------------------------------------------------------------------
  // Command setter
  // -------------------------------------------------------------------
  setCommand(command: UnitCommand, position?: { x: number; y: number }): void {
    this.command = command;
    this.target = null;
    this.unitState = 'idle';

    switch (command) {
      case 'guard':
        this.guardPosition = position ?? { x: this.x, y: this.y };
        break;
      case 'patrol':
        if (position) {
          this.patrolPoints.push(position);
        }
        if (this.patrolPoints.length === 0) {
          this.patrolPoints.push({ x: this.x, y: this.y });
        }
        this.currentPatrolIndex = 0;
        break;
      case 'follow':
        this.guardPosition = null;
        this.patrolPoints = [];
        break;
      case 'attack':
        break;
    }
  }

  // -------------------------------------------------------------------
  // Behaviors
  // -------------------------------------------------------------------
  private behaviorFollow(
    _delta: number,
    commanderX: number,
    commanderY: number,
    nearestEnemy: Phaser.Physics.Arcade.Sprite | null,
  ): void {
    // Target position is commander + formation offset
    const targetX = commanderX + this.formationOffset.x;
    const targetY = commanderY + this.formationOffset.y;
    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

    // If enemy in range, briefly engage
    if (nearestEnemy) {
      const distToEnemy = Phaser.Math.Distance.Between(
        this.x, this.y, nearestEnemy.x, nearestEnemy.y,
      );
      if (distToEnemy <= this.range) {
        this.engageTarget(nearestEnemy);
        return;
      }
    }

    // Move toward formation position
    if (distToTarget > 15) {
      this.scene.physics.moveTo(this, targetX, targetY, this.speed);
      this.rotation = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    } else {
      this.setVelocity(0, 0);
    }
  }

  private behaviorGuard(
    _delta: number,
    nearestEnemy: Phaser.Physics.Arcade.Sprite | null,
  ): void {
    const gx = this.guardPosition?.x ?? this.x;
    const gy = this.guardPosition?.y ?? this.y;

    // If enemy in range, engage
    if (nearestEnemy) {
      const distToEnemy = Phaser.Math.Distance.Between(
        this.x, this.y, nearestEnemy.x, nearestEnemy.y,
      );
      if (distToEnemy <= this.range) {
        this.engageTarget(nearestEnemy);

        // Don't chase too far from guard position
        const distFromGuard = Phaser.Math.Distance.Between(this.x, this.y, gx, gy);
        if (distFromGuard > this.range * 1.5) {
          this.target = null;
          this.unitState = 'returning';
        }
        return;
      }
    }

    // Return to guard position
    const distToGuard = Phaser.Math.Distance.Between(this.x, this.y, gx, gy);
    if (distToGuard > 10) {
      this.scene.physics.moveTo(this, gx, gy, this.speed);
      this.rotation = Phaser.Math.Angle.Between(this.x, this.y, gx, gy);
    } else {
      this.setVelocity(0, 0);
    }
  }

  private behaviorPatrol(
    _delta: number,
    nearestEnemy: Phaser.Physics.Arcade.Sprite | null,
  ): void {
    // If enemy in range, engage
    if (nearestEnemy) {
      const distToEnemy = Phaser.Math.Distance.Between(
        this.x, this.y, nearestEnemy.x, nearestEnemy.y,
      );
      if (distToEnemy <= this.range) {
        this.engageTarget(nearestEnemy);
        return;
      }
    }

    // Move between patrol points
    if (this.patrolPoints.length === 0) return;

    const target = this.patrolPoints[this.currentPatrolIndex];
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);

    if (dist < 10) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
    } else {
      this.scene.physics.moveTo(this, target.x, target.y, this.speed * 0.7);
      this.rotation = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    }
  }

  private behaviorAttack(
    _delta: number,
    commanderX: number,
    commanderY: number,
    nearestEnemy: Phaser.Physics.Arcade.Sprite | null,
    _enemies: Phaser.Physics.Arcade.Group,
  ): void {
    if (nearestEnemy) {
      const dist = Phaser.Math.Distance.Between(
        this.x, this.y, nearestEnemy.x, nearestEnemy.y,
      );
      // Chase across longer distances in attack mode
      if (dist <= this.range * 3) {
        this.engageTarget(nearestEnemy);
        return;
      }
    }

    // No enemies nearby — revert to follow behavior
    const targetX = commanderX + this.formationOffset.x;
    const targetY = commanderY + this.formationOffset.y;
    const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

    if (distToTarget > 15) {
      this.scene.physics.moveTo(this, targetX, targetY, this.speed);
      this.rotation = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    } else {
      this.setVelocity(0, 0);
    }
  }

  // -------------------------------------------------------------------
  // Combat
  // -------------------------------------------------------------------
  private engageTarget(enemy: Phaser.Physics.Arcade.Sprite): void {
    this.target = enemy;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);

    // Face the enemy
    this.rotation = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);

    if (dist > this.range) {
      // Move closer
      this.scene.physics.moveTo(this, enemy.x, enemy.y, this.speed);
    } else {
      // In range — stop and shoot
      this.setVelocity(0, 0);

      if (this.attackCooldown <= 0) {
        this.fireAtTarget(enemy);
        this.attackCooldown = 1000; // 1 second fire rate
      }
    }
  }

  private fireAtTarget(enemy: Phaser.Physics.Arcade.Sprite): void {
    const bullet = this.scene.physics.add.sprite(this.x, this.y, 'bullet-friendly');
    bullet.setDepth(5);

    const angle = Phaser.Math.Angle.Between(this.x, this.y, enemy.x, enemy.y);
    const speed = 400;
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    bullet.rotation = angle;

    // Store damage on the bullet
    (bullet as any).damage = this.damage;
    (bullet as any).isFriendlyBullet = true;

    // Auto-destroy after 2 seconds
    this.scene.time.delayedCall(2000, () => {
      if (bullet.active) bullet.destroy();
    });

    // Emit event so the scene can wire up collision with enemies
    this.scene.events.emit('friendly-bullet-fired', bullet);
  }

  // -------------------------------------------------------------------
  // Enemy finding (prioritize enemies near commander)
  // -------------------------------------------------------------------
  private findNearestEnemy(
    enemies: Phaser.Physics.Arcade.Group,
    commanderX: number,
    commanderY: number,
  ): Phaser.Physics.Arcade.Sprite | null {
    const children = enemies.getChildren() as Phaser.Physics.Arcade.Sprite[];
    if (children.length === 0) return null;

    let bestTarget: Phaser.Physics.Arcade.Sprite | null = null;
    let bestScore = Infinity;

    const searchRange = this.command === 'attack' ? this.range * 3 : this.range * 1.5;

    for (const enemy of children) {
      if (!enemy.active) continue;

      const distToUnit = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
      if (distToUnit > searchRange) continue;

      // Score: distance to unit, but prioritize enemies near the commander
      const distToCommander = Phaser.Math.Distance.Between(
        commanderX, commanderY, enemy.x, enemy.y,
      );
      const score = distToUnit * 0.6 + distToCommander * 0.4;

      if (score < bestScore) {
        bestScore = score;
        bestTarget = enemy;
      }
    }

    return bestTarget;
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

    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  }

  die(): void {
    if (this.isDying) return;
    this.isDying = true;
    this.setVelocity(0, 0);

    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) body.enable = false;

    this.emit('unit-died', this);

    this.scene.tweens.add({
      targets: this,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => {
        this.cleanup();
      },
    });
  }

  // -------------------------------------------------------------------
  // Visuals
  // -------------------------------------------------------------------
  private drawHealthBar(): void {
    this.healthBar.clear();

    if (!this.hasBeenDamaged || this.health >= this.maxHealth) return;

    const barWidth = 20;
    const barHeight = 3;
    const x = this.x - barWidth / 2;
    const y = this.y - 18;

    // Background
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

  private drawCommandIndicator(): void {
    this.commandIndicator.clear();

    let colour: number;
    switch (this.command) {
      case 'follow':
        colour = 0x00ff00; // green
        break;
      case 'guard':
        colour = 0x4488ff; // blue
        break;
      case 'patrol':
        colour = 0xffff00; // yellow
        break;
      case 'attack':
        colour = 0xff0000; // red
        break;
      default:
        colour = 0xffffff;
    }

    this.commandIndicator.fillStyle(colour, 0.9);
    this.commandIndicator.fillCircle(this.x, this.y - 16, 2);
  }

  // -------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------
  private cleanup(): void {
    if (this.healthBar) this.healthBar.destroy();
    if (this.commandIndicator) this.commandIndicator.destroy();
    this.destroy();
  }

  destroy(fromScene?: boolean): void {
    if (this.healthBar) this.healthBar.destroy();
    if (this.commandIndicator) this.commandIndicator.destroy();
    super.destroy(fromScene);
  }
}
