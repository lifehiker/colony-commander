import Phaser from 'phaser';
import { BUILDINGS, type BuildingDef } from '../config/BuildingConfig';
import { TILE_SIZE } from '../config/GameConfig';
import type { ResourceManager } from '../systems/ResourceManager';

/** Proximity radius in pixels – commander within this distance doubles build speed. */
const PROXIMITY_BOOST_RANGE = 100;

/**
 * A placed building in the game world.
 *
 * Starts in a "constructing" state with a progress bar. Once complete,
 * buildings with a `produces` config passively generate resources.
 * All buildings are static physics bodies that block movement.
 */
export class Building extends Phaser.Physics.Arcade.Sprite {
  buildingType: string;
  health: number;
  maxHealth: number;
  isConstructing: boolean;
  constructionProgress: number; // 0 → 1
  constructionTime: number; // seconds total
  productionTimer: number; // seconds since last production tick

  private def: BuildingDef;
  private statusBar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, type: string) {
    const def = BUILDINGS[type];
    if (!def) throw new Error(`Unknown building type: ${type}`);

    super(scene, x, y, def.key);

    this.def = def;
    this.buildingType = type;
    this.maxHealth = def.maxHealth;
    this.health = def.maxHealth;
    this.constructionTime = def.buildTime;
    this.constructionProgress = def.buildTime === 0 ? 1 : 0;
    this.isConstructing = def.buildTime > 0;
    this.productionTimer = 0;

    // Add to scene
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // true = static body

    // Size the physics body to match tile footprint
    const bodyW = def.width * TILE_SIZE;
    const bodyH = def.height * TILE_SIZE;
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(bodyW, bodyH);
    body.setOffset(
      (this.width - bodyW) / 2,
      (this.height - bodyH) / 2,
    );

    // Render above terrain but below commander
    // Bridges sit just above water (depth 0) but below entities (depth 5+)
    if (this.buildingType === 'bridge') {
      this.setDepth(2);
    } else {
      this.setDepth(5);
    }

    // While constructing, show translucent
    if (this.isConstructing) {
      this.setAlpha(0.5);
    }

    // Status bar overlay
    this.statusBar = scene.add.graphics();
    this.statusBar.setDepth(6);
  }

  // ── Public API ─────────────────────────────────────────────────

  /** Returns the `produces` config if this building type generates resources. */
  getProduces(): BuildingDef['produces'] {
    return this.def.produces;
  }

  /** Main frame update — progresses construction and produces resources. */
  update(
    _time: number,
    delta: number,
    resourceManager?: ResourceManager,
    commanderX?: number,
    commanderY?: number,
  ): void {
    if (!this.active) return;

    const deltaSec = delta / 1000;

    // ── Construction ──────────────────────────────────────────
    if (this.isConstructing) {
      let speed = 1; // normal multiplier

      // Proximity boost
      if (commanderX !== undefined && commanderY !== undefined) {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, commanderX, commanderY);
        if (dist <= PROXIMITY_BOOST_RANGE) {
          speed = 2;
        }
      }

      this.constructionProgress += (deltaSec * speed) / this.constructionTime;

      if (this.constructionProgress >= 1) {
        this.constructionProgress = 1;
        this.isConstructing = false;
        this.setAlpha(1);
      }

      this.drawStatusBar();
      return;
    }

    // ── Resource production ────────────────────────────────────
    if (this.def.produces && resourceManager) {
      this.productionTimer += deltaSec;

      if (this.productionTimer >= this.def.produces.interval) {
        this.productionTimer -= this.def.produces.interval;
        resourceManager.add(this.def.produces.resource, this.def.produces.amount);
      }
    }

    // Redraw bar only when damaged
    if (this.health < this.maxHealth) {
      this.drawStatusBar();
    }
  }

  // ── Damage ─────────────────────────────────────────────────

  takeDamage(amount: number): void {
    if (!this.active) return;

    this.health = Math.max(0, this.health - amount);

    // Flash red
    this.setTint(0xff0000);
    this.scene.time.delayedCall(100, () => {
      if (this.active) this.clearTint();
    });

    if (this.health <= 0) {
      this.destroyBuilding();
    } else {
      this.drawStatusBar();
    }
  }

  /** Remove the building from the world. */
  destroyBuilding(): void {
    this.statusBar.destroy();
    this.destroy();
  }

  // ── Status Bar ─────────────────────────────────────────────

  drawStatusBar(): void {
    const g = this.statusBar;
    g.clear();

    const barW = this.def.width * TILE_SIZE;
    const barH = 4;
    const barX = this.x - barW / 2;
    const barY = this.y - (this.def.height * TILE_SIZE) / 2 - 8;

    if (this.isConstructing) {
      // Background
      g.fillStyle(0x222222, 0.8);
      g.fillRect(barX, barY, barW, barH);
      // Progress fill — yellow
      g.fillStyle(0xffcc00);
      g.fillRect(barX, barY, barW * this.constructionProgress, barH);
    } else if (this.health < this.maxHealth) {
      // Background
      g.fillStyle(0x222222, 0.8);
      g.fillRect(barX, barY, barW, barH);
      // Health fill — green → red
      const pct = this.health / this.maxHealth;
      const color = pct > 0.5 ? 0x00ff00 : pct > 0.25 ? 0xffaa00 : 0xff0000;
      g.fillStyle(color);
      g.fillRect(barX, barY, barW * pct, barH);
    }
  }

  /** Clean up graphics when the sprite is destroyed. */
  destroy(fromScene?: boolean): void {
    if (this.statusBar) {
      this.statusBar.destroy();
    }
    super.destroy(fromScene);
  }
}
