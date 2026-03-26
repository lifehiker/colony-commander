import Phaser from 'phaser';

// ── Constants ────────────────────────────────────────────────
const W = 1280;
const H = 720;
const PAD = 16;
const BAR_W = 200;
const BAR_H = 20;
const XP_BAR_H = 8;
const MINIMAP_SIZE = 180;
const KILL_FEED_MAX = 3;
const KILL_FEED_DURATION = 3000;
const MINIMAP_UPDATE_INTERVAL = 10; // frames
const MINIMAP_VIEW_RANGE = 1500; // world units visible on minimap
const MINIMAP_CHUNK_SIZE = 512; // world-pixel size of one chunk (16 tiles * 32px)
const MINIMAP_TERRAIN_STEP = 3; // sample every N pixels for performance
const FOG_COLOR = 0x0a0a14;

// Terrain colors for minimap rendering
const TERRAIN_COLORS: Record<string, number> = {
  grass: 0x2d5a1e,
  dirt: 0x6b4423,
  water: 0x1a3a6b,
  rock: 0x555555,
  tree: 0x1a4a0e,
  ore: 0x00aaaa,
};

// Building colors and sizes for minimap rendering
const BUILDING_MINIMAP: Record<string, { color: number; w: number; h: number }> = {
  command_center: { color: 0x4488ff, w: 4, h: 4 },
  barracks: { color: 0x44ff44, w: 3, h: 3 },
  refinery: { color: 0xff8800, w: 3, h: 3 },
  solar_plant: { color: 0xffff00, w: 2, h: 3 },
  turret: { color: 0xffffff, w: 2, h: 2 },
  wall: { color: 0x888888, w: 2, h: 2 },
};

// Colors
const CLR_HEALTH = 0xff3333;
const CLR_HEALTH_HEX = '#ff3333';
const CLR_AMMO = 0xffcc00;
const CLR_AMMO_HEX = '#ffcc00';
const CLR_XP = 0x00ffcc;
const CLR_XP_HEX = '#00ffcc';
const CLR_FUEL = 0x3399ff;
const CLR_FUEL_HEX = '#3399ff';
const CLR_BG = 0x000000;
const CLR_BG_ALPHA = 0.5;
const CLR_BAR_EMPTY = 0x333333;
const CLR_SCORE_HEX = '#ffffff';
const CLR_MINIMAP_BG = 0x111122;
const CLR_MINIMAP_BORDER = 0x4488ff;

// Text style helpers
const textStyle = (
  size: number,
  color: string,
  bold = false,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: `${size}px`,
  color,
  fontStyle: bold ? 'bold' : 'normal',
  shadow: {
    offsetX: 1,
    offsetY: 1,
    color: '#000000',
    blur: 3,
    stroke: true,
    fill: true,
  },
});

// ── Kill feed entry ──────────────────────────────────────────
interface KillFeedEntry {
  text: Phaser.GameObjects.Text;
  addedAt: number;
}

// ── Loot popup entry ─────────────────────────────────────────
interface LootPopup {
  text: Phaser.GameObjects.Text;
  addedAt: number;
}

export class HUD extends Phaser.Scene {
  // ── Health ─────────────────────────────────────────────────
  private healthBg!: Phaser.GameObjects.Graphics;
  private healthBar!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private healthCurrent = 100;
  private healthMax = 100;
  private healthDisplay = 100; // lerped display value

  // ── Level / XP ─────────────────────────────────────────────
  private levelText!: Phaser.GameObjects.Text;
  private xpBg!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private levelNum = 1;
  private xpCurrent = 0;
  private xpToNext = 100;
  private pendingLevelUp = false;

  // ── Score ──────────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private scoreValue = 0;
  private scorePopTween: Phaser.Tweens.Tween | null = null;

  // ── Kill Feed ──────────────────────────────────────────────
  private killFeedEntries: KillFeedEntry[] = [];

