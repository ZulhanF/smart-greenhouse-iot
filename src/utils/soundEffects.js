// Procedural Web Audio API sound generator for Greenhouse IoT
// Synthesizes natural rain droplet trickles (suara hujan gemercik) and rich wind breeze/gust sounds without external audio assets

class SoundEffectsEngine {
  constructor() {
    this.ctx = null;
    this.waterSource = null;
    this.waterGain = null;
    this.isWaterPlaying = false;
    this.windSource = null;
    this.windGain = null;
    this.isWindPlaying = false;
    this.muted = false;

    // Automatic audio context unlock on first user interaction in browser
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.init();
        if (this.ctx && this.ctx.state === 'running') {
          window.removeEventListener('pointerdown', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) {
      if (this.isWaterPlaying) {
        this.stopWater();
      }
      if (this.isWindPlaying) {
        this.stopWind();
      }
    }
  }

  // ==========================================
  // SUARA HUJAN & GEMERCIK AIR (WATER / RAIN)
  // Ketika pompa irigasi / misting aktif
  // ==========================================
  startWater() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.isWaterPlaying) return;

    try {
      const sampleRate = this.ctx.sampleRate;
      const duration = 3.5; // Seamless looping buffer of 3.5 seconds
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);

        // 1. Rain bed: filtered white & pink noise for steady rainfall atmosphere
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;

