import * as THREE from "three";
import { clamp, mulberry32, hashStringToSeed } from "./utils.js";

export class Entity {
  constructor({ THREE, scene, world, theme }){
    this.scene = scene;
    this.world = world;

    const seed = hashStringToSeed("ENTITY:"+theme);
    this.rng = mulberry32(seed);

    this.state = {
      active: false,
      stalking: true,
      anger: 0,
      danger: 0,
      lastWarp: 0,
      seenClues: 0
    };

    // “Silent chaser” design:
    // It doesn’t roar. It doesn’t sprint. It *repositions* in fog, learning your angles.
    // When close, it turns audio into pressure and makes corners “watch”.
    this.speed = 1.1;
    this.minDistance = 2.4;

    // body: tall, thin, low-detail (fog-friendly)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x060606,
      roughness: 0.35,
      metalness: 0.0,
      emissive: new THREE.Color(0x020202),
      emissiveIntensity: 0.6
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.65, 6, 10), mat);
    body.position.y = 1.25;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), mat);
    head.position.set(0, 2.28, 0);

    this.mesh = new THREE.Group();
    this.mesh.add(body);
    this.mesh.add(head);

    // “face” = slight specular glint plane
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.05,
        metalness: 0.0,
        transparent: true,
        opacity: 0.55
      })
    );
    face.position.set(0, 2.26, 0.26);
    this.mesh.add(face);

    // small cold light (barely visible)
    this.light = new THREE.PointLight(0xb9d4ff, 0.12, 6, 2.0);
    this.light.position.set(0, 2.0, 0);
    this.mesh.add(this.light);

    // start far away
    this.pos = new THREE.Vector3(30, 0, 30);
    this.mesh.position.copy(this.pos);

    scene.add(this.mesh);
  }

  onClueTaken(count){
    this.state.seenClues = count;
    // entity becomes more “real” as you learn more
    this.state.anger = clamp(this.state.anger + 0.22, 0, 1);
    if (count >= 1) this.state.active = true;
    // force a near warp sometimes
    this.state.lastWarp = 0;
  }

  getDangerLevel(){
    return this.state.danger;
  }

  _warpNearPlayer(playerPos){
    // place behind/side within fog ring
    const a = this.rng() * Math.PI * 2;
    const r = 9 + this.rng()*12;
    const x = playerPos.x + Math.cos(a)*r;
    const z = playerPos.z + Math.sin(a)*r;

    // avoid warping inside solids by resolving a bit
    const target = this.world.resolveCollision(new THREE.Vector3(x, 1.65, z), 0.8);
    this.pos.set(target.x, 0, target.z);
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
  }

  update(dt, playerPos){
    if (!this.state.active){
      this.state.danger = Math.max(0, this.state.danger - dt*0.15);
      return;
    }

    // warp occasionally if far, or after clue
    this.state.lastWarp += dt;
    const dist = this.pos.distanceTo(new THREE.Vector3(playerPos.x,0,playerPos.z));

    const warpInterval = 12 - this.state.seenClues*2.2; // gets more frequent
    if (this.state.lastWarp > Math.max(4.5, warpInterval) && (dist > 18 || this.rng() < 0.25*this.state.anger)){
      this._warpNearPlayer(playerPos);
      this.state.lastWarp = 0;
    }

    // slow pursuit (silent)
    const dir = new THREE.Vector3(playerPos.x - this.pos.x, 0, playerPos.z - this.pos.z);
    const d = dir.length();
    if (d > 1e-4) dir.multiplyScalar(1/d);

    const approach = clamp((this.state.anger*0.65 + 0.35), 0.35, 1.0);
    const sp = this.speed * approach;

    if (d > this.minDistance){
      this.pos.x += dir.x * sp * dt;
      this.pos.z += dir.z * sp * dt;
    }

    // face player
    const yaw = Math.atan2(playerPos.x - this.pos.x, playerPos.z - this.pos.z);
    this.mesh.rotation.y = yaw;

    // “breathing fog” visibility
    const vis = clamp(1.0 - (d/28), 0, 1);
    this.mesh.visible = (vis > 0.08) || (this.rng() < 0.02);
    this.light.intensity = 0.05 + 0.18*vis*this.state.anger;

    // danger curve
    const danger = clamp(1.0 - (d/10.5), 0, 1);
    this.state.danger = clamp(this.state.danger + (danger - this.state.danger)*dt*2.2, 0, 1);

    // if extremely close: force a reposition (avoid cheap jump scare)
    if (d < 1.9 && this.rng() < 0.35){
      this._warpNearPlayer(playerPos);
    }
  }
}

