import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { clamp } from "./utils.js";

export class Player{
  constructor(camera, controls){
    this.camera = camera;
    this.controls = controls;

    this.vel = new THREE.Vector3();
    this.dir = new THREE.Vector3();

    this.breath = 1.0;   // stamina
    this.fear = 0.0;

    this.speedWalk = 3.2;
    this.speedRun = 5.1;
    this.drag = 8.0;

    this.keys = new Set();
    this.onGround = true;

    this._stepTimer = 0;
  }

  setSensitivity(mult){
    this.controls.pointerSpeed = mult;
  }

  handleKey(e, down){
    const k = e.code;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  get position(){
    return this.controls.getObject().position;
  }

  update(dt, audio){
    const forward = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);
    const strafe  = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);

    const sprint = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const wantsRun = sprint && this.breath > 0.08;

    const speed = wantsRun ? this.speedRun : this.speedWalk;

    // stamina drain/regen
    if (wantsRun && (forward !== 0 || strafe !== 0)){
      this.breath = clamp(this.breath - dt*0.28, 0, 1);
    } else {
      this.breath = clamp(this.breath + dt*0.18, 0, 1);
    }

    this.dir.set(strafe, 0, forward);
    if (this.dir.lengthSq() > 0) this.dir.normalize();

    // convert to world direction
    const obj = this.controls.getObject();
    const yaw = obj.rotation.y;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const dx = this.dir.x * cos - this.dir.z * sin;
    const dz = this.dir.x * sin + this.dir.z * cos;

    const accel = 18.0;
    this.vel.x += dx * accel * dt;
    this.vel.z += dz * accel * dt;

    // drag
    this.vel.x -= this.vel.x * this.drag * dt;
    this.vel.z -= this.vel.z * this.drag * dt;

    // clamp velocity
    const maxV = speed;
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (hv > maxV){
      const s = maxV / hv;
      this.vel.x *= s;
      this.vel.z *= s;
    }

    // move
    obj.position.x += this.vel.x * dt;
    obj.position.z += this.vel.z * dt;

    // keep camera height stable (simple ground lock; world is mostly flat + slight noise)
    obj.position.y = 1.7;

    // footsteps
    const moving = hv > 0.45;
    if (moving){
      this._stepTimer -= dt * (wantsRun ? 1.8 : 1.0);
      if (this._stepTimer <= 0){
        this._stepTimer = wantsRun ? 0.28 : 0.42;
        audio?.footstep(wantsRun ? 0.9 : 0.55);
      }
    } else {
      this._stepTimer = 0;
    }
  }
}
