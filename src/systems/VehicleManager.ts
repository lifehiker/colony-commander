import Phaser from 'phaser';
import { Rover } from '../entities/Rover';

export class VehicleManager {
  private scene: Phaser.Scene;
  private vehicles: Rover[] = [];
  private occupiedVehicle: Rover | null = null;
  private interactKey: Phaser.Input.Keyboard.Key | null = null;
  private interactCooldown: number = 0;

  // Reference to the commander sprite — set externally after construction
  private commander: Phaser.Physics.Arcade.Sprite | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Bind E key for enter/exit
    if (scene.input.keyboard) {
      this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    }
  }

  // ── Commander reference ──────────────────────────────────────

  setCommander(commander: Phaser.Physics.Arcade.Sprite): void {
    this.commander = commander;
  }

  // ── Vehicle registration ─────────────────────────────────────

  addVehicle(rover: Rover): void {
    this.vehicles.push(rover);
  }

  removeVehicle(rover: Rover): void {
    const idx = this.vehicles.indexOf(rover);
    if (idx !== -1) this.vehicles.splice(idx, 1);
    if (this.occupiedVehicle === rover) {
      this.occupiedVehicle = null;
    }
  }

  getVehicles(): Rover[] {
    return this.vehicles;
  }

  // ── Queries ──────────────────────────────────────────────────

  isInVehicle(): boolean {
    return this.occupiedVehicle !== null;
  }

  getOccupiedVehicle(): Rover | null {
    return this.occupiedVehicle;
  }

  findNearestVehicle(x: number, y: number): Rover | null {
    let nearest: Rover | null = null;
    let nearestDist = Infinity;

    for (const rover of this.vehicles) {
      if (rover.isOccupied) continue; // skip already-occupied vehicles
      const dist = Phaser.Math.Distance.Between(x, y, rover.x, rover.y);
      if (dist < nearestDist && rover.canInteract(x, y)) {
        nearest = rover;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  // ── Enter / Exit ─────────────────────────────────────────────

  tryEnterVehicle(commander: Phaser.Physics.Arcade.Sprite): boolean {
    if (this.occupiedVehicle) return false; // already in a vehicle

    const nearest = this.findNearestVehicle(commander.x, commander.y);
    if (!nearest) return false;

    // Enter the rover
    nearest.enter();
    this.occupiedVehicle = nearest;

    // Hide the commander
    commander.setVisible(false);
    (commander.body as Phaser.Physics.Arcade.Body).enable = false;

    this.scene.events.emit('vehicle-entered');
    return true;
  }

  tryExitVehicle(commander: Phaser.Physics.Arcade.Sprite): boolean {
    if (!this.occupiedVehicle) return false;

    const exitPos = this.occupiedVehicle.exit();
    this.occupiedVehicle = null;

    // Reposition and show the commander
    commander.setPosition(exitPos.x, exitPos.y);
    commander.setVisible(true);
    (commander.body as Phaser.Physics.Arcade.Body).enable = true;

    this.scene.events.emit('vehicle-exited');
    return true;
  }

  // ── Spawn helpers ────────────────────────────────────────────

  /**
   * Spawn rovers near a given position within a radius.
   * Returns the array of spawned rovers.
   */
  spawnRoversNear(x: number, y: number, count: number = 3, radius: number = 400): Rover[] {
    const spawned: Rover[] = [];
    const world = (this.scene as any).world;

    for (let i = 0; i < count; i++) {
      let rx = 0;
      let ry = 0;
      let found = false;

      // Try up to 10 positions to find valid ground
      for (let attempt = 0; attempt < 10; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * radius;
        rx = x + Math.cos(angle) * dist;
        ry = y + Math.sin(angle) * dist;

        if (world?.getTileAt) {
          const tileType = world.getTileAt(rx, ry);
          if (tileType === 'grass' || tileType === 'dirt') {
            found = true;
            break;
          }
        } else {
          found = true;
          break;
        }
      }

      if (found) {
        const rover = new Rover(this.scene, rx, ry);
        this.addVehicle(rover);
        spawned.push(rover);
      }
    }

    return spawned;
  }

  // ── Per-frame update ─────────────────────────────────────────

  update(time: number, delta: number): void {
    // Cooldown to prevent instant re-enter after exit
    if (this.interactCooldown > 0) {
      this.interactCooldown -= delta;
    }

    // Handle E key press
    if (
      this.interactKey &&
      Phaser.Input.Keyboard.JustDown(this.interactKey) &&
      this.commander &&
      this.interactCooldown <= 0
    ) {
      if (this.occupiedVehicle) {
        this.tryExitVehicle(this.commander);
        this.interactCooldown = 300; // 300ms cooldown
      } else {
        this.tryEnterVehicle(this.commander);
        this.interactCooldown = 300;
      }
    }

    // Update all vehicles
    for (const rover of this.vehicles) {
      rover.update(time, delta);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────

  destroy(): void {
    for (const rover of this.vehicles) {
      rover.destroy();
    }
    this.vehicles = [];
    this.occupiedVehicle = null;
  }
}