  // ── Weapon / Ammo ──────────────────────────────────────────
  private weaponNameText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private ammoBg!: Phaser.GameObjects.Graphics;
  private ammoBar!: Phaser.GameObjects.Graphics;
  private weaponSlots!: Phaser.GameObjects.Graphics;
  private weaponSlotTexts: Phaser.GameObjects.Text[] = [];
  private currentWeapon = 'pistol';
  private ammoCurrent = 12;
  private ammoCapacity = 12;

  // ── Minimap ────────────────────────────────────────────────
  private minimapBg!: Phaser.GameObjects.Graphics;
  private minimapContent!: Phaser.GameObjects.Graphics;
  private minimapTerrain!: Phaser.GameObjects.Graphics;
  private minimapFrame = 0;
  private exploredChunks: Set<string> = new Set();
  private lastMinimapChunkX = Number.MIN_SAFE_INTEGER;
  private lastMinimapChunkY = Number.MIN_SAFE_INTEGER;
  private baseDistText!: Phaser.GameObjects.Text;

  // ── Fuel ───────────────────────────────────────────────────
  private fuelContainer!: Phaser.GameObjects.Container;
  private fuelBg!: Phaser.GameObjects.Graphics;
  private fuelBar!: Phaser.GameObjects.Graphics;
  private fuelText!: Phaser.GameObjects.Text;
  private fuelCurrent = 0;
  private fuelMax = 100;
  private fuelVisible = false;

  // ── Center Notifications ───────────────────────────────────
  private lowAmmoText!: Phaser.GameObjects.Text;
  private lowHealthText!: Phaser.GameObjects.Text;
  private vehiclePromptText!: Phaser.GameObjects.Text;
  private levelUpText!: Phaser.GameObjects.Text;

  // ── Damage Flash ───────────────────────────────────────────
  private damageOverlay!: Phaser.GameObjects.Graphics;

  // ── Loot Pickup ────────────────────────────────────────────
  private lootPopups: LootPopup[] = [];

  constructor() {
    super({ key: 'HUDScene' });
  }

  // ════════════════════════════════════════════════════════════
  // CREATE
  // ════════════════════════════════════════════════════════════
  create(): void {
    this.createHealthBar();
    this.createLevelIndicator();
    this.createScoreDisplay();
    this.createWeaponAmmoDisplay();
    this.createMinimap();
    this.createFuelBar();
    this.createCenterNotifications();
    this.createDamageOverlay();
  }

  // ── Health Bar (Top-Left) ──────────────────────────────────
  private createHealthBar(): void {
    const x = PAD;
    const y = PAD;

    // Background panel
    this.healthBg = this.add.graphics();
    this.drawBarBackground(this.healthBg, x, y, BAR_W, BAR_H);

    // Fill bar
    this.healthBar = this.add.graphics();
    this.drawBarFill(this.healthBar, x, y, BAR_W, BAR_H, 1, CLR_HEALTH);

    // Text overlay
    this.healthText = this.add.text(
      x + BAR_W / 2,
      y + BAR_H / 2,
      `HP: ${this.healthCurrent}/${this.healthMax}`,
      textStyle(12, '#ffffff', true),
    );
    this.healthText.setOrigin(0.5, 0.5);
    this.healthText.setDepth(10);
  }

  // ── Level / XP (Below Health) ──────────────────────────────
  private createLevelIndicator(): void {
    const x = PAD;
    const y = PAD + BAR_H + 6;

    this.levelText = this.add.text(
      x,
      y,
      `LVL ${this.levelNum}`,
      textStyle(14, CLR_XP_HEX, true),
    );

    const xpY = y + 20;
    this.xpBg = this.add.graphics();
    this.drawBarBackground(this.xpBg, x, xpY, BAR_W, XP_BAR_H);

    this.xpBar = this.add.graphics();
    this.drawBarFill(this.xpBar, x, xpY, BAR_W, XP_BAR_H, 0, CLR_XP);
  }

  // ── Score (Top-Right) ──────────────────────────────────────
  private createScoreDisplay(): void {
    this.scoreText = this.add.text(
      W - PAD,
      PAD,
      'SCORE: 0',
      textStyle(18, CLR_SCORE_HEX, true),
    );
    this.scoreText.setOrigin(1, 0);
  }

