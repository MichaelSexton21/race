export class AudioFX {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
  }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.3;
    this.master.connect(this.ctx.destination);
  }
  beep(freq, dur = 0.12, type = 'square', vol = 0.5, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  countdown(go) {
    this.beep(go ? 880 : 440, go ? 0.45 : 0.16, 'square', 0.5);
  }
  item() {
    this.beep(660, 0.08);
    setTimeout(() => this.beep(990, 0.1), 80);
  }
  boost() {
    this.beep(220, 0.3, 'sawtooth', 0.5, 600);
  }
  slip() {
    this.beep(500, 0.25, 'sawtooth', 0.4, -320);
  }
  shieldPop() {
    this.beep(300, 0.2, 'sine', 0.5, 250);
  }
  finish() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.18, 'square', 0.4), i * 140));
  }
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 60;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    o.connect(f).connect(g).connect(this.master);
    o.start();
    this.engineOsc = o;
    this.engineGain = g;
  }
  setEngine(speed01, throttleOn) {
    if (!this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 170, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.025 + speed01 * 0.045 + (throttleOn ? 0.02 : 0), t, 0.1);
  }
  stopEngine() {
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }
}
