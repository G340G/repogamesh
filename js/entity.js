import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { clamp, lerp } from "./utils.js";

export class Entity{
  constructor(scene){
    this.scene = scene;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // silhouette mesh (cheap geometry but eerie in fog)
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0c0b0a,
      roughness: 0.95,
      metalness: 0.0,
      emissive: 0x000000
    });

    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.35, 6, 10), mat);
    body.position.y = 1.35;
    body.castShadow = true;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat);
    head.position.y = 2.22;
    head.castShadow = true;

    // "sutures" — thin emissive seams that flicker subtly
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0x1a1510,
      roughness: 0.2,
      metalness: 0.0,
      emissive: 0x2a1b12,
      emissiveIntensity: 0.65
    });
    const seam = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.01, 6, 18), seamMat);
    seam.rotation.x = Math.PI/2;
    seam.position.y = 2.0;

    this.group.add(body, head, seam);

    this.pos = this.group.position;
    this.pos.set(999, 0, 999);
    this.target = new THREE.Vector3(0,0,0);

    this.active = false;
    this.seen = false;

    this.distanceBand = 14;        // preferred stalking distance
    this.teleportBand = 28;        // if too far, reposition
    this.caughtBand = 2.2;

    this.speed = 1.35;
    this.repositionCooldown = 0;

    this._flicker = 0;
  }

  spawnNear(playerPos, dirForward){
    // spawn behind and offset
    const behind = dirForward.clone().multiplyScalar(-1);
    const off = new THREE.Vector3(-behind.z, 0, behind.x).multiplyScalar((Math.random()*2-1) * 6);
    const p = playerPos.clone().add(behind.multiplyScalar(18)).add(off);
    this.pos.set(p.x, 0, p.z);
    this.active = true;
    this.seen = false;
  }

  update(dt, player, world, audio){
    if (!this.active) return { tension:0, caught:false };

    // line of sight (very rough): if within range and entity inside view cone
    const p = player.position.clone();
    const e = this.pos.clone();
    const toE = e.clone().sub(p);
    const dist = toE.length();

    // your breath & fear rise as it gets closer
    const tension = clamp(1 - (dist / 26), 0, 1);

    // Try to keep it in fog: if too close and visible, drift sideways
    const forward = new THREE.Vector3(0,0,-1).applyQuaternion(player.camera.quaternion);
    forward.y = 0; forward.normalize();

    // "heard you" factor: sprinting makes it bolder
    const running = (player.breath < 0.8) && (player.keys?.has?.("ShiftLeft") || player.keys?.has?.("ShiftRight"));
    const bold = running ? 1.35 : 1.0;

    // reposition logic: if too far or stuck, teleport behind fog line (but never right on top)
    this.repositionCooldown = Math.max(0, this.repositionCooldown - dt);

    if (dist > this.teleportBand && this.repositionCooldown <= 0){
      const behind = forward.clone().multiplyScalar(-1);
      const side = new THREE.Vector3(-behind.z, 0, behind.x).multiplyScalar((Math.random()*2-1) * 10);
      const target = p.clone().add(behind.multiplyScalar(20 + Math.random()*10)).add(side);
      world.projectToTownBounds(target);
      this.pos.set(target.x, 0, target.z);
      this.repositionCooldown = 4.5 + Math.random()*3.0;
      audio?.radioBurst();
    }

    // stalking movement: circle and close slowly
    const desired = p.clone().add(toE.clone().normalize().multiplyScalar(-this.distanceBand));
    world.projectToTownBounds(desired);

    // add subtle orbit
    const orbit = new THREE.Vector3(-toE.z, 0, toE.x).normalize().multiplyScalar(Math.sin(performance.now()*0.00025)*4.0);
    desired.add(orbit);

    // steer
    this.target.lerp(desired, clamp(dt*0.6, 0, 1));
    const step = this.target.clone().sub(this.pos);
    step.y = 0;
    const stepLen = step.length();
    if (stepLen > 0.001){
      step.normalize();
      const v = this.speed * bold;
      this.pos.x += step.x * v * dt;
      this.pos.z += step.z * v * dt;
    }

    // face player
    this.group.lookAt(p.x, 1.7, p.z);

    // flicker seams
    this._flicker = lerp(this._flicker, 0.35 + 0.65*tension, 1 - Math.exp(-dt*2.0));
    const seam = this.group.children[2];
    seam.material.emissiveIntensity = 0.35 + this._flicker*0.9;

    // caught
    if (dist < this.caughtBand){
      return { tension:1, caught:true };
    }

    return { tension, caught:false };
  }
}
