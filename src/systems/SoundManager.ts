export class SoundManager {
  private context!: AudioContext;
  private masterVolume!: GainNode;
  private enabled: boolean = true;
  private initialized: boolean = false;

  // Vehicle engine loop nodes
  private engineOsc: OscillatorNode | null = null;
  private engineLfo: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor() {
    // AudioContext is created lazily on first user interaction
  }

  private ensureContext(): boolean {
    if (!this.enabled) return false;

    if (!this.initialized) {
      try {
        this.context = new AudioContext();
        this.masterVolume = this.context.createGain();
        this.masterVolume.gain.value = 0.3;
        this.masterVolume.connect(this.context.destination);
        this.initialized = true;
      } catch {
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    return true;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.stopVehicleEngine();
      if (this.initialized) {
        this.masterVolume.gain.value = 0;
      }
    } else if (this.initialized) {
      this.masterVolume.gain.value = 0.3;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.initialized) {
      this.masterVolume.gain.value = clamped;
    }
  }

  // ── Noise helper ─────────────────────────────────────

  private createNoiseBuffer(duration: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private playNoise(
    duration: number,
    volume: number,
    filterType: BiquadFilterType,
    filterFreq: number,
    attackTime: number,
    decayTime: number
  ): void {
    const now = this.context.currentTime;

    const source = this.context.createBufferSource();
    source.buffer = this.createNoiseBuffer(duration);

    const filter = this.context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume);

    source.start(now);
    source.stop(now + duration);
  }

  private playTone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    startTime?: number,
    freqEnd?: number
  ): void {
    const now = startTime ?? this.context.currentTime;

    const osc = this.context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(freqEnd, 1),
        now + duration
      );
    }

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start(now);
    osc.stop(now + duration);
  }

  // ── Sound effects ────────────────────────────────────

  playPistolShot(): void {
    if (!this.ensureContext()) return;
    this.playNoise(0.05, 0.6, 'highpass', 3000, 0.003, 0.05);
  }

  playRifleShot(): void {
    if (!this.ensureContext()) return;
    this.playNoise(0.08, 0.5, 'bandpass', 2000, 0.003, 0.08);
  }

  playShotgunBlast(): void {
    if (!this.ensureContext()) return;
    // Fat noise burst with low-pass filter
    this.playNoise(0.12, 0.8, 'lowpass', 1500, 0.005, 0.12);
    // Sub-bass sine hit
    this.playTone(60, 0.15, 0.7, 'sine');
  }

  playExplosion(): void {
    if (!this.ensureContext()) return;
    const now = this.context.currentTime;

    // Low sine sweep 200Hz -> 40Hz
    this.playTone(200, 0.5, 0.8, 'sine', now, 40);

    // Noise burst with long decay
    const source = this.context.createBufferSource();
    source.buffer = this.createNoiseBuffer(0.6);

    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + 0.5);

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterVolume);

    source.start(now);
    source.stop(now + 0.6);
  }

  playEnemyDeath(): void {
    if (!this.ensureContext()) return;
    // Descending tone 400Hz -> 100Hz
    this.playTone(400, 0.15, 0.5, 'square', undefined, 100);
    // Short noise pop
    this.playNoise(0.06, 0.3, 'highpass', 1500, 0.005, 0.06);
  }

  playLootPickup(): void {
    if (!this.ensureContext()) return;
    const now = this.context.currentTime;
    // First note: 800Hz, 50ms
    this.playTone(800, 0.08, 0.4, 'sine', now);
    // Second note: 1200Hz, 80ms (starts after first)
    this.playTone(1200, 0.1, 0.4, 'sine', now + 0.06);
  }

  playBuildingPlace(): void {
    if (!this.ensureContext()) return;
    // Low square wave thunk
    this.playTone(150, 0.1, 0.6, 'square');
    // Click noise
    this.playNoise(0.03, 0.4, 'highpass', 2000, 0.002, 0.03);
  }

  playBuildingComplete(): void {
    if (!this.ensureContext()) return;
    const now = this.context.currentTime;
    // Ascending three-tone fanfare: 400 -> 600 -> 800
    this.playTone(400, 0.12, 0.4, 'sine', now);
    this.playTone(600, 0.12, 0.4, 'sine', now + 0.09);
    this.playTone(800, 0.15, 0.4, 'sine', now + 0.18);
  }

  playLevelUp(): void {
    if (!this.ensureContext()) return;
    const now = this.context.currentTime;
    // Ascending arpeggio with slight overlap: 500 -> 700 -> 900 -> 1200
    this.playTone(500, 0.1, 0.35, 'triangle', now);
    this.playTone(700, 0.1, 0.35, 'triangle', now + 0.05);
    this.playTone(900, 0.1, 0.35, 'triangle', now + 0.1);
    this.playTone(1200, 0.15, 0.4, 'triangle', now + 0.15);
  }

  playDamageTaken(): void {
    if (!this.ensureContext()) return;
    const now = this.context.currentTime;

    const osc = this.context.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 200;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    const distortion = this.context.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 10) * x / (Math.PI + 10 * Math.abs(x));
    }
    distortion.curve = curve;

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(this.masterVolume);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  playTurretShot(): void {
    if (!this.ensureContext()) return;
    this.playTone(1000, 0.03, 0.35, 'triangle');
  }

  playMiningStart(): void {
    if (!this.ensureContext()) return;
    const now = this.context.currentTime;

    // Sawtooth grinding at 80Hz
    const osc = this.context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 80;

    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.masterVolume);

    osc.start(now);
    osc.stop(now + 0.2);

    // Layered noise
    this.playNoise(0.2, 0.25, 'lowpass', 800, 0.02, 0.2);
  }

  playMiningComplete(): void {
    if (!this.ensureContext()) return;
    // Bright ding
    this.playTone(1000, 0.15, 0.4, 'sine');
  }

  playUIClick(): void {
    if (!this.ensureContext()) return;
    this.playTone(600, 0.02, 0.3, 'square');
  }

  playVehicleEnter(): void {
    if (!this.ensureContext()) return;
    // Descending tone 400->200Hz + click
    this.playTone(400, 0.1, 0.4, 'sine', undefined, 200);
    this.playNoise(0.02, 0.3, 'highpass', 3000, 0.002, 0.02);
  }

  playVehicleEngine(): void {
    if (!this.ensureContext()) return;
    // Don't start a second engine loop
    if (this.engineOsc) return;

    const now = this.context.currentTime;

    // Main engine oscillator
    this.engineOsc = this.context.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 60;

    // LFO for frequency wobble
    this.engineLfo = this.context.createOscillator();
    this.engineLfo.type = 'sine';
    this.engineLfo.frequency.value = 4; // 4Hz wobble

    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 5; // +/- 5Hz wobble depth

    this.engineLfo.connect(lfoGain);
    lfoGain.connect(this.engineOsc.frequency);

    // Gain for the engine sound
    this.engineGain = this.context.createGain();
    this.engineGain.gain.setValueAtTime(0, now);
    this.engineGain.gain.linearRampToValueAtTime(0.25, now + 0.1);

    // Low-pass filter to tame the sawtooth
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.masterVolume);

    this.engineOsc.start(now);
    this.engineLfo.start(now);
  }

  stopVehicleEngine(): void {
    if (!this.engineOsc || !this.initialized) return;

    const now = this.context.currentTime;

    // Fade out
    if (this.engineGain) {
      this.engineGain.gain.cancelScheduledValues(now);
      this.engineGain.gain.setValueAtTime(
        this.engineGain.gain.value,
        now
      );
      this.engineGain.gain.linearRampToValueAtTime(0, now + 0.1);
    }

    // Stop oscillators after fade
    const oscRef = this.engineOsc;
    const lfoRef = this.engineLfo;
    setTimeout(() => {
      try {
        oscRef.stop();
      } catch {
        // already stopped
      }
      try {
        lfoRef?.stop();
      } catch {
        // already stopped
      }
    }, 150);

    this.engineOsc = null;
    this.engineLfo = null;
    this.engineGain = null;
  }
}
