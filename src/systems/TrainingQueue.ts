import { UNIT_TYPES } from '../entities/FriendlyUnit';

export interface TrainingJob {
  unitType: string;
  buildingId: string;
  progress: number; // 0 to 1
  totalTime: number; // seconds
}

export class TrainingQueue {
  private queue: TrainingJob[] = [];
  private maxQueueSize: number = 5;

  // -------------------------------------------------------------------
  // Enqueue a new training job
  // -------------------------------------------------------------------
  enqueue(unitType: string, buildingId: string): boolean {
    if (this.queue.length >= this.maxQueueSize) return false;

    const config = UNIT_TYPES[unitType];
    if (!config) return false;

    this.queue.push({
      unitType,
      buildingId,
      progress: 0,
      totalTime: config.trainingTime,
    });

    return true;
  }

  // -------------------------------------------------------------------
  // Update training progress. Returns completed unit types this frame.
  // -------------------------------------------------------------------
  update(delta: number): string[] {
    const completed: string[] = [];

    if (this.queue.length === 0) return completed;

    // Only the first job in the queue progresses (serial training)
    const job = this.queue[0];
    const deltaSeconds = delta / 1000;
    job.progress += deltaSeconds / job.totalTime;

    if (job.progress >= 1) {
      job.progress = 1;
      completed.push(job.unitType);
      this.queue.shift();
    }

    return completed;
  }

  // -------------------------------------------------------------------
  // Get current queue for UI display
  // -------------------------------------------------------------------
  getQueue(): TrainingJob[] {
    return [...this.queue];
  }

  // -------------------------------------------------------------------
  // Cancel a specific job by index
  // -------------------------------------------------------------------
  cancel(index: number): void {
    if (index >= 0 && index < this.queue.length) {
      this.queue.splice(index, 1);
    }
  }

  // -------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------
  getQueueSize(): number {
    return this.queue.length;
  }

  getMaxQueueSize(): number {
    return this.maxQueueSize;
  }

  setMaxQueueSize(max: number): void {
    this.maxQueueSize = max;
  }

  isTraining(): boolean {
    return this.queue.length > 0;
  }

  /** Get the currently active training job, or null if idle. */
  getCurrentJob(): TrainingJob | null {
    return this.queue.length > 0 ? { ...this.queue[0] } : null;
  }
}
