import { clamp } from "./utils.js";

export class AudioBus{
  constructor(){
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.noiseGain = null;
    this.drone = null;
    this.droneGain = null;
    this.stepOsc = null;

    this.enabled = false;
  }

  ensure(){
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    // noise
    this.noise = this._makeNoise();
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.0;
    this.noise.connect(this.noiseGain).connect(this.master);

    // drone
    this.drone = this.ctx.createOscillator();
    this.drone.type = "sine";
    this.drone.frequency.value = 48;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.drone.connect(this.droneGain).connect(this.master);
    this.drone.start();

    // subharmonic pulse
    const pulse = this.ctx.createOscillator();
    pulse.type = "triangle";
    pulse.frequency.value = 0.45;
    const pulseGain = this.ctx.createGain();
    pulseGain.gain.value = 0.06;
    pulse.connect(pulseGain).connect(this.master);
    pulse.start();
  }

  async enable(){
    this.ensure();
    if (this.ctx.state !== "running") await this.ctx.resume();
    this.enabled = true;
  }

  setTension(t){
    if (!this.enabled) return;
    t = clamp(t, 0, 1);
    this.noiseGain.gain.setTargetAtTime(0.02 + 0.14*t, this.ctx.currentTime, 0.12);
    this.droneGain.gain.setTargetAtTime(0.04 + 0.12*t, this.ctx.currentTime, 0.12);
    this.drone.frequency.setTargetAtTime(48 + 30*t, this.ctx.currentTime, 0.2);
  }

  radioBurst(){
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.noiseGain.gain.cancelScheduledValues(t);
    this.noiseGain.gain.setValueAtTime(0.22, t);
    this.noiseGain.gain.exponentialRampToValueAtTime(0.04, t + 0.6);
  }

  footstep(intensity=0.25){
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 120 + Math.random()*40;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    o.connect(g).connect(this.master);
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.06*intensity, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.stop(t + 0.14);
  }

  _makeNoise(){
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

    const white = this.ctx.createBufferSource();
    white.buffer = noiseBuffer;
    white.loop = true;

    // filter for “hiss”
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1100;

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5200;

    white.connect(hp).connect(lp);
    white.start();
    return lp;
  }
}
