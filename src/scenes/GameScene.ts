import Phaser from 'phaser';
import { TILE_SIZE, CHUNK_SIZE, WEAPONS } from '../config/GameConfig';
import { BUILDINGS, UNITS } from '../config/BuildingConfig';
import { Commander } from '../entities/Commander';
import { Enemy } from '../entities/Enemy';
import { Rover } from '../entities/Rover';
import { Building } from '../entities/Building';
import { WorldGenerator } from '../systems/WorldGenerator';
import { WeaponSystem } from '../systems/WeaponSystem';
import { EnemySpawner } from '../systems/EnemySpawner';
import { VehicleManager } from '../systems/VehicleManager';
import { BuildingManager } from '../systems/BuildingManager';
import { ResourceManager } from '../systems/ResourceManager';
import { UnitManager } from '../systems/UnitManager';
import { TrainingQueue } from '../systems/TrainingQueue';
import { MiningSystem } from '../systems/MiningSystem';
import { SoundManager } from '../systems/SoundManager';
import { ResourceCrateSpawner } from '../systems/ResourceCrateSpawner';
import { HUD } from '../ui/HUD';
import { ColonyHUD } from '../ui/ColonyHUD';

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

  // Phase 2 systems (public for console testing)
  buildingManager!: BuildingManager;
  resourceManager!: ResourceManager;
  unitManager!: UnitManager;
  trainingQueue!: TrainingQueue;
  colonyHUD!: ColonyHUD;

  // Phase 3 systems
  miningSystem!: MiningSystem;
  soundManager!: SoundManager;
  crateSpawner!: ResourceCrateSpawner;

  // Loot items on the ground
  lootGroup!: Phaser.Physics.Arcade.Group;

  // Enemy bullets (from spitters)
  enemyBullets!: Phaser.Physics.Arcade.Group;

  // Crosshair
  private crosshair!: Phaser.GameObjects.Image;

  // Score decay
  private lastActiveTime: number = 0;

  // T key for training
  private keyT!: Phaser.Input.Keyboard.Key;

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

    // ── Find valid spawn point on grass/dirt ───────────────────────
    let spawnX = SPAWN_X;
    let spawnY = SPAWN_Y;
    for (let r = 0; r < 500; r += 32) {
      let found = false;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const tx = SPAWN_X + Math.cos(a) * r;
        const ty = SPAWN_Y + Math.sin(a) * r;
        const tile = this.world.getTileAt(tx, ty);
        if (tile === 'grass' || tile === 'dirt') {
          spawnX = tx;
          spawnY = ty;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    // ── Commander (player) ───────────────────────────────────────
    this.commander = new Commander(this, spawnX, spawnY);
    this.commander.setWeaponSystem(this.weaponSystem);

    // ── Enemy spawner ────────────────────────────────────────────
    this.enemySpawner = new EnemySpawner(this, 15);

    // ── Vehicle manager ──────────────────────────────────────────
    this.vehicleManager = new VehicleManager(this);
    this.vehicleManager.setCommander(this.commander);
    this.vehicleManager.spawnRoversNear(spawnX, spawnY, 3, 400);

    // ── Phase 2: Resource, Building, Unit, Training systems ──────
    this.resourceManager = new ResourceManager();
    this.buildingManager = new BuildingManager(this, this.resourceManager, this.world);
    this.unitManager = new UnitManager(this);
    this.trainingQueue = new TrainingQueue();
    this.miningSystem = new MiningSystem(this);
    this.soundManager = new SoundManager();
    this.crateSpawner = new ResourceCrateSpawner(this);

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

    // ── Launch HUD scenes ────────────────────────────────────────
    this.scene.launch('HUDScene');
    this.hud = this.scene.get('HUDScene') as HUD;

    this.scene.launch('ColonyHUDScene');
    this.colonyHUD = this.scene.get('ColonyHUDScene') as ColonyHUD;

    // ── Place initial Command Center at spawn ────────────────────
    this.buildingManager.placeCommandCenter(spawnX, spawnY);

    // ── Initial world load ───────────────────────────────────────
    this.world.update(this.commander.x, this.commander.y);

    // ── Score timer ──────────────────────────────────────────────
    this.lastActiveTime = Date.now();

    // ── T key for training marines ───────────────────────────────
    this.keyT = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);

    // Spawn a few initial enemies so the world isn't empty
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 300 + Math.random() * 300;
      const type = Math.random() < 0.6 ? 'basicAlien' : Math.random() < 0.75 ? 'spitter' : 'brute';
      this.enemySpawner.spawnEnemy(
        spawnX + Math.cos(angle) * dist,
        spawnY + Math.sin(angle) * dist,
        type,
      );
    }

  }

  // ── Collision wiring ─────────────────────────────────────────
  private setupCollisions(): void {
    const collisionGroup = this.world.getCollisionGroup();
    const buildingGroup = this.buildingManager.getBuildingGroup();

    // Commander vs world
    this.physics.add.collider(this.commander, collisionGroup);

    // Commander vs buildings (block movement)
    this.physics.add.collider(this.commander, buildingGroup);

    // Enemies vs world (same terrain rules as player)
    this.physics.add.collider(this.enemySpawner.getEnemies(), collisionGroup);

    // Player bullets vs enemies
    this.physics.add.overlap(
      this.weaponSystem.getBullets(),
      this.enemySpawner.getEnemies(),
      this.onBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Player bullets vs solid terrain (trees, rocks — NOT water)
    const solidGroup = this.world.getSolidGroup();
    this.physics.add.collider(
      this.weaponSystem.getBullets(),
      solidGroup,
      (bulletObj) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Image;
        bullet.setActive(false).setVisible(false);
        (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
      },
    );

    // Player bullets vs buildings (stop on impact)
    this.physics.add.collider(
      this.weaponSystem.getBullets(),
      buildingGroup,
      (bulletObj) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Image;
        bullet.setActive(false).setVisible(false);
        (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
      },
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

    // Vehicles vs enemies (run-over) and vs world/buildings
    for (const rover of this.vehicleManager.getVehicles()) {
      this.physics.add.collider(rover, collisionGroup);
      this.physics.add.collider(rover, buildingGroup);
      this.physics.add.overlap(
        rover,
        this.enemySpawner.getEnemies(),
        this.onRoverHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this,
      );

      // Vehicles can pick up loot too
      this.physics.add.overlap(
        rover,
        this.lootGroup,
        this.onPickupLoot as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
        undefined,
        this,
      );

      // Also pick up resource crates from vehicle
      this.physics.add.overlap(
        rover,
        this.crateSpawner.getCrates(),
        (_roverObj, crateObj) => {
          const crate = crateObj as Phaser.Physics.Arcade.Sprite;
          if (!crate.active) return;
          const isOre = Math.random() < 0.5;
          const amount = isOre ? Phaser.Math.Between(30, 60) : Phaser.Math.Between(15, 30);
          this.resourceManager.add(isOre ? 'ore' : 'energy', amount);
          if (this.hud) this.hud.showLootPickup(`+${amount} ${isOre ? 'Ore' : 'Energy'} (crate)`);
          if (this.soundManager) this.soundManager.playLootPickup();
          crate.destroy();
        },
      );
    }

    // Turret bullets vs enemies
    this.physics.add.overlap(
      this.buildingManager.getTurretBullets(),
      this.enemySpawner.getEnemies(),
      this.onTurretBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Turret bullets vs solid terrain (trees, rocks — NOT water)
    this.physics.add.collider(
      this.buildingManager.getTurretBullets(),
      solidGroup,
      (bulletObj) => {
        const bullet = bulletObj as Phaser.Physics.Arcade.Image;
        bullet.setActive(false).setVisible(false);
        (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
      },
    );

    // Enemies vs buildings (deal damage to buildings)
    this.physics.add.overlap(
      this.enemySpawner.getEnemies(),
      buildingGroup,
      this.onEnemyHitBuilding as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    );

    // Commander vs resource crates
    this.physics.add.overlap(
      this.commander,
      this.crateSpawner.getCrates(),
      (_commanderObj, crateObj) => {
        const crate = crateObj as Phaser.Physics.Arcade.Sprite;
        if (!crate.active) return;
        const isOre = Math.random() < 0.5;
        const amount = isOre ? Phaser.Math.Between(30, 60) : Phaser.Math.Between(15, 30);
        const resource = isOre ? 'ore' : 'energy';
        this.resourceManager.add(resource, amount);
        if (this.hud) this.hud.showLootPickup(`+${amount} ${isOre ? 'Ore' : 'Energy'} (crate)`);
        if (this.soundManager) this.soundManager.playLootPickup();
        crate.destroy();
      },
    );
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

    // Commander died — show death message
    this.events.on('commander-died', () => {
      if (this.hud) this.hud.showKillFeed('YOU DIED - Respawning at base...');
      if (this.soundManager) this.soundManager.playDamageTaken();
    });

    // When an enemy is killed
    this.events.on('enemy-killed', (enemy: Enemy) => {
      this.commander.addXP(enemy.xpReward);
      this.commander.addScore(enemy.xpReward * 2);
      if (this.hud) {
        this.hud.showKillFeed(`${enemy.enemyType} eliminated +${enemy.xpReward} XP`);
      }
      if (this.soundManager) this.soundManager.playEnemyDeath();
    });

    // Sound: commander shooting
    this.events.on('commander-shoot', (weapon: string) => {
      if (!this.soundManager) return;
      switch (weapon) {
        case 'pistol': this.soundManager.playPistolShot(); break;
        case 'rifle': this.soundManager.playRifleShot(); break;
        case 'shotgun': this.soundManager.playShotgunBlast(); break;
      }
      // Alert nearby enemies to gunfire sound
      const soundRange = weapon === 'shotgun' ? 500 : 400;
      this.enemySpawner.alertEnemiesToSound(this.commander.x, this.commander.y, soundRange);
    });

    // Sound: commander damaged
    this.events.on('commander-damaged', () => {
      if (this.soundManager) this.soundManager.playDamageTaken();
    });

    // Sound: building placed
    this.events.on('building-placed', () => {
      if (this.soundManager) this.soundManager.playBuildingPlace();
    });

    // Sound: commander level up
    this.events.on('commander-levelup', () => this.soundManager?.playLevelUp());

    // Sound: vehicle enter/exit
    this.events.on('vehicle-entered', () => {
      this.soundManager?.playVehicleEnter();
      this.soundManager?.playVehicleEngine();
    });
    this.events.on('vehicle-exited', () => this.soundManager?.stopVehicleEngine());

    // Mining: deposit depleted
    this.events.on('deposit-depleted', (_pos: {x: number, y: number}) => {
      // Could change the tile visually in the future
    });

    // Building: failed to place
    this.events.on('build-failed', (message: string) => {
      if (this.colonyHUD) this.colonyHUD.showAlert(message);
    });

    // When a friendly unit fires a bullet, wire overlap with enemies
    this.events.on('friendly-bullet-fired', (bullet: Phaser.Physics.Arcade.Sprite) => {
      this.physics.add.overlap(bullet, this.enemySpawner.getEnemies(), (bulletObj, enemyObj) => {
        const enemy = enemyObj as unknown as Enemy;
        const b = bulletObj as Phaser.Physics.Arcade.Sprite;
        if (enemy.active && enemy.state !== 'dead') {
          enemy.takeDamage((b as any).damage || 12);
          b.destroy();
        }
      });
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

  contactDamageCooldown = 0;

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
        this.resourceManager.add('ore', 15);
        pickupText = 'Materials +30 (+15 Ore)';
        break;
      case 'rare_mineral':
        this.commander.addScore(100);
        this.resourceManager.add('energy', 10);
        pickupText = 'Rare Mineral +100 (+10 Energy)';
        break;
      default:
        this.commander.addScore(10);
        pickupText = 'Loot +10';
    }

    if (this.hud) this.hud.showLootPickup(pickupText);
    if (this.soundManager) this.soundManager.playLootPickup();
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

  private onTurretBulletHitEnemy(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const bullet = bulletObj as Phaser.Physics.Arcade.Image;
    const enemy = enemyObj as unknown as Enemy;

    if (!bullet.active) return;
    if (!enemy.active || enemy.state === 'dead') return;

    const meta = bullet.getData('meta');
    const dmg = meta?.damage ?? 10;
    enemy.takeDamage(dmg);

    bullet.setActive(false).setVisible(false);
    (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
  }

  private enemyBuildingDamageCooldowns = new Map<string, number>();

  private onEnemyHitBuilding(
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    buildingObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ): void {
    const enemy = enemyObj as unknown as Enemy;
    const building = buildingObj as unknown as Building;

    if (!enemy.active || enemy.state === 'dead') return;
    if (!building.active) return;

    // Throttle building damage to once per second per enemy-building pair
    const pairKey = `${enemy.x.toFixed(0)}_${enemy.y.toFixed(0)}_${building.x.toFixed(0)}_${building.y.toFixed(0)}`;
    const now = this.time.now;
    const lastHit = this.enemyBuildingDamageCooldowns.get(pairKey) ?? 0;

    if (now - lastHit < 1000) return;
    this.enemyBuildingDamageCooldowns.set(pairKey, now);

    building.takeDamage(enemy.damage);

    if (this.colonyHUD && building.health <= 0) {
      this.colonyHUD.showAlert(`Building Destroyed: ${building.buildingType}`);
    } else if (this.colonyHUD && building.health < building.maxHealth * 0.5) {
      this.colonyHUD.showAlert(`Building Under Attack!`);
    }
  }

  // ── Training via T key ────────────────────────────────────────
  private handleTrainingInput(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keyT)) return;

    // Find the nearest completed barracks
    const barracks = this.buildingManager.getBuildings().find(
      (b) => b.buildingType === 'barracks' && !b.isConstructing && b.active,
    );

    if (!barracks) {
      if (this.colonyHUD) this.colonyHUD.showAlert('No Barracks available!');
      return;
    }

    // Check cost
    const marineDef = UNITS['marine'];
    if (!marineDef) return;

    if (!this.resourceManager.canAfford(marineDef.cost)) {
      if (this.colonyHUD) this.colonyHUD.showAlert('Not enough resources for Marine');
      return;
    }

    // Deduct cost and enqueue
    this.resourceManager.spend(marineDef.cost);
    const enqueued = this.trainingQueue.enqueue('marine', `barracks_${barracks.x}_${barracks.y}`);

    if (!enqueued) {
      // Refund if queue is full
      this.resourceManager.add('ore', marineDef.cost.ore);
      this.resourceManager.add('energy', marineDef.cost.energy);
      if (this.colonyHUD) this.colonyHUD.showAlert('Training queue is full!');
      return;
    }

    if (this.colonyHUD) this.colonyHUD.showAlert('Training Marine...');
  }

  // ── Process completed training ────────────────────────────────
  private processTrainingQueue(delta: number): void {
    const completed = this.trainingQueue.update(delta);

    for (const unitType of completed) {
      // Find a barracks to spawn the unit near
      const barracks = this.buildingManager.getBuildings().find(
        (b) => b.buildingType === 'barracks' && !b.isConstructing && b.active,
      );

      const spawnX = barracks ? barracks.x + Phaser.Math.Between(-40, 40) : this.commander.x + 50;
      const spawnY = barracks ? barracks.y + Phaser.Math.Between(-40, 40) : this.commander.y + 50;

      const unit = this.unitManager.spawnUnit(spawnX, spawnY, unitType);

      if (unit && this.colonyHUD) {
        this.colonyHUD.showAlert(`Training Complete: ${unitType}`);
      } else if (!unit && this.colonyHUD) {
        this.colonyHUD.showAlert('Unit cap reached!');
      }
    }
  }

  // ── Update ColonyHUD with build mode state ─────────────────────
  private updateColonyHUD(): void {
    if (!this.colonyHUD) return;

    // Resources
    this.colonyHUD.updateResources(
      this.resourceManager.ore, this.resourceManager.maxOre, this.resourceManager.orePerMinute,
      this.resourceManager.energy, this.resourceManager.maxEnergy, this.resourceManager.energyPerMinute,
    );

    // Unit count
    this.colonyHUD.updateUnitCount(this.unitManager.getUnitCount(), this.unitManager.getMaxUnits());

    // Training queue
    this.colonyHUD.updateTrainingQueue(this.trainingQueue.getQueue());

    // Build mode indicator + panel
    const inBuildMode = this.buildingManager.isBuildModeActive();
    this.colonyHUD.showBuildMode(inBuildMode);

    if (inBuildMode) {
      // Build the entries array for the build panel
      const buildMenuOrder = ['barracks', 'refinery', 'solar_plant', 'turret', 'wall', 'command_center'];
      const entries = buildMenuOrder.map((key) => {
        const def = BUILDINGS[key];
        return {
          key,
          name: def.name,
          oreCost: def.cost.ore,
          energyCost: def.cost.energy,
          canAfford: this.resourceManager.canAfford(def.cost),
        };
      });

      // Determine selected index
      const selectedType = this.buildingManager.getSelectedBuildingType();
      const selectedIndex = selectedType ? buildMenuOrder.indexOf(selectedType) : -1;
      this.colonyHUD.selectBuildItem(selectedIndex);
      this.colonyHUD.showBuildPanel(entries);

      // Show tooltip for selected building
      if (selectedType && BUILDINGS[selectedType]) {
        const def = BUILDINGS[selectedType];
        this.colonyHUD.showBuildingTooltip(
          def.name,
          def.description,
          def.cost.ore,
          def.cost.energy,
          def.buildTime,
        );
      }
    } else {
      this.colonyHUD.hideBuildPanel();
      this.colonyHUD.hideBuildingTooltip();
    }
  }

  // ── Main update loop ─────────────────────────────────────────
  update(time: number, delta: number): void {
    this.gameUpdate(time, delta);
  }

  private gameUpdate(time: number, delta: number): void {
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

    // Phase 2 systems
    this.buildingManager.update(time, delta, this.commander.x, this.commander.y, this.enemySpawner.getEnemies());
    this.unitManager.update(time, delta, playerX, playerY, this.enemySpawner.getEnemies());

    // Mining system
    const enemiesGroup = this.enemySpawner.getEnemies();
    let enemiesNearby = false;
    enemiesGroup.getChildren().forEach((child) => {
      const e = child as Enemy;
      if (e.active && Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y) < 150) {
        enemiesNearby = true;
      }
    });
    const miningResult = this.miningSystem.update(
      time, delta, playerX, playerY,
      (x, y) => this.world.getTileAt(x, y),
      enemiesNearby,
    );

    // Show/hide mining prompt
    if (this.hud && !occupied) {
      if (miningResult.showPrompt) {
        this.hud.showVehiclePrompt(true, 'Ore Deposit (M to mine)');
      }
      // Don't override vehicle prompt if near a vehicle
    }

    // Handle mining completion
    if (miningResult.mined) {
      this.resourceManager.add('ore', miningResult.amount);
      if (this.hud) this.hud.showLootPickup(`+${miningResult.amount} Ore (mined)`);
      if (this.colonyHUD) this.colonyHUD.showAlert(`Mined ${miningResult.amount} Ore!`);
      this.soundManager?.playMiningComplete();
    }

    // Prevent commander movement while mining
    if (miningResult.isMining && !occupied) {
      const body = this.commander.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);
    }

    // Training queue
    this.handleTrainingInput();
    this.processTrainingQueue(delta);

    // Resource crate spawner
    this.crateSpawner.update(time, delta, playerX, playerY);

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
        (x, y) => this.world.getTileAt(x, y),
        this.buildingManager.getBuildings().map(b => ({ x: b.x, y: b.y, type: b.buildingType })),
      );
    }

    // ── ColonyHUD updates ────────────────────────────────────────
    this.updateColonyHUD();
  }
}
