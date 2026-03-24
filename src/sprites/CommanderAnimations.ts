import Phaser from 'phaser';

/**
 * Creates all commander animations from the 1024x160 sprite sheet.
 *
 * Layout (each frame is 32x32):
 *   Row 0 (y=0):   Idle   — 8 frames (1 per direction)
 *   Row 1 (y=32):  Walk   — 32 frames (4 per direction × 8 directions)
 *   Row 2 (y=64):  Sprint — 32 frames (4 per direction × 8 directions)
 *   Row 3 (y=96):  Shoot  — 24 frames (3 per direction × 8 directions)
 *   Row 4 (y=128): Death  — 4 frames (direction-agnostic)
 *
 * Direction order: Down, Down-Left, Left, Up-Left, Up, Up-Right, Right, Down-Right
 */
export function createCommanderAnimations(scene: Phaser.Scene): void {
  const dirs = [
    'down',
    'down-left',
    'left',
    'up-left',
    'up',
    'up-right',
    'right',
    'down-right',
  ];

  // Idle: one frame per direction (row 0, frames 0-7)
  dirs.forEach((dir, i) => {
    scene.anims.create({
      key: `commander-idle-${dir}`,
      frames: [{ key: 'commander-sheet', frame: i }],
      frameRate: 1,
    });
  });

  // Walk: 4 frames per direction (row 1, starting at frame 32)
  dirs.forEach((dir, i) => {
    scene.anims.create({
      key: `commander-walk-${dir}`,
      frames: scene.anims.generateFrameNumbers('commander-sheet', {
        start: 32 + i * 4,
        end: 32 + i * 4 + 3,
      }),
      frameRate: 8,
      repeat: -1,
    });
  });

  // Sprint: 4 frames per direction (row 2, starting at frame 64)
  dirs.forEach((dir, i) => {
    scene.anims.create({
      key: `commander-sprint-${dir}`,
      frames: scene.anims.generateFrameNumbers('commander-sheet', {
        start: 64 + i * 4,
        end: 64 + i * 4 + 3,
      }),
      frameRate: 12,
      repeat: -1,
    });
  });

  // Shoot: 3 frames per direction (row 3, starting at frame 96)
  dirs.forEach((dir, i) => {
    scene.anims.create({
      key: `commander-shoot-${dir}`,
      frames: scene.anims.generateFrameNumbers('commander-sheet', {
        start: 96 + i * 3,
        end: 96 + i * 3 + 2,
      }),
      frameRate: 10,
      repeat: 0,
    });
  });

  // Death: 4 frames (row 4, starting at frame 128)
  scene.anims.create({
    key: 'commander-death',
    frames: scene.anims.generateFrameNumbers('commander-sheet', {
      start: 128,
      end: 131,
    }),
    frameRate: 6,
    repeat: 0,
  });
}