          // Organic gentle rain surge modulation
          const modulation = 0.82 + 0.18 * Math.sin((i / sampleRate) * 1.6 + channel * 1.5);
          data[i] = (pink * 0.038 + white * 0.018) * modulation;
        }

        // 2. High-density micro-droplets and splashing water (gemercik hujan & tetesan air)
        const dropCount = Math.floor(duration * 125);
        for (let d = 0; d < dropCount; d++) {
          const startSample = Math.floor(Math.random() * (bufferSize - Math.floor(sampleRate * 0.05)));
          const freq = 850 + Math.random() * 2350;
          const dropDurSec = 0.010 + Math.random() * 0.025;
          const dropSamples = Math.floor(dropDurSec * sampleRate);
          const dropAmp = 0.07 + Math.random() * 0.16;
          const decayRate = 120 + Math.random() * 140;
          const freqSlide = -80 - Math.random() * 320;

          for (let s = 0; s < dropSamples; s++) {
            const t = s / sampleRate;
            const currentFreq = Math.max(300, freq + freqSlide * (s / dropSamples));
            const env = Math.exp(-decayRate * t);
            const tone = Math.sin(2 * Math.PI * currentFreq * t);
            const click = (Math.random() * 2 - 1) * Math.exp(-t * 850) * 0.35;
            const val = (tone + click) * dropAmp * env;

            const idx = startSample + s;
            if (idx < bufferSize) {
              data[idx] += val;
            }
          }
        }
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // High-pass filter removes dull low-frequency mud
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(380, this.ctx.currentTime);

      // Peaking presence filter: boosts the crisp raindrop patter and gemercik clarity around 2.8 kHz
      const presenceFilter = this.ctx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.frequency.setValueAtTime(2800, this.ctx.currentTime);
      presenceFilter.gain.setValueAtTime(5.0, this.ctx.currentTime);
      presenceFilter.Q.setValueAtTime(1.1, this.ctx.currentTime);

      // Low-pass filter to keep sound warm and natural
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(8000, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.38, this.ctx.currentTime + 0.25);

      source.connect(highpass);
      highpass.connect(presenceFilter);
      presenceFilter.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();

      this.waterSource = source;
      this.waterGain = gain;
      this.isWaterPlaying = true;
    } catch (e) {
      console.warn('Audio rain/water sfx error:', e);
    }
  }

  stopWater() {
    if (!this.ctx || !this.isWaterPlaying) return;
    try {
      if (this.waterGain) {
        this.waterGain.gain.setValueAtTime(this.waterGain.gain.value, this.ctx.currentTime);
        this.waterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
      }
      const oldSource = this.waterSource;
      setTimeout(() => {
        try {
          if (oldSource) {
            oldSource.stop();
            oldSource.disconnect();
          }
        } catch {}
      }, 320);
      this.waterSource = null;
      this.isWaterPlaying = false;
    } catch {
      this.isWaterPlaying = false;
    }
  }

  // ==========================================
  // SUARA ANGIN SEPOI-SEPOI KONTINYU (GENTLE AMBIENT BREEZE)
  // Berhembus lembut & menenangkan saat ventilasi atap TERBUKA
  // ==========================================
  startWind() {
    if (this.muted) return;
    this.init();
    if (!this.ctx || this.isWindPlaying) return;

    try {
      const sampleRate = this.ctx.sampleRate;
      const duration = 5.0; // 5 second seamless gentle breeze loop
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;

          // Slow, peaceful breathing swell of gentle garden breeze
          const t = i / sampleRate;
          const swell = 0.76 + 0.24 * Math.sin(t * 1.15 + channel * 1.4);
          // Soft pink draft with subtle air whisper (sepoi-sepoi lembut)
          data[i] = (pink * 0.20 + white * 0.025) * swell;
        }
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // High-pass filter removes any sub-bass rumble
      const highpass = this.ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(140, this.ctx.currentTime);

      // Warm aerodynamic gentle body filter
      const bodyFilter = this.ctx.createBiquadFilter();
      bodyFilter.type = 'peaking';
      bodyFilter.frequency.setValueAtTime(520, this.ctx.currentTime);
      bodyFilter.gain.setValueAtTime(2.2, this.ctx.currentTime);
      bodyFilter.Q.setValueAtTime(0.9, this.ctx.currentTime);

      // Gentle mellow low-pass filter (cuts harsh hiss, keeping it soft & peaceful)
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(1900, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      // Soft ambient volume for relaxing background breeze
      gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.45);

      source.connect(highpass);
      highpass.connect(bodyFilter);
      bodyFilter.connect(lowpass);
      lowpass.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();

      this.windSource = source;
      this.windGain = gain;
      this.isWindPlaying = true;
    } catch (e) {
      console.warn('Audio gentle wind sfx error:', e);
    }
  }

  stopWind() {
    if (!this.ctx || !this.isWindPlaying) return;
    try {
      if (this.windGain) {
        this.windGain.gain.setValueAtTime(this.windGain.gain.value, this.ctx.currentTime);
        this.windGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
      }
      const oldSource = this.windSource;
      setTimeout(() => {
        try {
          if (oldSource) {
            oldSource.stop();
            oldSource.disconnect();
          }
        } catch {}
      }, 420);
      this.windSource = null;
      this.isWindPlaying = false;
    } catch {
      this.isWindPlaying = false;
    }
  }

  // ==========================================
  // DESAU ANGIN SEPOI-SEPOI LEMBUT (GENTLE BREEZE SWEEP)
  // Desau hembusan sepoi-sepoi alami, bukan angin kencang
  // ==========================================
  playWind(intensity = 0.5) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const duration = 2.0;
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = Math.floor(sampleRate * duration);
      const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

      const clampedIntensity = Math.max(0.2, Math.min(0.8, intensity));

      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          b6 = white * 0.115926;

          const t = i / sampleRate;
          // Smooth, soft bell curve for gentle breeze
          const gustEnv = Math.sin((t / duration) * Math.PI);
          data[i] = (pink * 0.24 + white * 0.03) * gustEnv;
        }
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;

      // Soft swept lowpass filter (keeps tones warm and mellow, no loud whistling)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.setValueAtTime(0.85, this.ctx.currentTime);

      const baseFreq = 240 + clampedIntensity * 80;
      const peakFreq = 480 + clampedIntensity * 180; // Gentle sweep to ~580Hz max

      filter.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(peakFreq, this.ctx.currentTime + 0.7);
      filter.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      // Gentle, soothing peak gain (sepoi-sepoi)
      const peakGain = 0.15 + clampedIntensity * 0.08; 
      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(peakGain, this.ctx.currentTime + 0.65);
      gain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();
      source.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio gentle breeze sfx error:', e);
    }
  }

  // Tactile click feedback for UI buttons
  playTactile(freq = 420, type = 'sine') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.07);
    } catch {}
  }
}

export const sfx = new SoundEffectsEngine();