import Phaser from 'phaser';
import { generateSprites } from '../sprites/SpriteGenerator';
import { createCommanderAnimations } from '../sprites/CommanderAnimations';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // ── Loading bar ────────────────────────────────────────────
    const { width, height } = this.cameras.main;

    const barBg = this.add.rectangle(width / 2, height / 2, 400, 28, 0x222222);
    barBg.setOrigin(0.5);

    const barFill = this.add.rectangle(
      width / 2 - 196,
      height / 2,
      0,
      20,
      0x00ff88,
    );
    barFill.setOrigin(0, 0.5);

    const loadingText = this.add.text(width / 2, height / 2 - 30, 'Loading...', {
      fontSize: '18px',
      color: '#ffffff',
    });
    loadingText.setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      barFill.width = 392 * value;
    });

    this.load.on('complete', () => {
      barFill.destroy();
      barBg.destroy();
      loadingText.destroy();
    });

    // ── Generate all sprite textures at runtime ────────────────
    generateSprites(this);

    // ── Commander sprite sheet ─────────────────────────────────
    this.load.spritesheet('commander-sheet', 'assets/sprites/commander_sprite_sheet.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // ── Asset loading (placeholder) ────────────────────────────
    // Additional external assets (tilemaps, audio, etc.) will be
    // loaded here once available.
  }

  create(): void {
    // Register commander directional animations from the sprite sheet
    try {
      if (this.textures.exists('commander-sheet')) {
        createCommanderAnimations(this);
      }
    } catch (e) {
      console.warn('Commander animations failed, using fallback:', e);
    }

    this.scene.start('GameScene');
  }
}
