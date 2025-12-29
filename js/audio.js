import { clamp } from "./utils.js";

export class AudioEngine {
  constructor(){
    this.ctx = null;
    this.master = null;

    this.noiseNode = null;
    this.noiseGain = null;

    this.droneOsc = null;
    this.droneGain = null;

    this.danger = 0;
    this.theme = "Foundation";

    this._started = false;
  }

  configureTheme(theme){
    this.theme = theme || "Foundation";
  }

  start(){
    if (this._started) return;
    this._started = true;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.65;
    this.master.connect(this.ctx.destination);

    // noise bed
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++){
      data[i] = (Math.random()*2 - 1) * 0.55;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 420;
    noiseFilter.Q.value = 0.7;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.02;

    noise.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
    noise.start();

    // drone
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = "sine";

    // theme -> slight pitch
    const base = 42 + (this._hashTheme(this.theme) % 18);
    this.droneOsc.frequency.value = base;

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 320;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.03;

    this.droneOsc.connect(droneFilter);
    droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.master);
    this.droneOsc.start();

    // gentle modulation
    this._tick();
  }

  setDanger(d){
    this.danger = clamp(d, 0, 1);
  }

  oneShot(type){
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    if (type === "beep"){
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(420, t+0.12);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.18);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t+0.2);
      return;
    }

    if (type === "thump"){
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(55, t+0.15);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t+0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.25);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t+0.3);
      return;
    }

    if (type === "buzz"){
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(180, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t+0.3);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t+0.35);
      return;
    }

    if (type === "whisper"){
      // quick filtered noise burst
      const src = this.ctx.createBufferSource();
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for(let i=0;i<len;i++){
        d[i] = (Math.random()*2 - 1) * (1 - i/len);
      }
      src.buffer = b;

      const f = this.ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 1200;

      const g = this.ctx.createGain();
      g.gain.value = 0.05;

      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
      return;
    }
  }

  _tick(){
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // danger -> more noise + higher bandpass + more drone volume
    const dn = this.danger;

    this.noiseGain.gain.setTargetAtTime(0.02 + dn*0.08, t, 0.08);
    this.droneGain.gain.setTargetAtTime(0.03 + dn*0.10, t, 0.08);

    const base = 42 + (this._hashTheme(this.theme) % 18);
    const bend = base + dn*22;
    this.droneOsc.frequency.setTargetAtTime(bend, t, 0.12);

    requestAnimationFrame(()=> this._tick());
  }

  _hashTheme(s){
    let h=0;
    for(let i=0;i<s.length;i++){
      h = ((h<<5)-h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }
}

