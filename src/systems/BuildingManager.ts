import Phaser from 'phaser';
import { TILE_SIZE } from '../config/GameConfig';
import { BUILDINGS } from '../config/BuildingConfig';
import { Building } from '../entities/Building';
import { Turret } from '../entities/Turret';
import { ResourceManager } from './ResourceManager';
import type { WorldGenerator } from './WorldGenerator';

/** Order in which number keys select buildings during build mode. */
const BUILD_MENU_ORDER = [
  'barracks',
  'refinery',
  'solar_plant',
  'turret',
  'wall',
  'bridge',
  'command_center',
] as const;

/**
 * Manages all buildings and the build-mode UX (grid overlay, preview,
 * placement validation, construction, and production ticking).
 */
export class BuildingManager {
  private scene: Phaser.Scene;
  private buildings: Building[] = [];
  private buildMode: boolean = false;
  private selectedBuilding: string | null = null;
  private previewSprite: Phaser.GameObjects.Sprite | null = null;
  private gridOverlay: Phaser.GameObjects.Graphics | null = null;
  private previewTint: Phaser.GameObjects.Graphics | null = null;

  private resourceManager: ResourceManager;
  private worldGenerator: WorldGenerator;

  /** Static group for collisions with commander, enemies, etc. */
  private buildingGroup: Phaser.Physics.Arcade.StaticGroup;

  /** Shared bullet pool for turrets. */
  private turretBullets: Phaser.Physics.Arcade.Group;

