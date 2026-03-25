import Phaser from 'phaser';
import { TILE_SIZE } from '../config/GameConfig';

/**
 * MiningSystem — lets the commander mine ore from cyan ore deposits on the map.
 *
 * F key contextual usage:
 *   - When near an ore deposit AND no enemies within 150px → F mines ore
 *   - When enemies are nearby → F is handled by UnitManager for "all units attack"
 *   The GameScene integration should pass `enemiesNearby` so this system knows
 *   whether to claim the F key press.
 */

export interface MiningResult {
  /** True the frame mining completes and ore is awarded */
  mined: boolean;
  /** Amount of ore gained (only meaningful when mined === true) */
  amount: number;
  /** True when near a minable deposit — HUD should show "Press F to mine" */
  showPrompt: boolean;
  /** True while the mining animation is in progress — commander should not move */
  isMining: boolean;
}

export class MiningSystem {
  private scene: Phaser.Scene;
  private isMining: boolean = false;
  private miningProgress: number = 0;
  private miningDuration: number = 2000; // 2 seconds
  private miningTarget: { x: number; y: number } | null = null;
  private miningRange: number = 50; // must be within 50px of ore
  private cancelRange: number = 60; // cancel if commander moves further than this from target

  private progressBar: Phaser.GameObjects.Graphics;
  private progressBarBg: Phaser.GameObjects.Graphics;

  // Track depleted deposits
  private depletedDeposits: Set<string> = new Set();
  private depositUses: Map<string, number> = new Map(); // remaining uses per deposit
  private maxUses: number = 4; // each deposit can be mined 4 times

  // Key binding
  private keyM: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.keyM = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    // Create graphics objects for the progress bar (hidden by default)
    this.progressBarBg = scene.add.graphics();
    this.progressBarBg.setDepth(50);
    this.progressBarBg.setVisible(false);

