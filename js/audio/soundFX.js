/**
 * Procedural Web Audio API Sound Synthesizer - BolaBola Pro Edition
 * Menghasilkan efek audio game arcade, crowd cheer, peluit wasit, pantulan tiang metalik, dan getaran pegas.
 */
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.volume = 0.8;
    this.masterGain = null;
    this.ambienceSource = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    } catch (e) {
      console.warn('Web Audio API not supported on this device');
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  playKick(intensity = 1.0) {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(170 + intensity * 70, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

    gain.gain.setValueAtTime(0.45 * Math.min(intensity, 1.5), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  playBoing(pitch = 1.0) {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const baseFreq = 340 * pitch;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.22);

    mod.type = 'sine';
    mod.frequency.setValueAtTime(26, now);
    modGain.gain.setValueAtTime(45, now);
    modGain.gain.exponentialRampToValueAtTime(1, now + 0.25);

    mod.connect(osc.frequency);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    mod.start(now);
    osc.start(now);
    mod.stop(now + 0.3);
    osc.stop(now + 0.3);
  }

  playBounce() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /**
   * Efek Denting Tiang Gawang Logam (Metallic Post Clang)
   */
  playPostClang() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    // Frekuensi resonansi metalik
    const freqs = [880, 1320, 1760];

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.22 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.48);
    });
  }

  playZap() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.23);
  }

  playGoalHorn() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const freqs = [196, 246.94, 293.66, 392, 493.88];

    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.08 + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + 1.45);
    });

    this.playCrowdCheer();
  }

  playCrowdCheer() {
    if (this.isMuted || !this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.95 * b1 + white * 0.1;
        b2 = 0.85 * b2 + white * 0.25;
        data[i] = (b0 + b1 + b2) * 0.35;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(650, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.1);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      noise.start(now);
      noise.stop(now + 2.2);
    } catch (e) {}
  }

  playWhistle() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(2400, now);
    osc2.frequency.setValueAtTime(2580, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.42);
    osc2.stop(now + 0.42);
  }

  playTick() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain || this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  playSuddenDeath() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const freqs = [130.81, 155.56, 196.00];

    freqs.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.85);
    });
  }

  playBuffCollect() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);

      gain.gain.setValueAtTime(0.24, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.18);
    });
  }

  playBuffActivate() {
    if (this.isMuted || !this.ctx) return;
    this.resume();

    const now = this.ctx.currentTime;
    const chords = [392.00, 493.88, 587.33, 783.99]; // G chord power

    chords.forEach(freq => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 0.8, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.25, now + 0.35);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain || this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.52);
    });
  }

  triggerHaptic(duration = 25) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch (e) {}
    }
  }
}
