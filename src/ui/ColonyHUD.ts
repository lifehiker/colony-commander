import Phaser from 'phaser';

// ── Constants ────────────────────────────────────────────────
const W = 1280;
const H = 720;
const PAD = 16;

// Colors
const CLR_ORE = 0xff8844;
const CLR_ORE_HEX = '#ff8844';
const CLR_ENERGY = 0xffdd44;
const CLR_ENERGY_HEX = '#ffdd44';
const CLR_PANEL_BG = 0x111122;
const CLR_PANEL_ALPHA = 0.85;
const CLR_BORDER = 0x4488ff;
const CLR_VALID_HEX = '#44ff44';
const CLR_BLOCKED_HEX = '#ff4444';
const CLR_ALERT_GREEN_HEX = '#44ff88';
const CLR_ALERT_RED_HEX = '#ff4444';
const CLR_ALERT_BLUE_HEX = '#44aaff';
const CLR_GRAY_HEX = '#888888';
const CLR_WHITE_HEX = '#ffffff';
const CLR_DIM_HEX = '#555555';
const CLR_HIGHLIGHT = 0xffdd44;

// Layout
const RESOURCE_BAR_W = 400;
const RESOURCE_BAR_H = 36;
const BUILD_PANEL_W = 200;
const BUILD_PANEL_H = 400;
const BUILD_ITEM_H = 52;
const TOOLTIP_PAD = 8;
const TRAINING_BAR_W = 300;
const TRAINING_BAR_H = 32;
const TRAINING_ICON_SIZE = 24;

// Alert settings
const ALERT_DURATION = 3000;
const ALERT_MAX = 4;

// Text style helpers (matching HUD.ts pattern)
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

// ── Interfaces ───────────────────────────────────────────────
interface BuildingEntry {
  key: string;
  name: string;
  oreCost: number;
  energyCost: number;
  canAfford: boolean;
}

interface TrainingQueueItem {
  unitType: string;
  progress: number; // 0..1
}

interface AlertEntry {
  text: Phaser.GameObjects.Text;
  addedAt: number;
  style: 'green' | 'red' | 'blue';
}

interface BuildPanelItem {
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  hotkeyText: Phaser.GameObjects.Text;
  icon: Phaser.GameObjects.Graphics;
}

// ── ColonyHUD Scene ──────────────────────────────────────────
export class ColonyHUD extends Phaser.Scene {
  // ── Resource Display ──────────────────────────────────────
  private resourceBarBg!: Phaser.GameObjects.Graphics;
  private oreIcon!: Phaser.GameObjects.Graphics;
  private oreText!: Phaser.GameObjects.Text;
  private oreRateText!: Phaser.GameObjects.Text;
  private energyIcon!: Phaser.GameObjects.Graphics;
  private energyText!: Phaser.GameObjects.Text;
  private energyRateText!: Phaser.GameObjects.Text;

  // Smooth resource lerping
  private oreDisplay = 0;
  private oreCurrent = 0;
  private oreMax = 0;
  private energyDisplay = 0;
  private energyCurrent = 0;
  private energyMax = 0;

  // ── Build Panel ───────────────────────────────────────────
  private buildPanelContainer!: Phaser.GameObjects.Container;
  private buildPanelBg!: Phaser.GameObjects.Graphics;
  private buildPanelTitle!: Phaser.GameObjects.Text;
  private buildPanelItems: BuildPanelItem[] = [];
  private buildPanelExitText!: Phaser.GameObjects.Text;
  private selectedBuildIndex = -1;

  // ── Building Tooltip ──────────────────────────────────────
  private tooltipContainer!: Phaser.GameObjects.Container;
  private tooltipBg!: Phaser.GameObjects.Graphics;
  private tooltipName!: Phaser.GameObjects.Text;
  private tooltipDesc!: Phaser.GameObjects.Text;
  private tooltipCost!: Phaser.GameObjects.Text;
  private tooltipTime!: Phaser.GameObjects.Text;
  private tooltipStatus!: Phaser.GameObjects.Text;

  // ── Training Queue ────────────────────────────────────────
  private trainingContainer!: Phaser.GameObjects.Container;
  private trainingBg!: Phaser.GameObjects.Graphics;
  private trainingText!: Phaser.GameObjects.Text;
  private trainingIcons: Phaser.GameObjects.Graphics[] = [];
  private trainingBars: Phaser.GameObjects.Graphics[] = [];