    this.progressBar = scene.add.graphics();
    this.progressBar.setDepth(51);
    this.progressBar.setVisible(false);
  }

  /**
   * Call every frame from GameScene.
   *
   * @param time       - Phaser scene time
   * @param delta      - ms since last frame
   * @param commanderX - commander world x
   * @param commanderY - commander world y
   * @param getTileAt  - WorldGenerator.getTileAt bound reference
   * @param enemiesNearby - true if any enemy is within 150px (F key goes to UnitManager instead)
   */
  update(
    time: number,
    delta: number,
    commanderX: number,
    commanderY: number,
    getTileAt: (x: number, y: number) => string,
    enemiesNearby: boolean = false,
  ): MiningResult {
    const result: MiningResult = {
      mined: false,
      amount: 0,
      showPrompt: false,
      isMining: this.isMining,
    };

    // ── Currently mining ──────────────────────────────────────────
    if (this.isMining && this.miningTarget) {
      // Check if commander moved too far from target
      const dist = Phaser.Math.Distance.Between(
        commanderX, commanderY,
        this.miningTarget.x, this.miningTarget.y,
      );

      if (dist > this.cancelRange) {
        this.cancelMining();
        result.isMining = false;
        return result;
      }

      // Advance progress
      this.miningProgress += delta;
      this.drawProgressBar(commanderX, commanderY);

      if (this.miningProgress >= this.miningDuration) {
        // Mining complete
        const amount = this.completeMining();
        result.mined = true;
        result.amount = amount;
        result.isMining = false;
        return result;
      }

      result.isMining = true;
      return result;
    }

    // ── Not mining — check for nearby ore ─────────────────────────
    const nearbyOre = this.findNearbyOre(commanderX, commanderY, getTileAt);

    if (nearbyOre && !enemiesNearby) {
      result.showPrompt = true;

      // Check for F key press to start mining
      if (Phaser.Input.Keyboard.JustDown(this.keyM)) {
        this.startMining(nearbyOre);
        result.isMining = true;
      }
    }

    return result;
  }

  /**
   * Check if there's a minable ore deposit nearby.
   * Samples a grid of points around the commander (8 directions + center at 32px intervals).
   */
  private findNearbyOre(
    x: number,
    y: number,
    getTileAt: (x: number, y: number) => string,
  ): { x: number; y: number } | null {
    // Directions to sample: center + 8 cardinal/diagonal directions
    const offsets = [
      { dx: 0, dy: 0 },
      { dx: TILE_SIZE, dy: 0 },
      { dx: -TILE_SIZE, dy: 0 },
      { dx: 0, dy: TILE_SIZE },
      { dx: 0, dy: -TILE_SIZE },
      { dx: TILE_SIZE, dy: TILE_SIZE },
      { dx: -TILE_SIZE, dy: TILE_SIZE },
      { dx: TILE_SIZE, dy: -TILE_SIZE },
      { dx: -TILE_SIZE, dy: -TILE_SIZE },
    ];

    let closest: { x: number; y: number } | null = null;
    let closestDist = Infinity;

    for (const offset of offsets) {
      const checkX = x + offset.dx;
      const checkY = y + offset.dy;

      const tile = getTileAt(checkX, checkY);
      if (tile !== 'ore') continue;

      // Build deposit key from tile coordinates
      const depositKey = `${Math.floor(checkX / TILE_SIZE)}_${Math.floor(checkY / TILE_SIZE)}`;

      // Skip depleted deposits
      if (this.depletedDeposits.has(depositKey)) continue;

      const dist = Phaser.Math.Distance.Between(x, y, checkX, checkY);
      if (dist <= this.miningRange && dist < closestDist) {
        closestDist = dist;
        closest = { x: checkX, y: checkY };
      }
    }

    return closest;
  }

  /** Start mining an ore deposit */
  private startMining(target: { x: number; y: number }): void {
    this.isMining = true;
    this.miningProgress = 0;
    this.miningTarget = { ...target };
    this.progressBarBg.setVisible(true);
    this.progressBar.setVisible(true);
  }

  /**
   * Complete mining — returns the ore amount gained.
   * Decrements deposit uses and marks as depleted if exhausted.
   */
  private completeMining(): number {
    const amount = Phaser.Math.Between(20, 40);

    if (this.miningTarget) {
      const depositKey = `${Math.floor(this.miningTarget.x / TILE_SIZE)}_${Math.floor(this.miningTarget.y / TILE_SIZE)}`;

      // Decrement uses
      const remaining = this.depositUses.get(depositKey) ?? this.maxUses;
      const newRemaining = remaining - 1;

      if (newRemaining <= 0) {
        // Deposit is exhausted
        this.depletedDeposits.add(depositKey);
        this.depositUses.delete(depositKey);

        // Emit event so the scene can handle the visual change
        this.scene.events.emit('deposit-depleted', {
          x: this.miningTarget.x,
          y: this.miningTarget.y,
          tileX: Math.floor(this.miningTarget.x / TILE_SIZE),
          tileY: Math.floor(this.miningTarget.y / TILE_SIZE),
        });
      } else {
        this.depositUses.set(depositKey, newRemaining);
      }
    }

    // Clean up mining state
    this.isMining = false;
    this.miningProgress = 0;
    this.miningTarget = null;
    this.progressBar.setVisible(false);
    this.progressBarBg.setVisible(false);
    this.progressBar.clear();
    this.progressBarBg.clear();

    return amount;
  }

  /** Cancel mining (player moved away from deposit) */
  private cancelMining(): void {
    this.isMining = false;
    this.miningProgress = 0;
    this.miningTarget = null;
    this.progressBar.setVisible(false);
    this.progressBarBg.setVisible(false);
    this.progressBar.clear();
    this.progressBarBg.clear();
  }

  /**
   * Draw a progress bar above the commander while mining.
   * Background: dark gray (#333333), Fill: cyan (#00cccc)
   * Width: 40px, Height: 5px
   */
  private drawProgressBar(commanderX: number, commanderY: number): void {
    const barWidth = 40;
    const barHeight = 5;
    const barX = commanderX - barWidth / 2;
    const barY = commanderY - 30; // above the commander sprite
    const ratio = Phaser.Math.Clamp(this.miningProgress / this.miningDuration, 0, 1);

    // Background
    this.progressBarBg.clear();
    this.progressBarBg.fillStyle(0x333333, 0.8);
    this.progressBarBg.fillRect(barX, barY, barWidth, barHeight);

    // Fill
    this.progressBar.clear();
    const fillWidth = barWidth * ratio;
    if (fillWidth > 0) {
      this.progressBar.fillStyle(0x00cccc, 1);
      this.progressBar.fillRect(barX, barY, fillWidth, barHeight);
    }
  }

  /** Check if a specific deposit is depleted */
  isDepositDepleted(worldX: number, worldY: number): boolean {
    const key = `${Math.floor(worldX / TILE_SIZE)}_${Math.floor(worldY / TILE_SIZE)}`;
    return this.depletedDeposits.has(key);
  }

  /** Get remaining uses for a deposit (returns 0 if depleted, maxUses if never mined) */
  getDepositRemainingUses(worldX: number, worldY: number): number {
    const key = `${Math.floor(worldX / TILE_SIZE)}_${Math.floor(worldY / TILE_SIZE)}`;
    if (this.depletedDeposits.has(key)) return 0;
    return this.depositUses.get(key) ?? this.maxUses;
  }
}
