import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { clamp } from "./utils.js";

export class Player {
  constructor({ THREE, camera, domElement, world }){
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;

    this.controls = new PointerLockControls(camera, domElement);

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.position = new THREE.Vector3();

    this.move = { f:0, b:0, l:0, r:0, sprint:false };
    this.enabled = false;

    this.speedWalk = 3.2;
    this.speedSprint = 5.2;

    this.radius = 0.38;
    this.eyeHeight = 1.65;

    this._bind();
  }

  _bind(){
    const onKey = (e, v)=>{
      switch(e.code){
        case "KeyW": this.move.f = v; break;
        case "KeyS": this.move.b = v; break;
        case "KeyA": this.move.l = v; break;
        case "KeyD": this.move.r = v; break;
        case "ShiftLeft":
        case "ShiftRight": this.move.sprint = !!v; break;
      }
    };

    window.addEventListener("keydown", (e)=> onKey(e, 1));
    window.addEventListener("keyup", (e)=> onKey(e, 0));
  }

  enablePointerLock(){
    this.domElement.requestPointerLock?.();
    this.enabled = true;
  }

  disablePointerLock(){
    document.exitPointerLock?.();
    this.enabled = false;
  }

  teleport(pos, yaw=0){
    this.position.copy(pos);
    this.camera.position.copy(pos);
    this.camera.position.y = pos.y;
    this.camera.rotation.set(0, yaw, 0);
  }

  getPosition(){
    return this.position.clone();
  }

  update(dt){
    // pointer lock state
    const locked = document.pointerLockElement === this.domElement;
    if (!locked) {
      // keep camera aligned with last position
      this.camera.position.copy(this.position);
      this.camera.position.y = this.eyeHeight;
      return;
    }

    const speed = (this.move.sprint ? this.speedSprint : this.speedWalk);

    this.direction.set(
      this.move.r - this.move.l,
      0,
      this.move.b - this.move.f
    );

    if (this.direction.lengthSq() > 0){
      this.direction.normalize();
    }

    // move relative to camera yaw
    const yaw = this.camera.rotation.y;
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const dx = this.direction.x * cos - this.direction.z * sin;
    const dz = this.direction.x * sin + this.direction.z * cos;

    // acceleration
    const accel = 14.0;
    this.velocity.x += dx * accel * dt * speed;
    this.velocity.z += dz * accel * dt * speed;

    // damping
    const damping = 10.0;
    this.velocity.x *= Math.exp(-damping * dt);
    this.velocity.z *= Math.exp(-damping * dt);

    // step
    const next = this.position.clone();
    next.x += this.velocity.x * dt;
    next.z += this.velocity.z * dt;
    next.y = this.eyeHeight;

    // collision
    const resolved = this.world.resolveCollision(next, this.radius);
    this.position.copy(resolved);

    // apply
    this.camera.position.copy(this.position);
    this.camera.position.y = this.eyeHeight;

    // subtle head bob
    const moveAmt = clamp(Math.hypot(this.velocity.x, this.velocity.z) / 3.0, 0, 1);
    const t = performance.now() * 0.002;
    this.camera.position.y = this.eyeHeight + (Math.sin(t*6.5) * 0.03 * moveAmt);
  }
}

