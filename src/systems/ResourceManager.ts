import type { Building } from '../entities/Building';

/**
 * Manages the player's ore and energy resources, including
 * passive production tracking and offline decay.
 */
export class ResourceManager {
  ore: number = 200; // starting resources
  energy: number = 100;
  maxOre: number = 1000;
  maxEnergy: number = 500;

  // Track production rates for HUD display
  orePerMinute: number = 0;
  energyPerMinute: number = 0;

  /** Can the player afford a given cost? */
  canAfford(cost: { ore: number; energy: number }): boolean {
    return this.ore >= cost.ore && this.energy >= cost.energy;
  }

  /** Deduct cost. Returns false if insufficient funds. */
  spend(cost: { ore: number; energy: number }): boolean {
    if (!this.canAfford(cost)) return false;
    this.ore -= cost.ore;
    this.energy -= cost.energy;
    return true;
  }

  /** Add a resource by name (used by producing buildings). */
  add(resource: string, amount: number): void {
    switch (resource) {
      case 'ore':
        this.ore = Math.min(this.ore + amount, this.maxOre);
        break;
      case 'energy':
        this.energy = Math.min(this.energy + amount, this.maxEnergy);
        break;
    }
  }

  /**
   * Recalculate the per-minute production rates from all active buildings.
   * Call this whenever a building finishes construction or is destroyed.
   */
  updateProduction(buildings: Building[]): void {
    let oreRate = 0;
    let energyRate = 0;

    for (const b of buildings) {
      if (b.isConstructing || !b.active) continue;

      const produces = b.getProduces();
      if (!produces) continue;

      // Convert interval-based production to per-minute rate
      const perMinute = (produces.amount / produces.interval) * 60;

      if (produces.resource === 'ore') {
        oreRate += perMinute;
      } else if (produces.resource === 'energy') {
        energyRate += perMinute;
      }
    }

    this.orePerMinute = oreRate;
    this.energyPerMinute = energyRate;
  }

  /**
   * Apply offline resource decay: 1 % per hour, capped so the player
   * never drops below 50 of each resource.
   */
  applyOfflineDecay(offlineSeconds: number): void {
    const hours = offlineSeconds / 3600;
    const decayFactor = Math.pow(0.99, hours); // 1 % per hour compound

    this.ore = Math.max(50, Math.round(this.ore * decayFactor));
    this.energy = Math.max(50, Math.round(this.energy * decayFactor));
  }
}