  // ── Weapon & Ammo (Bottom-Left) ────────────────────────────
  private createWeaponAmmoDisplay(): void {
    const x = PAD;
    const y = H - PAD - 80;

    // Weapon name
    this.weaponNameText = this.add.text(
      x,
      y,
      'PISTOL',
      textStyle(16, '#ffffff', true),
    );

    // Ammo count
    this.ammoText = this.add.text(
      x,
      y + 22,
      `${this.ammoCurrent} / ${this.ammoCapacity}`,
      textStyle(14, CLR_AMMO_HEX, false),
    );

    // Ammo bar
    const ammoBarY = y + 42;
    this.ammoBg = this.add.graphics();
    this.drawBarBackground(this.ammoBg, x, ammoBarY, 150, 6);
    this.ammoBar = this.add.graphics();
    this.drawBarFill(this.ammoBar, x, ammoBarY, 150, 6, 1, CLR_AMMO);

    // Weapon slots (1 / 2 / 3)
    const slotY = y + 56;
    this.weaponSlots = this.add.graphics();
    this.weaponSlotTexts = [];
    const slotNames = ['1', '2', '3'];
    const slotW = 30;
    const slotGap = 6;

    for (let i = 0; i < 3; i++) {
      const sx = x + i * (slotW + slotGap);
      // Slot background
      this.weaponSlots.fillStyle(
        i === 0 ? CLR_AMMO : CLR_BAR_EMPTY,
        i === 0 ? 0.8 : 0.5,
      );
      this.weaponSlots.fillRoundedRect(sx, slotY, slotW, slotW, 4);
      this.weaponSlots.lineStyle(1, 0x888888, 0.8);
      this.weaponSlots.strokeRoundedRect(sx, slotY, slotW, slotW, 4);

      const slotText = this.add.text(
        sx + slotW / 2,
        slotY + slotW / 2,
        slotNames[i],
        textStyle(12, '#ffffff', true),
      );
      slotText.setOrigin(0.5, 0.5);
      this.weaponSlotTexts.push(slotText);
    }
  }

  // ── Minimap (Bottom-Right) ─────────────────────────────────
  private createMinimap(): void {
    const x = W - PAD - MINIMAP_SIZE;
    const y = H - PAD - MINIMAP_SIZE;

    // Background
    this.minimapBg = this.add.graphics();
    this.minimapBg.fillStyle(CLR_MINIMAP_BG, 0.7);
    this.minimapBg.fillRoundedRect(x, y, MINIMAP_SIZE, MINIMAP_SIZE, 4);
    this.minimapBg.lineStyle(2, CLR_MINIMAP_BORDER, 0.8);
    this.minimapBg.strokeRoundedRect(x, y, MINIMAP_SIZE, MINIMAP_SIZE, 4);

    // Terrain layer (redrawn only on chunk change)
    this.minimapTerrain = this.add.graphics();

    // Content layer for entities (redrawn on update)
    this.minimapContent = this.add.graphics();

    // Base direction distance text (hidden by default)
    this.baseDistText = this.add.text(0, 0, '', textStyle(10, '#ffffff', true));
    this.baseDistText.setOrigin(0.5, 0.5);
    this.baseDistText.setVisible(false);
    this.baseDistText.setDepth(20);
  }

  // ── Fuel Bar (Below Health, conditional) ───────────────────
  private createFuelBar(): void {
    const x = PAD;
    const y = PAD + BAR_H + 6 + 20 + XP_BAR_H + 6;

    this.fuelBg = this.add.graphics();
    this.drawBarBackground(this.fuelBg, x, y, BAR_W, BAR_H);

    this.fuelBar = this.add.graphics();
    this.drawBarFill(this.fuelBar, x, y, BAR_W, BAR_H, 0, CLR_FUEL);

    this.fuelText = this.add.text(
      x + BAR_W / 2,
      y + BAR_H / 2,
      'FUEL: 0/100',
      textStyle(12, '#ffffff', true),
    );
    this.fuelText.setOrigin(0.5, 0.5);
    this.fuelText.setDepth(10);

    // Wrap in container for easy show/hide
    this.fuelContainer = this.add.container(0, 0, [
      this.fuelBg,
      this.fuelBar,
      this.fuelText,
    ]);
    this.fuelContainer.setVisible(false);
  }