  // Input keys
  private keyB!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private numKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor(
    scene: Phaser.Scene,
    resourceManager: ResourceManager,
    worldGenerator: WorldGenerator,
  ) {
    this.scene = scene;
    this.resourceManager = resourceManager;
    this.worldGenerator = worldGenerator;

    this.buildingGroup = scene.physics.add.staticGroup();

    // Turret bullet pool
    this.turretBullets = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 100,
      runChildUpdate: false,
      allowGravity: false,
    });

    this.setupInput();
  }

  // ── Input Binding ──────────────────────────────────────────────

  private setupInput(): void {
    const kb = this.scene.input.keyboard!;

    this.keyB = kb.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    this.keyEsc = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // Number keys 1–7 for building selection while in build mode
    const codes = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
    ];
    for (const code of codes) {
      this.numKeys.push(kb.addKey(code));
    }

    // Mouse click to place
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.buildMode || !this.selectedBuilding) return;
      if (!pointer.leftButtonDown()) return;

      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.placeBuilding(worldPoint.x, worldPoint.y);
    });
  }

  // ── Build Mode ─────────────────────────────────────────────────

  toggleBuildMode(): void {
    this.buildMode = !this.buildMode;

    if (this.buildMode) {
      this.showGridOverlay();
      // Default to first building
      this.selectBuilding(BUILD_MENU_ORDER[0]);
    } else {
      this.exitBuildMode();
    }
  }

  selectBuilding(type: string): void {
    if (!BUILDINGS[type]) return;
    this.selectedBuilding = type;

    // Destroy old preview
    this.clearPreview();

    // Create a new preview sprite
    const def = BUILDINGS[type];
    this.previewSprite = this.scene.add.sprite(0, 0, def.key);
    this.previewSprite.setAlpha(0.6);
    this.previewSprite.setDepth(50);
  }

  // ── Preview ────────────────────────────────────────────────────

  updatePreview(worldX: number, worldY: number): void {
    if (!this.buildMode || !this.previewSprite || !this.selectedBuilding) return;

    const def = BUILDINGS[this.selectedBuilding];
    const { snappedX, snappedY, tileX, tileY } = this.snapToGrid(worldX, worldY, def.width, def.height);

    this.previewSprite.setPosition(snappedX, snappedY);

    // Validity tinting
    const valid = this.isValidPlacement(tileX, tileY, def.width, def.height);
    const canAfford = this.resourceManager.canAfford(def.cost);

    if (valid && canAfford) {
      this.previewSprite.setTint(0x00ff00);
    } else {
      this.previewSprite.setTint(0xff0000);
    }

    // Draw tint overlay on tiles
    this.drawPreviewTint(tileX, tileY, def.width, def.height, valid && canAfford);
  }

  // ── Placement Validation ───────────────────────────────────────

  isValidPlacement(tileX: number, tileY: number, width: number, height: number): boolean {
    const isBridge = this.selectedBuilding === 'bridge';

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const tx = tileX + dx;
        const ty = tileY + dy;

        const worldPx = tx * TILE_SIZE + TILE_SIZE * 0.5;
        const worldPy = ty * TILE_SIZE + TILE_SIZE * 0.5;
        const tileType = this.worldGenerator.getTileAt(worldPx, worldPy);

        if (isBridge) {
          // Bridges can ONLY be placed on water
          if (tileType !== 'water') {
            return false;
          }
        } else {
          // All other buildings — only allow placement on grass or dirt
          if (tileType !== 'grass' && tileType !== 'dirt') {
            return false;
          }
        }

        // Check overlap with existing buildings
        if (this.isTileOccupied(tx, ty)) {
          return false;
        }
      }
    }
    return true;
  }

  private isTileOccupied(tileX: number, tileY: number): boolean {
    const px = tileX * TILE_SIZE + TILE_SIZE * 0.5;
    const py = tileY * TILE_SIZE + TILE_SIZE * 0.5;

    for (const building of this.buildings) {
      if (!building.active) continue;
      const def = BUILDINGS[building.buildingType];

      // Building footprint in tile coords
      const bTileX = Math.floor((building.x - (def.width * TILE_SIZE) / 2) / TILE_SIZE);
      const bTileY = Math.floor((building.y - (def.height * TILE_SIZE) / 2) / TILE_SIZE);

      if (
        tileX >= bTileX &&
        tileX < bTileX + def.width &&
        tileY >= bTileY &&
        tileY < bTileY + def.height
      ) {
        return true;
      }
    }
    return false;
  }

  // ── Place Building ─────────────────────────────────────────────

  placeBuilding(worldX: number, worldY: number): Building | null {
    if (!this.selectedBuilding) return null;

    const type = this.selectedBuilding;

    // Require a completed Command Center to build (except for CC itself)
    if (type !== 'command_center') {
      const hasCC = this.buildings.some(
        b => b.buildingType === 'command_center' && !b.isConstructing && b.active,
      );
      if (!hasCC) {
        this.scene.events.emit('build-failed', 'Need a Command Center first!');
        return null;
      }
    }

    const def = BUILDINGS[type];
    const { snappedX, snappedY, tileX, tileY } = this.snapToGrid(worldX, worldY, def.width, def.height);

    if (!this.isValidPlacement(tileX, tileY, def.width, def.height)) return null;
    if (!this.resourceManager.spend(def.cost)) return null;

    let building: Building;

    if (type === 'turret') {
      const turret = new Turret(this.scene, snappedX, snappedY);
      turret.setBulletGroup(this.turretBullets);
      building = turret;
    } else {
      building = new Building(this.scene, snappedX, snappedY, type);
    }

    this.buildings.push(building);
    this.buildingGroup.add(building);

    // Refresh static body
    (building.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();

    if (type === 'bridge') {
      // Remove water collision at this position so entities can walk over the bridge
      const collisionGroup = this.worldGenerator.getCollisionGroup();
      collisionGroup.getChildren().forEach((obj) => {
        const sprite = obj as Phaser.GameObjects.Sprite;
        if (Phaser.Math.Distance.Between(sprite.x, sprite.y, building.x, building.y) < 20) {
          collisionGroup.remove(sprite);
          // Don't destroy the sprite — the water texture should still show underneath
          // Just disable its physics body
          const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
          if (body) body.enable = false;
        }
      });

      // Bridge itself should NOT block movement (don't add to buildingGroup)
      // Override: remove it from the building static group that was added above
      this.buildingGroup.remove(building);
      const bBody = building.body as Phaser.Physics.Arcade.StaticBody;
      if (bBody) bBody.enable = false;
    }

    // Recalculate production rates
    this.resourceManager.updateProduction(this.buildings);

    this.scene.events.emit('building-placed');
    return building;
  }

  /**
   * Place the initial Command Center near a given position.
   * This bypasses cost and build-mode checks.
   */
  placeCommandCenter(worldX: number, worldY: number): Building | null {
    const def = BUILDINGS['command_center'];
    const { snappedX, snappedY } = this.snapToGrid(worldX, worldY, def.width, def.height);

    const building = new Building(this.scene, snappedX, snappedY, 'command_center');
    this.buildings.push(building);
    this.buildingGroup.add(building);
    (building.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();

    return building;
  }

  // ── Update Loop ────────────────────────────────────────────────

  update(
    time: number,
    delta: number,
    commanderX: number,
    commanderY: number,
    enemies: Phaser.Physics.Arcade.Group,
  ): void {
    // Handle build-mode input
    if (Phaser.Input.Keyboard.JustDown(this.keyB)) {
      this.toggleBuildMode();
    }
    if (this.buildMode && Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      this.exitBuildMode();
    }

    // Number key selection in build mode
    if (this.buildMode) {
      for (let i = 0; i < this.numKeys.length; i++) {
        if (Phaser.Input.Keyboard.JustDown(this.numKeys[i]) && i < BUILD_MENU_ORDER.length) {
          this.selectBuilding(BUILD_MENU_ORDER[i]);
        }
      }

      // Update preview to follow pointer
      const pointer = this.scene.input.activePointer;
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.updatePreview(worldPoint.x, worldPoint.y);
    }

    // Update all buildings
    let needsProductionUpdate = false;

    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];

      if (!b.active) {
        this.buildings.splice(i, 1);
        needsProductionUpdate = true;
        continue;
      }

      if (b instanceof Turret) {
        (b as Turret).updateTurret(
          time,
          delta,
          enemies,
          this.resourceManager,
          commanderX,
          commanderY,
        );
      } else {
        b.update(time, delta, this.resourceManager, commanderX, commanderY);
      }

      // Track when construction finishes
      if (!b.isConstructing && b.constructionProgress === 1 && (b as any).__wasConstructing) {
        needsProductionUpdate = true;
        delete (b as any).__wasConstructing;
      }
      if (b.isConstructing) {
        (b as any).__wasConstructing = true;
      }
    }

    if (needsProductionUpdate) {
      this.resourceManager.updateProduction(this.buildings);
    }

    // Clean up turret bullets that have gone too far
    this.turretBullets.getChildren().forEach((obj) => {
      const bullet = obj as Phaser.Physics.Arcade.Image;
      if (!bullet.active) return;
      const originX = bullet.getData('originX');
      const originY = bullet.getData('originY');
      const maxRange = bullet.getData('maxRange') ?? 250;
      if (originX == null || originY == null) return;
      const dist = Phaser.Math.Distance.Between(originX, originY, bullet.x, bullet.y);
      if (dist > maxRange) {
        bullet.setActive(false).setVisible(false);
        (bullet.body as Phaser.Physics.Arcade.Body).enable = false;
      }
    });
  }

  // ── Accessors ──────────────────────────────────────────────────

  getBuildings(): Building[] {
    return this.buildings;
  }

  getBuildingGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.buildingGroup;
  }

  getTurretBullets(): Phaser.Physics.Arcade.Group {
    return this.turretBullets;
  }

  isBuildModeActive(): boolean {
    return this.buildMode;
  }

  getSelectedBuildingType(): string | null {
    return this.selectedBuilding;
  }

  getResourceManager(): ResourceManager {
    return this.resourceManager;
  }

  // ── Grid Helpers ───────────────────────────────────────────────

  private snapToGrid(
    worldX: number,
    worldY: number,
    widthTiles: number,
    heightTiles: number,
  ): { snappedX: number; snappedY: number; tileX: number; tileY: number } {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);

    // Center the building on its tile footprint
    const snappedX = tileX * TILE_SIZE + (widthTiles * TILE_SIZE) / 2;
    const snappedY = tileY * TILE_SIZE + (heightTiles * TILE_SIZE) / 2;

    return { snappedX, snappedY, tileX, tileY };
  }

  // ── Visual Helpers ─────────────────────────────────────────────

  private showGridOverlay(): void {
    if (this.gridOverlay) this.gridOverlay.destroy();

    this.gridOverlay = this.scene.add.graphics();
    this.gridOverlay.setDepth(49);
    this.gridOverlay.setScrollFactor(1);
  }

  private drawPreviewTint(
    tileX: number,
    tileY: number,
    width: number,
    height: number,
    valid: boolean,
  ): void {
    if (!this.previewTint) {
      this.previewTint = this.scene.add.graphics();
      this.previewTint.setDepth(48);
    }

    this.previewTint.clear();

    const color = valid ? 0x00ff00 : 0xff0000;
    this.previewTint.fillStyle(color, 0.2);

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = (tileX + dx) * TILE_SIZE;
        const py = (tileY + dy) * TILE_SIZE;
        this.previewTint.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    // Grid lines
    this.previewTint.lineStyle(1, color, 0.5);
    for (let dy = 0; dy <= height; dy++) {
      const py = (tileY + dy) * TILE_SIZE;
      this.previewTint.lineBetween(
        tileX * TILE_SIZE,
        py,
        (tileX + width) * TILE_SIZE,
        py,
      );
    }
    for (let dx = 0; dx <= width; dx++) {
      const px = (tileX + dx) * TILE_SIZE;
      this.previewTint.lineBetween(
        px,
        tileY * TILE_SIZE,
        px,
        (tileY + height) * TILE_SIZE,
      );
    }
  }

  private clearPreview(): void {
    if (this.previewSprite) {
      this.previewSprite.destroy();
      this.previewSprite = null;
    }
    if (this.previewTint) {
      this.previewTint.clear();
    }
  }

  private exitBuildMode(): void {
    this.buildMode = false;
    this.selectedBuilding = null;
    this.clearPreview();

    if (this.gridOverlay) {
      this.gridOverlay.destroy();
      this.gridOverlay = null;
    }
    if (this.previewTint) {
      this.previewTint.destroy();
      this.previewTint = null;
    }
  }
}
