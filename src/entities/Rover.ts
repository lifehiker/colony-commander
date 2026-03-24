import Phaser from 'phaser';
import { ROVER_SPEED } from '../config/GameConfig';

const ROVER_SPRINT_SPEED = 500;
const FUEL_DRAIN_NORMAL = 1;   // per second while moving
const FUEL_DRAIN_SPRINT = 2;   // per second while sprinting
const RUN_OVER_SPEED_THRESHOLD = 200;
const RUN_OVER_DAMAGE = 50;
const INTERACTION_RANGE = 60;
const MAX_FUEL = 100;
const ACCELERATION_LERP = 0.08;
const DECELERATION_LERP = 0.06;
const ROTATION_LERP = 0.12;

export class Rover extends Phaser.Physics.Arcade.Sprite {
  speed: number = ROVER_SPEED;
  isOccupied: boolean = false;
  fuel: number = MAX_FUEL;
  maxFuel: number = MAX_FUEL;
  interactionRange: number = INTERACTION_RANGE;

  private targetVelocityX: number = 0;
  private targetVelocityY: number = 0;
  private fuelBar: Phaser.GameObjects.Graphics | null = null;
  private fuelBarBg: Phaser.GameObjects.Graphics | null = null;
  private glowFx: Phaser.FX.Glow | null = null;
  private tireTrackEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'rover');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Larger collision body for run-over mechanic
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(40, 56);
    body.setOffset(4, 4);

    this.setDepth(5);

    this.createFuelBar();
    this.createTireTrackEmitter();
  }

  // ── Fuel bar ─────────────────────────────────────────────────

  private createFuelBar(): void {
    this.fuelBarBg = this.scene.add.graphics();
    this.fuelBarBg.setDepth(10);
    this.fuelBarBg.setVisible(false);

    this.fuelBar = this.scene.add.graphics();
    this.fuelBar.setDepth(11);
    this.fuelBar.setVisible(false);
  }

  private drawFuelBar(): void {
    if (!this.fuelBar || !this.fuelBarBg) return;

    const barWidth = 40;
    const barHeight = 5;
    const offsetY = -40;

    const bx = this.x - barWidth / 2;
    const by = this.y + offsetY;

    // Background
    this.fuelBarBg.clear();
    this.fuelBarBg.fillStyle(0x333333, 0.8);
    this.fuelBarBg.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

    // Fill
    const fuelPercent = Math.max(0, this.fuel / this.maxFuel);
    const fillColor = fuelPercent > 0.5 ? 0x00cc66 : fuelPercent > 0.2 ? 0xffaa00 : 0xff3333;

    this.fuelBar.clear();
    this.fuelBar.fillStyle(fillColor, 1);
    this.fuelBar.fillRect(bx, by, barWidth * fuelPercent, barHeight);
  }

  // ── Tire tracks ──────────────────────────────────────────────

  private createTireTrackEmitter(): void {
    // Only create if the scene has a particle texture available
    // We'll generate a tiny pixel texture on the fly
    const key = '__rover_tire_particle__';
    if (!this.scene.textures.exists(key)) {
      const g = this.scene.add.graphics();
      g.fillStyle(0x886644, 1);
      g.fillRect(0, 0, 2, 2);
      g.generateTexture(key, 2, 2);
      g.destroy();
    }

    this.tireTrackEmitter = this.scene.add.particles(0, 0, key, {
      speed: { min: 2, max: 8 },
      lifespan: 800,
      alpha: { start: 0.4, end: 0 },
      scale: { start: 1, end: 0.5 },
      frequency: 60,
      emitting: false,
    });
    this.tireTrackEmitter.setDepth(1);
  }

  // ── Enter / Exit ─────────────────────────────────────────────

  enter(): void {
    this.isOccupied = true;

    // Show fuel bar
    if (this.fuelBarBg) this.fuelBarBg.setVisible(true);
    if (this.fuelBar) this.fuelBar.setVisible(true);

    // Glow effect when occupied
    if (this.postFX) {
      this.glowFx = this.postFX.addGlow(0x44aaff, 2, 0, false, 0.1, 16);
    }
  }

  exit(): { x: number; y: number } {
    this.isOccupied = false;
    this.targetVelocityX = 0;
    this.targetVelocityY = 0;

    // Stop the rover
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Hide fuel bar
    if (this.fuelBarBg) this.fuelBarBg.setVisible(false);
    if (this.fuelBar) this.fuelBar.setVisible(false);

    // Remove glow
    if (this.glowFx && this.postFX) {
      this.postFX.remove(this.glowFx);
      this.glowFx = null;
    }

    // Stop tire tracks
    if (this.tireTrackEmitter) {
      this.tireTrackEmitter.emitting = false;
    }

    // Exit position: offset to the right of the rover
    const exitAngle = this.rotation - Math.PI / 2;
    return {
      x: this.x + Math.cos(exitAngle) * 50,
      y: this.y + Math.sin(exitAngle) * 50,
    };
  }

  // ── Driving ──────────────────────────────────────────────────

  drive(cursors: { up: boolean; down: boolean; left: boolean; right: boolean }, isSprinting: boolean): void {
    if (!this.isOccupied || this.fuel <= 0) {
      this.targetVelocityX = 0;
      this.targetVelocityY = 0;
      return;
    }

    const currentSpeed = isSprinting ? ROVER_SPRINT_SPEED : ROVER_SPEED;

    // Calculate target direction
    let dx = 0;
    let dy = 0;

    if (cursors.left) dx -= 1;
    if (cursors.right) dx += 1;
    if (cursors.up) dy -= 1;
    if (cursors.down) dy += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    this.targetVelocityX = dx * currentSpeed;
    this.targetVelocityY = dy * currentSpeed;
  }

  // ── Update loop ──────────────────────────────────────────────

  update(time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    if (this.isOccupied) {
      // Smooth acceleration/deceleration via lerp
      const lerpFactor = (this.targetVelocityX !== 0 || this.targetVelocityY !== 0)
        ? ACCELERATION_LERP
        : DECELERATION_LERP;

      const newVx = Phaser.Math.Linear(body.velocity.x, this.targetVelocityX, lerpFactor);
      const newVy = Phaser.Math.Linear(body.velocity.y, this.targetVelocityY, lerpFactor);

      body.setVelocity(newVx, newVy);

      // Smooth rotation toward movement direction
      const currentSpeed = Math.sqrt(newVx * newVx + newVy * newVy);
      if (currentSpeed > 10) {
        const targetAngle = Math.atan2(newVy, newVx);
        this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetAngle, ROTATION_LERP);
      }

      // Fuel drain
      const isMoving = currentSpeed > 10;
      if (isMoving) {
        const isSprinting = currentSpeed > ROVER_SPEED + 20;
        const drainRate = isSprinting ? FUEL_DRAIN_SPRINT : FUEL_DRAIN_NORMAL;
        this.fuel -= drainRate * (delta / 1000);
        this.fuel = Math.max(0, this.fuel);

        // Stop if out of fuel
        if (this.fuel <= 0) {
          this.targetVelocityX = 0;
          this.targetVelocityY = 0;
          body.setVelocity(0, 0);
        }
      }

      // Update fuel bar
      this.drawFuelBar();

      // Tire track particles
      if (this.tireTrackEmitter) {
        if (isMoving) {
          this.tireTrackEmitter.emitting = true;
          this.tireTrackEmitter.setPosition(this.x, this.y);
        } else {
          this.tireTrackEmitter.emitting = false;
        }
      }
    } else {
      // When unoccupied, slow to a stop (in case of residual velocity)
      body.setVelocity(
        Phaser.Math.Linear(body.velocity.x, 0, DECELERATION_LERP),
        Phaser.Math.Linear(body.velocity.y, 0, DECELERATION_LERP),
      );
    }
  }

  // ── Interaction check ────────────────────────────────────────

  canInteract(playerX: number, playerY: number): boolean {
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    return dist <= this.interactionRange;
  }

  // ── Run-over damage ──────────────────────────────────────────

  getRunOverDamage(): number {
    if (!this.isOccupied) return 0;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
    return speed > RUN_OVER_SPEED_THRESHOLD ? RUN_OVER_DAMAGE : 0;
  }

  // ── Cleanup ──────────────────────────────────────────────────

  destroy(fromScene?: boolean): void {
    if (this.fuelBar) this.fuelBar.destroy();
    if (this.fuelBarBg) this.fuelBarBg.destroy();
    if (this.tireTrackEmitter) this.tireTrackEmitter.destroy();
    super.destroy(fromScene);
  }
}