  // ── Center Notifications ───────────────────────────────────
  private createCenterNotifications(): void {
    // Level Up
    this.levelUpText = this.add.text(
      W / 2,
      H / 2 - 60,
      'LEVEL UP!',
      textStyle(36, CLR_XP_HEX, true),
    );
    this.levelUpText.setOrigin(0.5, 0.5);
    this.levelUpText.setAlpha(0);

    // Low Ammo
    this.lowAmmoText = this.add.text(
      W / 2,
      H / 2 + 80,
      'LOW AMMO',
      textStyle(20, CLR_AMMO_HEX, true),
    );
    this.lowAmmoText.setOrigin(0.5, 0.5);
    this.lowAmmoText.setAlpha(0);

    // Low Health
    this.lowHealthText = this.add.text(
      W / 2,
      H / 2 + 110,
      'LOW HEALTH',
      textStyle(20, CLR_HEALTH_HEX, true),
    );
    this.lowHealthText.setOrigin(0.5, 0.5);
    this.lowHealthText.setAlpha(0);

    // Vehicle prompt
    this.vehiclePromptText = this.add.text(
      W / 2,
      H / 2 + 140,
      'Press E to enter Rover',
      textStyle(16, '#ffffff', false),
    );
    this.vehiclePromptText.setOrigin(0.5, 0.5);
    this.vehiclePromptText.setAlpha(0);
  }

  // ── Damage Flash Overlay ───────────────────────────────────
  private createDamageOverlay(): void {
    this.damageOverlay = this.add.graphics();
    this.damageOverlay.fillStyle(CLR_HEALTH, 0.3);
    this.damageOverlay.fillRect(0, 0, W, H);
    this.damageOverlay.setAlpha(0);
    this.damageOverlay.setDepth(100);
  }

  // ════════════════════════════════════════════════════════════
  // UPDATE (per-frame)
  // ════════════════════════════════════════════════════════════
  update(_time: number, _delta: number): void {
    // Smooth health bar lerp
    if (Math.abs(this.healthDisplay - this.healthCurrent) > 0.5) {
      this.healthDisplay += (this.healthCurrent - this.healthDisplay) * 0.1;
      this.redrawHealthBar();
    }

    // Low health pulsing
    if (this.healthCurrent / this.healthMax < 0.25) {
      const pulse = 0.5 + 0.5 * Math.sin(_time * 0.006);
      this.lowHealthText.setAlpha(pulse);
    } else {
      this.lowHealthText.setAlpha(0);
    }

    // Low ammo check
    if (this.ammoCapacity > 0 && this.ammoCurrent / this.ammoCapacity < 0.2) {
      this.lowAmmoText.setAlpha(0.9);
    } else {
      this.lowAmmoText.setAlpha(0);
    }

    // Clean up expired kill feed entries
    const now = this.time.now;
    this.killFeedEntries = this.killFeedEntries.filter((entry) => {
      if (now - entry.addedAt > KILL_FEED_DURATION) {
        entry.text.destroy();
        return false;
      }
      // Fade out over last second
      const remaining = KILL_FEED_DURATION - (now - entry.addedAt);
      if (remaining < 1000) {
        entry.text.setAlpha(remaining / 1000);
      }
      return true;
    });

    // Clean up loot popups (float up and fade)
    this.lootPopups = this.lootPopups.filter((popup) => {
      const age = now - popup.addedAt;
      if (age > 2000) {
        popup.text.destroy();
        return false;
      }
      popup.text.setAlpha(1 - age / 2000);
      popup.text.y -= 0.5;
      return true;
    });

    // Minimap throttle
    this.minimapFrame++;
  }

  // ════════════════════════════════════════════════════════════
  // PUBLIC UPDATE METHODS (called from GameScene)
  // ════════════════════════════════════════════════════════════

  updateHealth(current: number, max: number): void {
    this.healthCurrent = current;
    this.healthMax = max;
    this.healthText.setText(`HP: ${Math.ceil(current)}/${max}`);
  }

