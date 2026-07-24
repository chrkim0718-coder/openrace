// Web Audio API Engine & Ambience Synthesizer (0 external audio files needed!)
import type { WeatherMode } from '@/types/game';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private turboOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private turboGain: GainNode | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private muted = true;
  private initialized = false;

  public init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Master Engine Gain
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);

      // Main V8 Sawtooth Oscillator
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(50, this.ctx.currentTime);

      // Deep Sub-Bass Rumble
      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.setValueAtTime(32, this.ctx.currentTime);

      // Low-pass Filter for Realistic Exhaust Tone
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, this.ctx.currentTime);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      this.subOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
      this.subOsc.start();

      // Turbo Whistle Synthesizer
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.turboOsc = this.ctx.createOscillator();
      this.turboOsc.type = 'sine';
      this.turboOsc.frequency.setValueAtTime(1400, this.ctx.currentTime);

      const turboFilter = this.ctx.createBiquadFilter();
      turboFilter.type = 'bandpass';
      turboFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);
      turboFilter.Q.setValueAtTime(4, this.ctx.currentTime);

      this.turboOsc.connect(turboFilter);
      turboFilter.connect(this.turboGain);
      this.turboGain.connect(this.ctx.destination);
      this.turboOsc.start();

      // Weather Ambience Noise Generator
      this.initWeatherNoise();

      this.initialized = true;
    } catch (err) {
      console.warn('AudioEngine init error:', err);
    }
  }

  private initWeatherNoise() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, this.ctx.currentTime);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.noiseNode.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.ctx.destination);
    this.noiseNode.start();
  }

  public update(speedKmH: number, isTurbo: boolean) {
    if (!this.initialized || !this.ctx || this.muted) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const absSpeed = Math.abs(speedKmH);
    const speedRatio = Math.min(1.0, absSpeed / 400);

    // Engine Pitch: 45Hz at 0km/h up to 340Hz at 400km/h
    const targetEngineFreq = 45 + speedRatio * 295;
    const targetSubFreq = 30 + speedRatio * 150;
    const targetVolume = Math.min(0.25, 0.08 + speedRatio * 0.17);

    const now = this.ctx.currentTime;
    this.engineOsc?.frequency.setTargetAtTime(targetEngineFreq, now, 0.05);
    this.subOsc?.frequency.setTargetAtTime(targetSubFreq, now, 0.05);
    this.engineGain?.gain.setTargetAtTime(targetVolume, now, 0.05);

    // Turbo whistle sound
    if (isTurbo) {
      const turboFreq = 1600 + speedRatio * 1800;
      this.turboOsc?.frequency.setTargetAtTime(turboFreq, now, 0.03);
      this.turboGain?.gain.setTargetAtTime(0.12, now, 0.05);
    } else {
      this.turboGain?.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  public setWeather(weather: WeatherMode) {
    if (!this.initialized || !this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (weather === 'rain' || weather === 'snow') {
      this.noiseGain?.gain.setTargetAtTime(0.06, now, 0.2);
    } else {
      this.noiseGain?.gain.setTargetAtTime(0, now, 0.3);
    }
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    if (!this.initialized && !this.muted) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume();
    }

    if (this.muted && this.ctx) {
      const now = this.ctx.currentTime;
      this.engineGain?.gain.setTargetAtTime(0, now, 0.05);
      this.turboGain?.gain.setTargetAtTime(0, now, 0.05);
      this.noiseGain?.gain.setTargetAtTime(0, now, 0.05);
    }
    return this.muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }
}

export const audioEngine = new AudioEngine();