  // ── Unit Count ────────────────────────────────────────────
  private unitCountContainer!: Phaser.GameObjects.Container;
  private unitCountIcon!: Phaser.GameObjects.Graphics;
  private unitCountText!: Phaser.GameObjects.Text;

  // ── Build Mode Indicator ──────────────────────────────────
  private buildModeText!: Phaser.GameObjects.Text;
  private buildModeActive = false;

  // ── Alerts ────────────────────────────────────────────────
  private alerts: AlertEntry[] = [];

  constructor() {
    super({ key: 'ColonyHUDScene' });
  }

  // ════════════════════════════════════════════════════════════
  // CREATE
  // ════════════════════════════════════════════════════════════
  create(): void {
    this.createResourceBar();
    this.createBuildPanel();
    this.createBuildingTooltip();
    this.createTrainingQueue();
    this.createUnitCount();
    this.createBuildModeIndicator();
  }

  // ════════════════════════════════════════════════════════════
  // UPDATE
  // ════════════════════════════════════════════════════════════
  update(time: number, _delta: number): void {
    // Smooth resource lerping
    this.lerpResource('ore', time);
    this.lerpResource('energy', time);

    // Build mode text pulsing
    if (this.buildModeActive) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 0.005);
      this.buildModeText.setAlpha(pulse);
    }

    // Tooltip follows cursor
    if (this.tooltipContainer.visible) {
      const pointer = this.input.activePointer;
      this.tooltipContainer.setPosition(pointer.x + 16, pointer.y + 16);

      // Clamp to screen bounds
      const bounds = this.tooltipContainer.getBounds();
      if (bounds.right > W - PAD) {
        this.tooltipContainer.x = pointer.x - bounds.width - 16;
      }
      if (bounds.bottom > H - PAD) {
        this.tooltipContainer.y = pointer.y - bounds.height - 16;
      }
    }

    // Clean up alerts
    this.cleanupAlerts();
  }

  // ════════════════════════════════════════════════════════════
  // RESOURCE DISPLAY (Top-Center)
  // ════════════════════════════════════════════════════════════
  private createResourceBar(): void {
    const x = (W - RESOURCE_BAR_W) / 2;
    const y = PAD;

    // Background bar
    this.resourceBarBg = this.add.graphics();
    this.resourceBarBg.fillStyle(CLR_PANEL_BG, CLR_PANEL_ALPHA);
    this.resourceBarBg.fillRoundedRect(x, y, RESOURCE_BAR_W, RESOURCE_BAR_H, 6);
    this.resourceBarBg.lineStyle(1, CLR_BORDER, 0.4);
    this.resourceBarBg.strokeRoundedRect(x, y, RESOURCE_BAR_W, RESOURCE_BAR_H, 6);

    const centerY = y + RESOURCE_BAR_H / 2;

    // ── Ore (left half) ──
    const oreX = x + 12;

    // Ore icon: small orange square
    this.oreIcon = this.add.graphics();
    this.oreIcon.fillStyle(CLR_ORE, 1);
    this.oreIcon.fillRect(oreX, centerY - 5, 10, 10);
    this.oreIcon.lineStyle(1, 0xffaa66, 0.6);
    this.oreIcon.strokeRect(oreX, centerY - 5, 10, 10);

    this.oreText = this.add.text(
      oreX + 16,
      centerY,
      '0/0',
      textStyle(13, CLR_ORE_HEX, true),
    );
    this.oreText.setOrigin(0, 0.5);

    this.oreRateText = this.add.text(
      oreX + 16,
      centerY,
      '(+0/min)',
      textStyle(10, CLR_GRAY_HEX),
    );
    this.oreRateText.setOrigin(0, 0.5);

    // ── Energy (right half) ──
    const energyX = x + RESOURCE_BAR_W / 2 + 12;

    // Energy icon: small lightning bolt shape
    this.energyIcon = this.add.graphics();
    this.energyIcon.fillStyle(CLR_ENERGY, 1);
    this.energyIcon.beginPath();
    this.energyIcon.moveTo(energyX + 6, centerY - 6);
    this.energyIcon.lineTo(energyX + 2, centerY + 1);
    this.energyIcon.lineTo(energyX + 5, centerY + 1);
    this.energyIcon.lineTo(energyX + 3, centerY + 7);
    this.energyIcon.lineTo(energyX + 9, centerY - 1);
    this.energyIcon.lineTo(energyX + 6, centerY - 1);
    this.energyIcon.closePath();
    this.energyIcon.fillPath();

    this.energyText = this.add.text(
      energyX + 16,
      centerY,
      '0/0',
      textStyle(13, CLR_ENERGY_HEX, true),
    );
    this.energyText.setOrigin(0, 0.5);

    this.energyRateText = this.add.text(
      energyX + 16,
      centerY,
      '(+0/min)',
      textStyle(10, CLR_GRAY_HEX),
    );
    this.energyRateText.setOrigin(0, 0.5);
  }

  updateResources(
    ore: number,
    maxOre: number,
    oreRate: number,
    energy: number,
    maxEnergy: number,
    energyRate: number,
  ): void {
    this.oreCurrent = ore;
    this.oreMax = maxOre;
    this.energyCurrent = energy;
    this.energyMax = maxEnergy;

    // Update rate text immediately
    const oreSign = oreRate >= 0 ? '+' : '';
    this.oreRateText.setText(`(${oreSign}${oreRate}/min)`);

    const energySign = energyRate >= 0 ? '+' : '';
    this.energyRateText.setText(`(${energySign}${energyRate}/min)`);

    // Position rate text after amount text
    this.repositionRateTexts();
  }

  private lerpResource(type: 'ore' | 'energy', _time: number): void {
    const current = type === 'ore' ? this.oreCurrent : this.energyCurrent;
    const display = type === 'ore' ? this.oreDisplay : this.energyDisplay;
    const max = type === 'ore' ? this.oreMax : this.energyMax;

    if (Math.abs(display - current) > 0.5) {
      const newDisplay = display + (current - display) * 0.1;
      if (type === 'ore') {
        this.oreDisplay = newDisplay;
        this.oreText.setText(`${Math.round(newDisplay)}/${max}`);
      } else {
        this.energyDisplay = newDisplay;
        this.energyText.setText(`${Math.round(newDisplay)}/${max}`);
      }
      this.repositionRateTexts();
    } else if (Math.round(display) !== Math.round(current)) {
      if (type === 'ore') {
        this.oreDisplay = current;
        this.oreText.setText(`${Math.round(current)}/${max}`);
      } else {
        this.energyDisplay = current;
        this.energyText.setText(`${Math.round(current)}/${max}`);
      }
      this.repositionRateTexts();
    }
  }

  private repositionRateTexts(): void {
    // Position ore rate text right after ore amount text
    const oreRight = this.oreText.x + this.oreText.width + 6;
    this.oreRateText.setX(oreRight);

    // Position energy rate text right after energy amount text
    const energyRight = this.energyText.x + this.energyText.width + 6;
    this.energyRateText.setX(energyRight);
  }

  // ════════════════════════════════════════════════════════════
  // BUILD PANEL (Left side, build mode only)
  // ════════════════════════════════════════════════════════════
  private createBuildPanel(): void {
    const x = PAD;
    const y = 80;

    this.buildPanelContainer = this.add.container(0, 0);
    this.buildPanelContainer.setVisible(false);

    // Background
    this.buildPanelBg = this.add.graphics();
    this.buildPanelBg.fillStyle(CLR_PANEL_BG, CLR_PANEL_ALPHA);
    this.buildPanelBg.fillRoundedRect(x, y, BUILD_PANEL_W, BUILD_PANEL_H, 6);
    this.buildPanelBg.lineStyle(1, CLR_BORDER, 0.4);
    this.buildPanelBg.strokeRoundedRect(x, y, BUILD_PANEL_W, BUILD_PANEL_H, 6);
    this.buildPanelContainer.add(this.buildPanelBg);

    // Title
    this.buildPanelTitle = this.add.text(
      x + BUILD_PANEL_W / 2,
      y + 14,
      'BUILD',
      textStyle(16, CLR_WHITE_HEX, true),
    );
    this.buildPanelTitle.setOrigin(0.5, 0);
    this.buildPanelContainer.add(this.buildPanelTitle);

    // Create 6 item slots (populated later)
    for (let i = 0; i < 6; i++) {
      const itemY = y + 40 + i * BUILD_ITEM_H;
      const item = this.createBuildPanelItem(x, itemY, i);
      this.buildPanelItems.push(item);
    }

    // Exit hint
    this.buildPanelExitText = this.add.text(
      x + BUILD_PANEL_W / 2,
      y + BUILD_PANEL_H - 16,
      'Press B to exit',
      textStyle(10, CLR_GRAY_HEX),
    );
    this.buildPanelExitText.setOrigin(0.5, 1);
    this.buildPanelContainer.add(this.buildPanelExitText);
  }

  private createBuildPanelItem(panelX: number, itemY: number, index: number): BuildPanelItem {
    const itemX = panelX + 8;
    const itemW = BUILD_PANEL_W - 16;

    // Item background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a33, 0.6);
    bg.fillRoundedRect(itemX, itemY, itemW, BUILD_ITEM_H - 4, 4);
    this.buildPanelContainer.add(bg);

    // Small icon placeholder
    const icon = this.add.graphics();
    icon.fillStyle(CLR_GRAY_HEX as unknown as number, 0.5);
    icon.fillRect(itemX + 6, itemY + 6, 24, 24);
    this.buildPanelContainer.add(icon);

    // Name
    const nameText = this.add.text(
      itemX + 36,
      itemY + 6,
      '',
      textStyle(11, CLR_WHITE_HEX, true),
    );
    this.buildPanelContainer.add(nameText);

    // Cost
    const costText = this.add.text(
      itemX + 36,
      itemY + 22,
      '',
      textStyle(9, CLR_GRAY_HEX),
    );
    this.buildPanelContainer.add(costText);

    // Hotkey
    const hotkeyText = this.add.text(
      itemX + itemW - 8,
      itemY + BUILD_ITEM_H / 2 - 2,
      `[${index + 1}]`,
      textStyle(11, CLR_GRAY_HEX, true),
    );
    hotkeyText.setOrigin(1, 0.5);
    this.buildPanelContainer.add(hotkeyText);

    return { bg, nameText, costText, hotkeyText, icon };
  }

  showBuildPanel(
    buildings: BuildingEntry[],
  ): void {
    this.buildPanelContainer.setVisible(true);

    const panelX = PAD;
    const panelBaseY = 80;

    // Resize panel to fit actual number of buildings
    const actualH = 40 + buildings.length * BUILD_ITEM_H + 30;
    this.buildPanelBg.clear();
    this.buildPanelBg.fillStyle(CLR_PANEL_BG, CLR_PANEL_ALPHA);
    this.buildPanelBg.fillRoundedRect(panelX, panelBaseY, BUILD_PANEL_W, actualH, 6);
    this.buildPanelBg.lineStyle(1, CLR_BORDER, 0.4);
    this.buildPanelBg.strokeRoundedRect(panelX, panelBaseY, BUILD_PANEL_W, actualH, 6);

    // Update exit text position
    this.buildPanelExitText.setY(panelBaseY + actualH - 16);

    for (let i = 0; i < this.buildPanelItems.length; i++) {
      const item = this.buildPanelItems[i];
      if (i < buildings.length) {
        const b = buildings[i];
        const itemX = panelX + 8;
        const itemW = BUILD_PANEL_W - 16;
        const itemY = panelBaseY + 40 + i * BUILD_ITEM_H;
        const isSelected = i === this.selectedBuildIndex;
        const color = b.canAfford ? CLR_WHITE_HEX : CLR_DIM_HEX;
        const costColor = b.canAfford ? CLR_GRAY_HEX : CLR_DIM_HEX;

        // Redraw background with selection highlight
        item.bg.clear();
        if (isSelected) {
          item.bg.lineStyle(2, CLR_HIGHLIGHT, 0.9);
          item.bg.strokeRoundedRect(itemX, itemY, itemW, BUILD_ITEM_H - 4, 4);
        }
        item.bg.fillStyle(isSelected ? 0x222244 : 0x1a1a33, 0.6);
        item.bg.fillRoundedRect(itemX, itemY, itemW, BUILD_ITEM_H - 4, 4);

        // Redraw icon with building-type color
        item.icon.clear();
        const iconColor = b.canAfford ? CLR_ORE : 0x444444;
        item.icon.fillStyle(iconColor, b.canAfford ? 0.7 : 0.3);
        item.icon.fillRect(itemX + 6, itemY + 6, 24, 24);
        item.icon.lineStyle(1, iconColor, b.canAfford ? 0.9 : 0.4);
        item.icon.strokeRect(itemX + 6, itemY + 6, 24, 24);

        item.nameText.setText(b.name);
        item.nameText.setStyle(textStyle(11, color, true));
        item.nameText.setPosition(itemX + 36, itemY + 6);

        item.costText.setText(`\u26CF${b.oreCost} \u26A1${b.energyCost}`);
        item.costText.setStyle(textStyle(9, costColor));
        item.costText.setPosition(itemX + 36, itemY + 22);

        item.hotkeyText.setText(`[${i + 1}]`);
        item.hotkeyText.setStyle(textStyle(11, b.canAfford ? CLR_GRAY_HEX : CLR_DIM_HEX, true));
        item.hotkeyText.setPosition(itemX + itemW - 8, itemY + BUILD_ITEM_H / 2 - 2);

        this.setItemVisible(item, true);
      } else {
        this.setItemVisible(item, false);
      }
    }
  }

  hideBuildPanel(): void {
    this.buildPanelContainer.setVisible(false);
    this.selectedBuildIndex = -1;
  }

  /** Set selected building index for highlight */
  selectBuildItem(index: number): void {
    this.selectedBuildIndex = index;
  }

  private setItemVisible(item: BuildPanelItem, visible: boolean): void {
    item.bg.setVisible(visible);
    item.nameText.setVisible(visible);
    item.costText.setVisible(visible);
    item.hotkeyText.setVisible(visible);
    item.icon.setVisible(visible);
  }

  // ════════════════════════════════════════════════════════════
  // BUILDING TOOLTIP (follows cursor in build mode)
  // ════════════════════════════════════════════════════════════
  private createBuildingTooltip(): void {
    this.tooltipContainer = this.add.container(0, 0);
    this.tooltipContainer.setVisible(false);
    this.tooltipContainer.setDepth(50);

    this.tooltipBg = this.add.graphics();
    this.tooltipContainer.add(this.tooltipBg);

    this.tooltipName = this.add.text(
      TOOLTIP_PAD,
      TOOLTIP_PAD,
      '',
      textStyle(12, CLR_WHITE_HEX, true),
    );
    this.tooltipContainer.add(this.tooltipName);

    this.tooltipDesc = this.add.text(
      TOOLTIP_PAD,
      TOOLTIP_PAD + 18,
      '',
      textStyle(9, CLR_GRAY_HEX),
    );
    this.tooltipDesc.setWordWrapWidth(180);
    this.tooltipContainer.add(this.tooltipDesc);

    this.tooltipCost = this.add.text(
      TOOLTIP_PAD,
      TOOLTIP_PAD + 40,
      '',
      textStyle(10, CLR_ORE_HEX),
    );
    this.tooltipContainer.add(this.tooltipCost);

    this.tooltipTime = this.add.text(
      TOOLTIP_PAD,
      TOOLTIP_PAD + 56,
      '',
      textStyle(10, CLR_GRAY_HEX),
    );
    this.tooltipContainer.add(this.tooltipTime);

    this.tooltipStatus = this.add.text(
      TOOLTIP_PAD,
      TOOLTIP_PAD + 72,
      '',
      textStyle(11, CLR_VALID_HEX, true),
    );
    this.tooltipContainer.add(this.tooltipStatus);
  }

  showBuildingTooltip(
    name: string,
    description: string,
    oreCost: number,
    energyCost: number,
    buildTime: number,
  ): void {
    this.tooltipContainer.setVisible(true);

    this.tooltipName.setText(name);
    this.tooltipDesc.setText(description);
    this.tooltipCost.setText(`\u26CF ${oreCost}  \u26A1 ${energyCost}`);
    this.tooltipTime.setText(`Build: ${buildTime}s`);

    // Calculate tooltip size based on content
    const descHeight = this.tooltipDesc.height;
    const tooltipW = 200;
    const tooltipH = TOOLTIP_PAD * 2 + 72 + descHeight - 22 + 16;

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(CLR_PANEL_BG, 0.92);
    this.tooltipBg.fillRoundedRect(0, 0, tooltipW, tooltipH, 4);
    this.tooltipBg.lineStyle(1, CLR_BORDER, 0.5);
    this.tooltipBg.strokeRoundedRect(0, 0, tooltipW, tooltipH, 4);

    // Adjust text positions for variable description height
    this.tooltipCost.setY(TOOLTIP_PAD + 18 + descHeight + 4);
    this.tooltipTime.setY(TOOLTIP_PAD + 18 + descHeight + 20);
    this.tooltipStatus.setY(TOOLTIP_PAD + 18 + descHeight + 36);
  }

  /** Update the validity status text on the tooltip */
  setTooltipValid(valid: boolean): void {
    if (valid) {
      this.tooltipStatus.setText('Valid');
      this.tooltipStatus.setStyle(textStyle(11, CLR_VALID_HEX, true));
    } else {
      this.tooltipStatus.setText('Blocked');
      this.tooltipStatus.setStyle(textStyle(11, CLR_BLOCKED_HEX, true));
    }
  }

  hideBuildingTooltip(): void {
    this.tooltipContainer.setVisible(false);
  }

  // ════════════════════════════════════════════════════════════
  // TRAINING QUEUE (Bottom-center when barracks selected)
  // ════════════════════════════════════════════════════════════
  private createTrainingQueue(): void {
    const x = (W - TRAINING_BAR_W) / 2;
    const y = H - PAD - TRAINING_BAR_H - 40;

    this.trainingContainer = this.add.container(0, 0);
    this.trainingContainer.setVisible(false);

    this.trainingBg = this.add.graphics();
    this.trainingBg.fillStyle(CLR_PANEL_BG, CLR_PANEL_ALPHA);
    this.trainingBg.fillRoundedRect(x, y, TRAINING_BAR_W, TRAINING_BAR_H + 26, 6);
    this.trainingBg.lineStyle(1, CLR_BORDER, 0.4);
    this.trainingBg.strokeRoundedRect(x, y, TRAINING_BAR_W, TRAINING_BAR_H + 26, 6);
    this.trainingContainer.add(this.trainingBg);

    this.trainingText = this.add.text(
      x + 10,
      y + 6,
      'Training Queue',
      textStyle(11, CLR_WHITE_HEX, true),
    );
    this.trainingContainer.add(this.trainingText);

    // Pre-create icon + bar slots (max 8 in queue)
    for (let i = 0; i < 8; i++) {
      const icon = this.add.graphics();
      icon.setVisible(false);
      this.trainingContainer.add(icon);
      this.trainingIcons.push(icon);

      const bar = this.add.graphics();
      bar.setVisible(false);
      this.trainingContainer.add(bar);
      this.trainingBars.push(bar);
    }
  }

  updateTrainingQueue(queue: TrainingQueueItem[]): void {
    this.trainingContainer.setVisible(true);

    const baseX = (W - TRAINING_BAR_W) / 2 + 10;
    const baseY = H - PAD - TRAINING_BAR_H - 40;
    const iconY = baseY + 22;

    // Update header text
    if (queue.length > 0) {
      const first = queue[0];
      const pct = Math.round(first.progress * 100);
      this.trainingText.setText(`Training: ${first.unitType} (${pct}%)`);
    } else {
      this.trainingText.setText('Training Queue (empty)');
    }

    // Update icon/bar slots
    for (let i = 0; i < this.trainingIcons.length; i++) {
      const icon = this.trainingIcons[i];
      const bar = this.trainingBars[i];

      if (i < queue.length) {
        const item = queue[i];
        const ix = baseX + i * (TRAINING_ICON_SIZE + 6);

        // Icon (small colored square)
        icon.clear();
        icon.fillStyle(0x44aaff, 0.7);
        icon.fillRect(ix, iconY, TRAINING_ICON_SIZE, TRAINING_ICON_SIZE);
        icon.lineStyle(1, 0x6688cc, 0.8);
        icon.strokeRect(ix, iconY, TRAINING_ICON_SIZE, TRAINING_ICON_SIZE);
        icon.setVisible(true);

        // Progress bar underneath
        bar.clear();
        bar.fillStyle(0x333344, 0.6);
        bar.fillRect(ix, iconY + TRAINING_ICON_SIZE + 2, TRAINING_ICON_SIZE, 3);
        const fillW = TRAINING_ICON_SIZE * Phaser.Math.Clamp(item.progress, 0, 1);
        if (fillW > 0) {
          bar.fillStyle(0x44ff88, 0.9);
          bar.fillRect(ix, iconY + TRAINING_ICON_SIZE + 2, fillW, 3);
        }
        bar.setVisible(true);
      } else {
        icon.setVisible(false);
        bar.setVisible(false);
      }
    }
  }

  hideTrainingQueue(): void {
    this.trainingContainer.setVisible(false);
  }

  // ════════════════════════════════════════════════════════════
  // UNIT COUNT (near weapon slots area, bottom-left)
  // ════════════════════════════════════════════════════════════
  private createUnitCount(): void {
    // Position near the weapon slot area
    const x = PAD + 120;
    const y = H - PAD - 24;

    this.unitCountContainer = this.add.container(0, 0);

    // Small soldier icon
    this.unitCountIcon = this.add.graphics();
    this.unitCountIcon.fillStyle(0x44aaff, 0.8);
    // Simple soldier silhouette: head + body
    this.unitCountIcon.fillCircle(x + 5, y + 3, 3); // head
    this.unitCountIcon.fillRect(x + 2, y + 6, 6, 8); // body
    this.unitCountContainer.add(this.unitCountIcon);

    this.unitCountText = this.add.text(
      x + 14,
      y + 4,
      'Units: 0/0',
      textStyle(11, CLR_WHITE_HEX, true),
    );
    this.unitCountText.setOrigin(0, 0.5);
    this.unitCountContainer.add(this.unitCountText);
  }

  updateUnitCount(current: number, max: number): void {
    this.unitCountText.setText(`Units: ${current}/${max}`);

    // Color based on capacity
    if (current >= max) {
      this.unitCountText.setStyle(textStyle(11, CLR_ALERT_RED_HEX, true));
    } else if (current >= max * 0.8) {
      this.unitCountText.setStyle(textStyle(11, CLR_ENERGY_HEX, true));
    } else {
      this.unitCountText.setStyle(textStyle(11, CLR_WHITE_HEX, true));
    }
  }

  // ════════════════════════════════════════════════════════════
  // BUILD MODE INDICATOR (top of screen, pulsing)
  // ════════════════════════════════════════════════════════════
  private createBuildModeIndicator(): void {
    this.buildModeText = this.add.text(
      W / 2,
      PAD + RESOURCE_BAR_H + 12,
      'BUILD MODE',
      textStyle(20, CLR_ENERGY_HEX, true),
    );
    this.buildModeText.setOrigin(0.5, 0);
    this.buildModeText.setAlpha(0);
  }

  showBuildMode(active: boolean): void {
    this.buildModeActive = active;
    if (!active) {
      this.buildModeText.setAlpha(0);
    }
    // When active, alpha is controlled by pulse in update()
  }

  // ════════════════════════════════════════════════════════════
  // COLONY ALERT NOTIFICATIONS (center screen, float up & fade)
  // ════════════════════════════════════════════════════════════
  showAlert(text: string): void {
    // Determine style from text content
    let style: 'green' | 'red' | 'blue' = 'green';
    let color = CLR_ALERT_GREEN_HEX;

    if (text.toLowerCase().includes('attack') || text.toLowerCase().includes('destroyed')) {
      style = 'red';
      color = CLR_ALERT_RED_HEX;
    } else if (text.toLowerCase().includes('training') || text.toLowerCase().includes('unit')) {
      style = 'blue';
      color = CLR_ALERT_BLUE_HEX;
    }

    // Push existing alerts up
    for (const alert of this.alerts) {
      alert.text.y -= 28;
    }

    // Remove oldest if at max
    if (this.alerts.length >= ALERT_MAX) {
      const oldest = this.alerts.shift();
      oldest?.text.destroy();
    }

    const alertText = this.add.text(
      W / 2,
      H / 2 - 40,
      text,
      textStyle(16, color, true),
    );
    alertText.setOrigin(0.5, 0.5);
    alertText.setAlpha(0);
    alertText.setDepth(40);

    // Fade in and float up
    this.tweens.add({
      targets: alertText,
      alpha: 1,
      y: alertText.y - 10,
      duration: 300,
      ease: 'Cubic.easeOut',
    });

    // Pulse for red alerts
    if (style === 'red') {
      this.tweens.add({
        targets: alertText,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 200,
        yoyo: true,
        repeat: 2,
      });
    }

    this.alerts.push({
      text: alertText,
      addedAt: this.time.now,
      style,
    });
  }

  private cleanupAlerts(): void {
    const now = this.time.now;
    this.alerts = this.alerts.filter((alert) => {
      const age = now - alert.addedAt;
      if (age > ALERT_DURATION) {
        alert.text.destroy();
        return false;
      }
      // Fade out over last second
      const remaining = ALERT_DURATION - age;
      if (remaining < 1000) {
        alert.text.setAlpha(remaining / 1000);
      }
      // Gentle float up
      alert.text.y -= 0.3;
      return true;
    });
  }
}