  updateAmmo(current: number, capacity: number, weaponName: string): void {
    this.ammoCurrent = current;
    this.ammoCapacity = capacity;
    this.ammoText.setText(`${current} / ${capacity}`);
    this.weaponNameText.setText(weaponName.toUpperCase());

    // Redraw ammo bar
    const ratio = capacity > 0 ? current / capacity : 0;
    const x = PAD;
    const y = H - PAD - 80 + 42;
    this.ammoBar.clear();
    this.drawBarFill(this.ammoBar, x, y, 150, 6, ratio, CLR_AMMO);
  }

  updateScore(score: number): void {
    this.scoreValue = score;
    this.scoreText.setText(`SCORE: ${score.toLocaleString()}`);

    // Pop animation
    if (this.scorePopTween) {
      this.scorePopTween.stop();
    }
    this.scoreText.setScale(1.3);
    this.scorePopTween = this.tweens.add({
      targets: this.scoreText,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  updateLevel(level: number, xp: number, xpToNext: number): void {
    const didLevelUp = level > this.levelNum;
    this.levelNum = level;
    this.xpCurrent = xp;
    this.xpToNext = xpToNext;

    this.levelText.setText(`LVL ${level}`);

    // Redraw XP bar
    const ratio = xpToNext > 0 ? xp / xpToNext : 0;
    const x = PAD;
    const y = PAD + BAR_H + 6 + 20;
    this.xpBar.clear();
    this.drawBarFill(this.xpBar, x, y, BAR_W, XP_BAR_H, ratio, CLR_XP);

    // Level up fanfare
    if (didLevelUp) {
      this.showLevelUp();
    }
  }

  updateMinimap(
    playerPos: { x: number; y: number },
    enemies: { x: number; y: number }[],
    vehicles: { x: number; y: number }[],
    mapBounds: { width: number; height: number },
    getTileAt?: (x: number, y: number) => string,
    buildings?: { x: number; y: number; type: string }[],
  ): void {
    // Throttle redraws
    if (this.minimapFrame % MINIMAP_UPDATE_INTERVAL !== 0) return;

    const mx = W - PAD - MINIMAP_SIZE;
    const my = H - PAD - MINIMAP_SIZE;
    const half = MINIMAP_SIZE / 2;
    const viewRange = MINIMAP_VIEW_RANGE;

    // ── Mark explored chunks near the player ──────────────────
    const playerChunkX = Math.floor(playerPos.x / MINIMAP_CHUNK_SIZE);
    const playerChunkY = Math.floor(playerPos.y / MINIMAP_CHUNK_SIZE);

    // Exploration radius in chunks (~view range / chunk size + 1)
    const exploreRadius = Math.ceil(viewRange / MINIMAP_CHUNK_SIZE) + 1;
    for (let dcx = -exploreRadius; dcx <= exploreRadius; dcx++) {
      for (let dcy = -exploreRadius; dcy <= exploreRadius; dcy++) {
        this.exploredChunks.add(`${playerChunkX + dcx},${playerChunkY + dcy}`);
      }
    }

    // ── Terrain layer — only redraw when player moves to a new chunk ──
    if (
      getTileAt &&
      (playerChunkX !== this.lastMinimapChunkX || playerChunkY !== this.lastMinimapChunkY)
    ) {
      this.lastMinimapChunkX = playerChunkX;
      this.lastMinimapChunkY = playerChunkY;
      this.redrawMinimapTerrain(playerPos, mx, my, half, viewRange, getTileAt);
    }

    // ── Entity layer (redrawn every update tick) ──────────────
    this.minimapContent.clear();

    // Buildings
    if (buildings) {
      for (const b of buildings) {
        const dx = b.x - playerPos.x;
        const dy = b.y - playerPos.y;
        if (Math.abs(dx) > viewRange || Math.abs(dy) > viewRange) continue;

        const dotX = mx + half + (dx / viewRange) * half;
        const dotY = my + half + (dy / viewRange) * half;
        if (dotX < mx || dotX > mx + MINIMAP_SIZE) continue;
        if (dotY < my || dotY > my + MINIMAP_SIZE) continue;

        const bConfig = BUILDING_MINIMAP[b.type];
        if (bConfig) {
          this.minimapContent.fillStyle(bConfig.color, 0.95);
          this.minimapContent.fillRect(
            dotX - bConfig.w / 2,
            dotY - bConfig.h / 2,
            bConfig.w,
            bConfig.h,
          );
        } else {
          // Fallback for unknown building types
          this.minimapContent.fillStyle(0xcccccc, 0.8);
          this.minimapContent.fillRect(dotX - 1, dotY - 1, 3, 3);
        }
      }
    }

    // Enemies (red dots)
    for (const e of enemies) {
      const dx = e.x - playerPos.x;
      const dy = e.y - playerPos.y;
      if (Math.abs(dx) > viewRange || Math.abs(dy) > viewRange) continue;

      const dotX = mx + half + (dx / viewRange) * half;
      const dotY = my + half + (dy / viewRange) * half;

      if (dotX < mx || dotX > mx + MINIMAP_SIZE) continue;
      if (dotY < my || dotY > my + MINIMAP_SIZE) continue;

      this.minimapContent.fillStyle(0xff3333, 0.9);
      this.minimapContent.fillCircle(dotX, dotY, 2);
    }

    // Vehicles (blue dots)
    for (const v of vehicles) {
      const dx = v.x - playerPos.x;
      const dy = v.y - playerPos.y;
      if (Math.abs(dx) > viewRange || Math.abs(dy) > viewRange) continue;

      const dotX = mx + half + (dx / viewRange) * half;
      const dotY = my + half + (dy / viewRange) * half;

      if (dotX < mx || dotX > mx + MINIMAP_SIZE) continue;
      if (dotY < my || dotY > my + MINIMAP_SIZE) continue;

      this.minimapContent.fillStyle(0x3399ff, 0.9);
      this.minimapContent.fillRect(dotX - 2, dotY - 2, 4, 4);
    }

    // Player dot (center, bright green) — drawn last so it's on top
    this.minimapContent.fillStyle(0x00ff44, 1);
    this.minimapContent.fillCircle(mx + half, my + half, 4);

    // Glow ring around player
    this.minimapContent.lineStyle(1, 0x00ff44, 0.4);
    this.minimapContent.strokeCircle(mx + half, my + half, 6);

    // ── Base direction indicator ────────────────────────────────
    const commandCenter = buildings?.find((b) => b.type === 'command_center');
    if (commandCenter) {
      const ccRelativeX = (commandCenter.x - playerPos.x) / viewRange * half;
      const ccRelativeY = (commandCenter.y - playerPos.y) / viewRange * half;
      const margin = 4;
      const isOutside =
        Math.abs(ccRelativeX) > half - margin || Math.abs(ccRelativeY) > half - margin;

      if (isOutside) {
        // Clamp to minimap edge
        const clampedX = Phaser.Math.Clamp(ccRelativeX, -(half - margin), half - margin);
        const clampedY = Phaser.Math.Clamp(ccRelativeY, -(half - margin), half - margin);
        const edgeX = mx + half + clampedX;
        const edgeY = my + half + clampedY;

        // Arrow pointing toward base
        const arrowAngle = Math.atan2(ccRelativeY, ccRelativeX);
        const arrowSize = 6;
        const tipX = edgeX + Math.cos(arrowAngle) * arrowSize;
        const tipY = edgeY + Math.sin(arrowAngle) * arrowSize;
        const leftX = edgeX + Math.cos(arrowAngle + 2.5) * arrowSize;
        const leftY = edgeY + Math.sin(arrowAngle + 2.5) * arrowSize;
        const rightX = edgeX + Math.cos(arrowAngle - 2.5) * arrowSize;
        const rightY = edgeY + Math.sin(arrowAngle - 2.5) * arrowSize;

        // Pulsing glow
        const pulse = 0.6 + 0.4 * Math.sin(this.minimapFrame * 0.1);
        this.minimapContent.fillStyle(0x4488ff, pulse);
        this.minimapContent.fillCircle(edgeX, edgeY, 5);

        // Arrow triangle
        this.minimapContent.fillStyle(0x4488ff, 1);
        this.minimapContent.fillTriangle(tipX, tipY, leftX, leftY, rightX, rightY);

        // Distance text
        const dist = Math.sqrt(
          (commandCenter.x - playerPos.x) ** 2 + (commandCenter.y - playerPos.y) ** 2,
        );
        const distLabel =
          dist >= 1000 ? `Base: ${(dist / 1000).toFixed(1)}k` : `Base: ${Math.round(dist)}`;

        // Position text slightly inward from the arrow
        const textOffsetX = -Math.cos(arrowAngle) * 14;
        const textOffsetY = -Math.sin(arrowAngle) * 14;
        this.baseDistText.setPosition(edgeX + textOffsetX, edgeY + textOffsetY);
        this.baseDistText.setText(distLabel);
        this.baseDistText.setVisible(true);
      } else {
        this.baseDistText.setVisible(false);
      }
    } else {
      this.baseDistText.setVisible(false);
    }
  }

  /**
   * Redraws the minimap terrain layer. Called only when the player moves
   * to a new chunk, not every frame, for performance.
   */
  private redrawMinimapTerrain(
    playerPos: { x: number; y: number },
    mx: number,
    my: number,
    half: number,
    viewRange: number,
    getTileAt: (x: number, y: number) => string,
  ): void {
    this.minimapTerrain.clear();

    // Fill entire minimap area with fog color first
    this.minimapTerrain.fillStyle(FOG_COLOR, 1);
    this.minimapTerrain.fillRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE);

    // Sample terrain at intervals for performance
    for (let px = 0; px < MINIMAP_SIZE; px += MINIMAP_TERRAIN_STEP) {
      for (let py = 0; py < MINIMAP_SIZE; py += MINIMAP_TERRAIN_STEP) {
        // Convert minimap pixel to world coordinates
        const worldX = playerPos.x + ((px - half) / half) * viewRange;
        const worldY = playerPos.y + ((py - half) / half) * viewRange;

        // Check if this world position is in an explored chunk
        const chunkX = Math.floor(worldX / MINIMAP_CHUNK_SIZE);
        const chunkY = Math.floor(worldY / MINIMAP_CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkY}`;

        if (!this.exploredChunks.has(chunkKey)) {
          continue; // Leave as fog color
        }

        // Get tile type and render color
        const tileType = getTileAt(worldX, worldY);
        const color = TERRAIN_COLORS[tileType];
        if (color !== undefined) {
          this.minimapTerrain.fillStyle(color, 0.85);
          this.minimapTerrain.fillRect(
            mx + px,
            my + py,
            MINIMAP_TERRAIN_STEP,
            MINIMAP_TERRAIN_STEP,
          );
        }
      }
    }
  }

  updateWeaponIndicator(weapon: string): void {
    this.currentWeapon = weapon;
    const slotIndex = weapon === 'pistol' ? 0 : weapon === 'rifle' ? 1 : 2;
    const slotW = 30;
    const slotGap = 6;
    const slotY = H - PAD - 80 + 56;

    this.weaponSlots.clear();
    for (let i = 0; i < 3; i++) {
      const sx = PAD + i * (slotW + slotGap);
      const isActive = i === slotIndex;
      this.weaponSlots.fillStyle(
        isActive ? CLR_AMMO : CLR_BAR_EMPTY,
        isActive ? 0.8 : 0.5,
      );
      this.weaponSlots.fillRoundedRect(sx, slotY, slotW, slotW, 4);
      this.weaponSlots.lineStyle(1, isActive ? 0xffffff : 0x888888, 0.8);
      this.weaponSlots.strokeRoundedRect(sx, slotY, slotW, slotW, 4);
    }
  }

  updateFuel(fuel: number, maxFuel: number, visible: boolean): void {
    this.fuelCurrent = fuel;
    this.fuelMax = maxFuel;
    this.fuelVisible = visible;

    this.fuelContainer.setVisible(visible);
    if (!visible) return;

    const x = PAD;
    const y = PAD + BAR_H + 6 + 20 + XP_BAR_H + 6;
    const ratio = maxFuel > 0 ? fuel / maxFuel : 0;

    this.fuelBar.clear();
    this.drawBarFill(this.fuelBar, x, y, BAR_W, BAR_H, ratio, CLR_FUEL);
    this.fuelText.setText(`FUEL: ${Math.ceil(fuel)}/${maxFuel}`);
  }

  showDamageFlash(): void {
    this.damageOverlay.setAlpha(0.4);
    this.tweens.add({
      targets: this.damageOverlay,
      alpha: 0,
      duration: 250,
      ease: 'Cubic.easeOut',
    });
  }

  showKillFeed(text: string): void {
    const x = W - PAD;
    const baseY = PAD + 30;

    // Push existing entries down
    for (const entry of this.killFeedEntries) {
      entry.text.y += 22;
    }

    // Remove oldest if at max
    if (this.killFeedEntries.length >= KILL_FEED_MAX) {
      const oldest = this.killFeedEntries.shift();
      oldest?.text.destroy();
    }

    const feedText = this.add.text(x, baseY, text, textStyle(12, CLR_XP_HEX));
    feedText.setOrigin(1, 0);
    feedText.setAlpha(0);

    // Fade in
    this.tweens.add({
      targets: feedText,
      alpha: 1,
      duration: 200,
    });

    this.killFeedEntries.push({
      text: feedText,
      addedAt: this.time.now,
    });
  }

  showLootPickup(text: string): void {
    // Offset below any existing popups so they don't stack on top of each other
    const offsetY = this.lootPopups.length * 20;

    const lootText = this.add.text(
      W / 2,
      H / 2 + 40 + offsetY,
      text,
      textStyle(14, CLR_AMMO_HEX, true),
    );
    lootText.setOrigin(0.5, 0.5);

    this.lootPopups.push({
      text: lootText,
      addedAt: this.time.now,
    });
  }

  showVehiclePrompt(visible: boolean, vehicleName = 'Rover'): void {
    if (visible) {
      this.vehiclePromptText.setText(`Press E to enter ${vehicleName}`);
      this.vehiclePromptText.setAlpha(0.9);
    } else {
      this.vehiclePromptText.setAlpha(0);
    }
  }

  // ════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════

  private redrawHealthBar(): void {
    const ratio = this.healthMax > 0 ? this.healthDisplay / this.healthMax : 0;
    const x = PAD;
    const y = PAD;
    this.healthBar.clear();
    this.drawBarFill(this.healthBar, x, y, BAR_W, BAR_H, ratio, CLR_HEALTH);
  }

  private showLevelUp(): void {
    this.levelUpText.setAlpha(1);
    this.levelUpText.setScale(0.5);

    this.tweens.add({
      targets: this.levelUpText,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.levelUpText,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 800,
          delay: 600,
          ease: 'Cubic.easeIn',
        });
      },
    });
  }

  /** Draw a dark rounded-rect bar background with angular sci-fi border */
  private drawBarBackground(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    // Dark fill
    gfx.fillStyle(CLR_BG, CLR_BG_ALPHA);
    gfx.fillRoundedRect(x, y, w, h, 4);

    // Inner empty bar
    gfx.fillStyle(CLR_BAR_EMPTY, 0.6);
    gfx.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 3);

    // Sci-fi border edge
    gfx.lineStyle(1, 0x4488ff, 0.4);
    gfx.strokeRoundedRect(x, y, w, h, 4);
  }

  /** Draw a filled bar at a given ratio (0..1) */
  private drawBarFill(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    color: number,
  ): void {
    const clampedRatio = Phaser.Math.Clamp(ratio, 0, 1);
    const fillW = (w - 4) * clampedRatio;
    if (fillW <= 0) return;

    gfx.fillStyle(color, 0.85);
    gfx.fillRoundedRect(x + 2, y + 2, fillW, h - 4, 3);

    // Highlight strip (glow effect along top of bar)
    gfx.fillStyle(0xffffff, 0.15);
    gfx.fillRoundedRect(x + 2, y + 2, fillW, Math.max(h / 3, 2), 2);
  }
}
