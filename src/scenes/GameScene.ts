import Phaser from 'phaser';
import { TILE_SIZE, CHUNK_SIZE, WEAPONS } from '../config/GameConfig';
import { Commander } from '../entities/Commander';
import { Enemy } from '../entities/Enemy';
import { Rover } from '../entities/Rover';
import { WorldGenerator } from '../systems/WorldGenerator';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemySpawner } from '../systems/EnemySpawner';
import { VehicleManager } from '../systems/VehicleManager';
import { HUD } from '../ui/HUD';

// Spawn point: center of a chunk cluster so terrain is guaranteed loaded
const SPAWN_X = 50 * CHUNK_SIZE * TILE_SIZE * 0.5;
const SPAWN_Y = 50 * CHUNK_SIZE * TILE_SIZE * 0.5;

export class GameScene extends Phaser.Scene {
  commander!: Commander;
  world!: WorldGenerator;
  weaponSystem!: WeaponSystem;
  enemySpawner!: EnemySpawner;
  vehicleManager!: VehicleManager;
  hud!: HUD;

  // Loot items on the ground
  lootGroup!: Phaser.Physics.Arcade.Group;

  // Enemy bullets (from spitters)
  enemyBullets!: Phaser.Physics.Arcade.Group;

  // Crosshair
  private crosshair!: Phaser.GameObjects.Image;

  // Score decay
  private lastActiveTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // ── World generation ─────────────────────────────────────────
    this.world = new WorldGenerator(this);

