import Phaser from 'phaser';
import { FriendlyUnit, type UnitCommand } from '../entities/FriendlyUnit';

export class UnitManager {
  private scene: Phaser.Scene;
  private units: FriendlyUnit[] = [];
  private maxUnits: number = 10;
  private unitGroup: Phaser.Physics.Arcade.Group;

  // Input tracking
  private ctrlKey: Phaser.Input.Keyboard.Key | null = null;
  private keyF: Phaser.Input.Keyboard.Key | null = null;
  private keyG: Phaser.Input.Keyboard.Key | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.unitGroup = scene.physics.add.group({
      collideWorldBounds: false,
      runChildUpdate: false, // we update manually for control over arguments
    });

    // Keyboard bindings
    if (scene.input.keyboard) {
      this.ctrlKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL);
      this.keyF = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
      this.keyG = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    }

    // Right-click handler
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        this.handleRightClick(worldX, worldY);
      }
    });

    // Disable context menu so right-click works in-game
    scene.game.canvas.addEventListener('contextmenu', (e: Event) => {
      e.preventDefault();
    });
  }

  // -------------------------------------------------------------------
  // Spawn a new unit at position
  // -------------------------------------------------------------------
  spawnUnit(x: number, y: number, type: string): FriendlyUnit | null {
    if (this.units.length >= this.maxUnits) return null;

    const unit = new FriendlyUnit(this.scene, x, y, type);
    this.unitGroup.add(unit);
    this.units.push(unit);

    return unit;
  }

  // -------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------
  setAllCommand(command: UnitCommand, position?: { x: number; y: number }): void {
    for (const unit of this.units) {
      if (!unit.active) continue;
      unit.setCommand(command, position);
    }
  }

  setSelectedCommand(
    selected: FriendlyUnit[],
    command: UnitCommand,
    position?: { x: number; y: number },
  ): void {
    for (const unit of selected) {
      if (!unit.active) continue;
      unit.setCommand(command, position);
    }
  }

  // -------------------------------------------------------------------
  // Update all units
  // -------------------------------------------------------------------
  update(
    time: number,
    delta: number,
    commanderX: number,
    commanderY: number,
    enemies: Phaser.Physics.Arcade.Group,
  ): void {
    // Handle hotkeys
    this.handleHotkeys();

    // Clean up dead units
    this.units = this.units.filter((u) => u.active);

    // Update each living unit
    for (const unit of this.units) {
      if (!unit.active) continue;
      unit.update(time, delta, commanderX, commanderY, enemies);
    }
  }

  // -------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------
  getUnits(): Phaser.Physics.Arcade.Group {
    return this.unitGroup;
  }

  getUnitCount(): number {
    return this.units.filter((u) => u.active).length;
  }

  getMaxUnits(): number {
    return this.maxUnits;
  }

  setMaxUnits(max: number): void {
    this.maxUnits = max;
  }

  getAliveUnits(): FriendlyUnit[] {
    return this.units.filter((u) => u.active);
  }

  // -------------------------------------------------------------------
  // Right-click: guard position / patrol point
  // -------------------------------------------------------------------
  handleRightClick(worldX: number, worldY: number): void {
    const isCtrl = this.ctrlKey?.isDown ?? false;
    const position = { x: worldX, y: worldY };

    if (isCtrl) {
      // CTRL + right-click: add patrol point
      for (const unit of this.units) {
        if (!unit.active) continue;
        // If not already patrolling, start patrol with current position as first point
        if (unit.command !== 'patrol') {
          unit.patrolPoints = [{ x: unit.x, y: unit.y }];
          unit.setCommand('patrol', position);
        } else {
          // Add to existing patrol route
          unit.patrolPoints.push(position);
        }
      }
    } else {
      // Right-click: move and guard position
      this.setAllCommand('guard', position);
    }
  }

  // -------------------------------------------------------------------
  // Hotkeys
  // -------------------------------------------------------------------
  private handleHotkeys(): void {
    // F: all units attack mode
    if (this.keyF && Phaser.Input.Keyboard.JustDown(this.keyF)) {
      this.setAllCommand('attack');
    }

    // G: all units follow commander
    if (this.keyG && Phaser.Input.Keyboard.JustDown(this.keyG)) {
      this.setAllCommand('follow');
    }
  }

  // -------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------
  destroy(): void {
    for (const unit of this.units) {
      if (unit.active) unit.destroy();
    }
    this.units = [];
    this.unitGroup.destroy(true);
  }
}