    // Set large world bounds for the physics system
    const worldPixelSize = 100 * CHUNK_SIZE * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldPixelSize, worldPixelSize);

    // ── Weapon system ────────────────────────────────────────────
    this.weaponSystem = new WeaponSystem(this);

    // ── Commander (player) ───────────────────────────────────────
    this.commander = new Commander(this, SPAWN_X, SPAWN_Y);
    this.commander.setWeaponSystem(this.weaponSystem);

    // ── Enemy spawner ────────────────────────────────────────────
    this.enemySpawner = new EnemySpawner(this, 15);

    // ── Vehicle manager ──────────────────────────────────────────
    this.vehicleManager = new VehicleManager(this);
    this.vehicleManager.setCommander(this.commander);
    this.vehicleManager.spawnRoversNear(SPAWN_X, SPAWN_Y, 3, 400);

    // ── Loot group ───────────────────────────────────────────────
    this.lootGroup = this.physics.add.group({
      allowGravity: false,
    });

    // ── Enemy bullets group ──────────────────────────────────────
    this.enemyBullets = this.physics.add.group({
      allowGravity: false,
    });

    // ── Camera ───────────────────────────────────────────────────
    this.cameras.main.startFollow(this.commander, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBounds(0, 0, worldPixelSize, worldPixelSize);

    // ── Crosshair ────────────────────────────────────────────────
    this.crosshair = this.add.image(0, 0, 'crosshair');
    this.crosshair.setDepth(100);
    this.crosshair.setScrollFactor(0);
    this.input.setDefaultCursor('none');

    // ── Collision setup ──────────────────────────────────────────
    this.setupCollisions();

    // ── Event listeners ──────────────────────────────────────────
    this.setupEvents();

    // ── Launch HUD scene ─────────────────────────────────────────
    this.scene.launch('HUDScene');
    this.hud = this.scene.get('HUDScene') as HUD;

    // ── Initial world load ───────────────────────────────────────
    this.world.update(this.commander.x, this.commander.y);

    // ── Score timer ──────────────────────────────────────────────
    this.lastActiveTime = Date.now();

    // Spawn a few initial enemies so the world isn't empty
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 300;
      const type = Math.random() < 0.6 ? 'basicAlien' : Math.random() < 0.75 ? 'spitter' : 'brute';
      this.enemySpawner.spawnEnemy(
        SPAWN_X + Math.cos(angle) * dist,
        SPAWN_Y + Math.sin(angle) * dist,
        type,
      );
    }
  }

  // ── Collision wiring ─────────────────────────────────────────
  private setupCollisions(): void {
    const collisionGroup = this.world.getCollisionGroup();

    // Commander vs world
    this.physics.add.collider(this.commander, collisionGroup);

    // Player bullets vs enemies
    this.physics.add.overlap(
      this.weaponSystem.getBullets(),
      this.enemySpawner.getEnemies(),
      this.onBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Player bullets vs world (destroy on impact)
    this.physics.add.collider(
      this.weaponSystem.getBullets(),
      collisionGroup,
      this.onBulletHitWorld as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Enemies vs commander (contact damage)
    this.physics.add.overlap(
      this.commander,
      this.enemySpawner.getEnemies(),
      this.onEnemyTouchCommander as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Commander vs loot
    this.physics.add.overlap(
      this.commander,
      this.lootGroup,
      this.onPickupLoot as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Vehicles vs enemies (run-over)
    for (const rover of this.vehicleManager.getVehicles()) {
      this.physics.add.collider(rover, collisionGroup);
      this.physics.add.overlap(
        rover,
        this.enemySpawner.getEnemies(),
        this.onRoverHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this,
      );
    }
  }

  // ── Event listeners ──────────────────────────────────────────
  private setupEvents(): void {
    // When an enemy drops loot, add it to our loot group
    this.events.on('loot-dropped', (lootSprite: Phaser.Physics.Arcade.Sprite) => {
      this.lootGroup.add(lootSprite);
    });

    // When a spitter fires a bullet, track it
    this.events.on('enemy-bullet-fired', (bullet: Phaser.Physics.Arcade.Sprite) => {
      this.enemyBullets.add(bullet);
      // Set up collision with player
      this.physics.add.overlap(
        this.commander,
        bullet,
        (_commander: any, _bullet: any) => {
          const b = _bullet as Phaser.Physics.Arcade.Sprite;
          const dmg = (b as any).damage ?? 15;
          this.commander.takeDamage(dmg);
          b.destroy();
          if (this.hud) this.hud.showDamageFlash();
        },
      );
    });

    // When an enemy is killed
    this.events.on('enemy-killed', (enemy: Enemy) => {
      this.commander.addXP(enemy.xpReward);
      this.commander.addScore(enemy.xpReward * 2);
      if (this.hud) {
        this.hud.showKillFeed(`${enemy.enemyType} eliminated +${enemy.xpReward} XP`);
      }
    });
  }

  // ── Collision handlers ───────────────────────────────────────
  private onBulletHitEnemy(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    const enemy = enemyObj as unknown as Enemy;
    const meta = bullet.getData('meta');

    if (!meta || meta.owner !== 'player') return;
    if (!enemy.active || enemy.state === 'dead') return;

    enemy.takeDamage(meta.damage);

    // Recycle bullet
    bullet.setActive(false).setVisible(false);
    (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
  }

  private onBulletHitWorld(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    bullet.setActive(false).setVisible(false);
    (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
  }

  private contactDamageCooldown = 0;

  private onEnemyTouchCommander(
    _commanderObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    if (this.commander.isInVehicle) return;
    if (this.contactDamageCooldown > 0) return;

    const enemy = enemyObj as unknown as Enemy;
    if (!enemy.active || enemy.state === 'dead') return;

    this.commander.takeDamage(enemy.damage);
    this.contactDamageCooldown = 500; // 500ms invulnerability
    if (this.hud) this.hud.showDamageFlash();
  }

  private onPickupLoot(
    _commanderObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    lootObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const lootSprite = lootObj as Phaser.Physics.Arcade.Sprite;
    const lootType = (lootSprite as any).lootType as string;

    let pickupText = '';
    switch (lootType) {
      case 'ammo':
        this.commander.pickupLoot('ammo', 10);
        pickupText = '+10 Ammo';
        break;
      case 'health_pack':
        this.commander.pickupLoot('health_pack', 25);
        pickupText = '+25 Health';
        break;
      case 'weapon_upgrade':
        this.commander.addScore(50);
        pickupText = 'Weapon Parts +50';
        break;
      case 'building_material':
        this.commander.addScore(30);
        pickupText = 'Materials +30';
        break;
      case 'rare_mineral':
        this.commander.addScore(100);
        pickupText = 'Rare Mineral +100';
        break;
      default:
        this.commander.addScore(10);
        pickupText = 'Loot +10';
    }

    if (this.hud) this.hud.showLootPickup(pickupText);
    lootSprite.destroy();
  }

  private onRoverHitEnemy(
    roverObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const rover = roverObj as unknown as Rover;
    const enemy = enemyObj as unknown as Enemy;
    if (!enemy.active || enemy.state === 'dead') return;

    const dmg = rover.getRunOverDamage();
    if (dmg > 0) {
      enemy.takeDamage(dmg);
    }
  }

  // ── Main update loop ─────────────────────────────────────────
  update(time: number, delta: number): void {
    // Contact damage cooldown
    if (this.contactDamageCooldown > 0) {
      this.contactDamageCooldown -= delta;
    }

    // Get the effective player position (commander or vehicle)
    const occupied = this.vehicleManager.getOccupiedVehicle();
    let playerX: number;
    let playerY: number;

    if (occupied) {
      // Drive the vehicle with commander's input
      const wasd = this.commander.wasd;
      occupied.drive(
        {
          up: wasd.W.isDown,
          down: wasd.S.isDown,
          left: wasd.A.isDown,
          right: wasd.D.isDown,
        },
        wasd.SHIFT.isDown,
      );
      playerX = occupied.x;
      playerY = occupied.y;

      // Keep commander at vehicle position (hidden)
      this.commander.setPosition(occupied.x, occupied.y);

      // Camera follows vehicle
      this.cameras.main.startFollow(occupied, true, 0.1, 0.1);
    } else {
      this.commander.update(time, delta);
      playerX = this.commander.x;
      playerY = this.commander.y;
      this.cameras.main.startFollow(this.commander, true, 0.1, 0.1);
    }

    // ── Systems update ───────────────────────────────────────────
    this.world.update(playerX, playerY);
    this.weaponSystem.update();
    this.enemySpawner.update(time, delta, playerX, playerY);
    this.vehicleManager.update(time, delta);

    // ── Crosshair ────────────────────────────────────────────────
    const pointer = this.input.activePointer;
    this.crosshair.setPosition(pointer.x, pointer.y);

    // ── Vehicle proximity prompt ─────────────────────────────────
    if (this.hud && !occupied) {
      const nearest = this.vehicleManager.findNearestVehicle(playerX, playerY);
      if (nearest) {
        this.hud.showVehiclePrompt(true, 'Rover');
      } else {
        this.hud.showVehiclePrompt(false);
      }
    } else if (this.hud && occupied) {
      this.hud.showVehiclePrompt(false);
    }

    // ── HUD updates ──────────────────────────────────────────────
    if (this.hud) {
      this.hud.updateHealth(this.commander.health, this.commander.maxHealth);

      const weaponConfig = WEAPONS[this.commander.currentWeapon];
      this.hud.updateAmmo(
        this.commander.ammo[this.commander.currentWeapon],
        weaponConfig?.ammoCapacity ?? 12,
        this.commander.currentWeapon,
      );

      this.hud.updateScore(this.commander.score);

      const xpInLevel = this.commander.xp % 100;
      this.hud.updateLevel(this.commander.level, xpInLevel, 100);

      this.hud.updateWeaponIndicator(this.commander.currentWeapon);

      // Fuel
      if (occupied) {
        this.hud.updateFuel(occupied.fuel, occupied.maxFuel, true);
      } else {
        this.hud.updateFuel(0, 100, false);
      }

      // Minimap data
      const enemies: { x: number; y: number }[] = [];
      this.enemySpawner.getEnemies().getChildren().forEach((child) => {
        const e = child as Enemy;
        if (e.active) enemies.push({ x: e.x, y: e.y });
      });

      const vehicles = this.vehicleManager.getVehicles().map((v) => ({ x: v.x, y: v.y }));
      const worldSize = 100 * CHUNK_SIZE * TILE_SIZE;

      this.hud.updateMinimap(
        { x: playerX, y: playerY },
        enemies,
        vehicles,
        { width: worldSize, height: worldSize },
      );
    }
  }
}
