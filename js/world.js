import * as THREE from "three";
import { clamp, hashStringToSeed, mulberry32, smoothstep } from "./utils.js";

function makeCanvasTex(drawFn, size=512){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  drawFn(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function desaturateTint(ctx, w, h, tint="#a7926a"){
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = tint;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(0,0,w,h);
  ctx.restore();
}

function groundTexture(seed){
  const rng = mulberry32(seed);
  return makeCanvasTex((ctx, S)=>{
    ctx.fillStyle = "#101010";
    ctx.fillRect(0,0,S,S);

    // dirt layers
    for(let i=0;i<18000;i++){
      const x = rng()*S, y = rng()*S;
      const a = rng();
      const r = 0.5 + rng()*1.8;
      const g = ctx.createRadialGradient(x,y,0,x,y,r*3);
      const base = 18 + Math.floor(rng()*26);
      g.addColorStop(0, `rgba(${base},${base-2},${base-3},${0.22*a})`);
      g.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x,y,r*3,0,Math.PI*2);
      ctx.fill();
    }

    // cracks
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1;
    for(let i=0;i<240;i++){
      let x = rng()*S, y = rng()*S;
      ctx.beginPath();
      ctx.moveTo(x,y);
      const steps = 8 + Math.floor(rng()*16);
      for(let k=0;k<steps;k++){
        x += (rng()-0.5)*36;
        y += (rng()-0.5)*36;
        ctx.lineTo(x,y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    desaturateTint(ctx,S,S,"#c2a57a");
  }, 512);
}

function wallTexture(seed, motifText=""){
  const rng = mulberry32(seed);
  return makeCanvasTex((ctx, S)=>{
    ctx.fillStyle = "#23201b";
    ctx.fillRect(0,0,S,S);

    // plaster
    for(let i=0;i<12000;i++){
      const x = rng()*S, y = rng()*S;
      const w = 1+rng()*3, h = 1+rng()*3;
      const v = 26 + Math.floor(rng()*40);
      ctx.fillStyle = `rgba(${v},${v-2},${v-6},${0.10 + rng()*0.18})`;
      ctx.fillRect(x,y,w,h);
    }

    // stains
    for(let i=0;i<90;i++){
      const x = rng()*S, y = rng()*S;
      const r = 30 + rng()*90;
      const g = ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0, `rgba(10,10,10,${0.30 + rng()*0.25})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fill();
    }

    // faint “text imprint”
    if (motifText){
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#f2ead8";
      ctx.font = "28px ui-monospace, Menlo, Consolas, monospace";
      for(let y=34;y<S;y+=48){
        const line = motifText.slice(0, 44);
        ctx.fillText(line, 16 + rng()*18, y);
      }
      ctx.restore();
    }

    desaturateTint(ctx,S,S,"#b79a6b");
  }, 512);
}

function roadTexture(seed){
  const rng = mulberry32(seed);
  return makeCanvasTex((ctx, S)=>{
    ctx.fillStyle = "#151515";
    ctx.fillRect(0,0,S,S);

    // asphalt speckle
    for(let i=0;i<24000;i++){
      const x=rng()*S, y=rng()*S;
      const v = 20 + Math.floor(rng()*30);
      ctx.fillStyle = `rgba(${v},${v},${v},${0.12 + rng()*0.22})`;
      ctx.fillRect(x,y,1,1);
    }

    // worn center line
    ctx.save();
    ctx.translate(S/2, 0);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#d4cbb4";
    for(let y=0; y<S; y+=48){
      const h = 22 + rng()*8;
      ctx.fillRect(-5, y, 10, h);
    }
    ctx.restore();

    desaturateTint(ctx,S,S,"#a0a0a0");
  }, 512);
}

function makeFogBillboards({ seed, count=90, area=140 }){
  const rng = mulberry32(seed);
  const group = new THREE.Group();

  const tex = makeCanvasTex((ctx,S)=>{
    ctx.clearRect(0,0,S,S);
    const g = ctx.createRadialGradient(S/2,S/2, 0, S/2,S/2, S*0.48);
    g.addColorStop(0, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(S/2,S/2,S*0.48,0,Math.PI*2);
    ctx.fill();
  }, 256);

  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: 0xb7c2cf,
    transparent: true,
    opacity: 0.12,
    depthWrite: false
  });

  for(let i=0;i<count;i++){
    const s = new THREE.Sprite(mat.clone());
    s.position.set((rng()-0.5)*area, 1.2 + rng()*6.5, (rng()-0.5)*area);
    const sc = 14 + rng()*28;
    s.scale.set(sc, sc, 1);
    s.material.opacity = 0.07 + rng()*0.10;
    s.userData.drift = { a: rng()*Math.PI*2, r: 0.3 + rng()*0.9, sp: 0.08 + rng()*0.18 };
    group.add(s);
  }

  group.userData.isFog = true;
  return group;
}

function makeTree(seed){
  const rng = mulberry32(seed);
  const g = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 2.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.95, metalness: 0.0 })
  );
  trunk.position.y = 1.1;
  g.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.9 + rng()*0.35, 2.1 + rng()*0.8, 7),
    new THREE.MeshStandardMaterial({ color: 0x0f1412, roughness: 1.0, metalness: 0.0 })
  );
  crown.position.y = 2.4 + rng()*0.2;
  crown.rotation.y = rng()*Math.PI;
  g.add(crown);

  g.userData.isTree = true;
  return g;
}

function makeHouse({ seed, themeText }){
  const rng = mulberry32(seed);
  const group = new THREE.Group();

  const wallTex = wallTexture(seed+11, themeText);
  const matWall = new THREE.MeshStandardMaterial({
    map: wallTex,
    roughness: 0.98,
    metalness: 0.0
  });

  const matRoof = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.95,
    metalness: 0.0
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 5.6, 8), matWall);
  base.position.set(0, 2.8, 0);
  group.add(base);

  const annex = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.6, 4.5), matWall);
  annex.position.set(6.2, 1.8, 2.0);
  group.add(annex);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.6, 4), matRoof);
  roof.position.set(0, 6.5, 0);
  roof.rotation.y = Math.PI*0.25;
  group.add(roof);

  // windows (dark voids)
  const winMat = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 1.0 });
  for(let i=0;i<10;i++){
    const w = 0.9 + rng()*0.6;
    const h = 1.1 + rng()*0.7;
    const win = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), winMat);
    const side = rng() < 0.5 ? -1 : 1;
    win.position.set(side*4.9 + (side*0.06), 2.0 + rng()*2.5, -2.8 + rng()*5.6);
    win.rotation.y = side > 0 ? Math.PI/2 : -Math.PI/2;
    group.add(win);
  }

  // door interactable
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), new THREE.MeshStandardMaterial({
    color: 0x0b0b0b,
    roughness: 0.9
  }));
  door.position.set(5.01, 1.1, -0.6);
  door.rotation.y = Math.PI/2;
  door.userData = {
    kind: "door",
    locked: true,
    open: false
  };
  group.add(door);

  // faint interior light leak
  const leak = new THREE.PointLight(0xffd7a3, 0.35, 7, 2.0);
  leak.position.set(2.0, 2.2, 0.0);
  leak.userData.flicker = true;
  group.add(leak);

  group.userData.isHouse = true;
  group.userData.door = door;

  return group;
}

function makeClue({ seed, title, body }){
  const rng = mulberry32(seed);
  const g = new THREE.Group();

  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.55),
    new THREE.MeshStandardMaterial({
      color: 0xd8d0be,
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide
    })
  );
  paper.rotation.x = -Math.PI/2;
  paper.position.y = 0.03;
  g.add(paper);

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 })
  );
  marker.position.set(0.22, 0.05, 0.15);
  g.add(marker);

  g.position.y = 0.03;
  g.rotation.y = rng()*Math.PI;

  g.userData = {
    kind: "clue",
    title,
    body,
    used: false
  };

  return g;
}

function makeTerminal(){
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.9 })
  );
  base.position.y = 0.55;
  g.add(base);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.65, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0x0b1012,
      roughness: 0.7,
      emissive: new THREE.Color(0x0c1f22),
      emissiveIntensity: 0.9
    })
  );
  screen.position.set(0, 0.76, 0.26);
  g.add(screen);

  const glow = new THREE.PointLight(0x86d7e2, 0.25, 5.0, 2.0);
  glow.position.set(0, 0.8, 0.5);
  g.add(glow);

  g.userData = { kind: "terminal" };
  return g;
}

export async function buildWorld({ THREE, scene, themePackage }){
  const seed = hashStringToSeed(themePackage.theme || "FOUNDATION");
  const rng = mulberry32(seed);

  const world = {
    seed,
    rng,
    interactables: [],
    solids: [],
    spawn: { position: new THREE.Vector3(0, 1.7, 22), yaw: Math.PI },
    deepZone: { center: new THREE.Vector3(-36, 0, -44), r: 9.0 },
    doorRef: null,
    fogGroup: null,
  };

  // ground
  const gTex = groundTexture(seed);
  gTex.repeat.set(14, 14);
  const groundMat = new THREE.MeshStandardMaterial({
    map: gTex,
    roughness: 1.0,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220, 1, 1), groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = false;
  scene.add(ground);

  // road
  const rTex = roadTexture(seed+3);
  rTex.repeat.set(10, 1);
  const roadMat = new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.95 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(140, 6.5), roadMat);
  road.rotation.x = -Math.PI/2;
  road.position.set(0, 0.01, -10);
  scene.add(road);

  // distant fog marker (deep zone)
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 3.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1.0 })
  );
  marker.position.copy(world.deepZone.center).add(new THREE.Vector3(0, 1.75, 0));
  scene.add(marker);

  // house
  const house = makeHouse({ seed: seed+19, themeText: themePackage.theme + " " + themePackage.text.slice(0,140) });
  house.position.set(0, 0, -12);
  house.rotation.y = 0.14;
  scene.add(house);
  world.solids.push({ type:"box", center:new THREE.Vector3(0,2.8,-12), size:new THREE.Vector3(10,5.6,8), yaw: house.rotation.y });
  world.doorRef = house.userData.door;
  world.interactables.push(world.doorRef);

  // smaller building (shed)
  const shedMat = new THREE.MeshStandardMaterial({ map: wallTexture(seed+55, themePackage.theme), roughness: 0.98 });
  const shed = new THREE.Mesh(new THREE.BoxGeometry(5, 2.8, 4), shedMat);
  shed.position.set(-16, 1.4, -24);
  shed.rotation.y = -0.35;
  scene.add(shed);
  world.solids.push({ type:"box", center:shed.position.clone(), size:new THREE.Vector3(5,2.8,4), yaw: shed.rotation.y });

  // terminal inside shed-ish
  const terminal = makeTerminal();
  terminal.position.set(-15.2, 0, -22.8);
  terminal.rotation.y = 1.35;
  scene.add(terminal);
  world.interactables.push(terminal);

  // clues
  const clueTexts = [
    {
      title: `Photograph: "ROOM 4"`,
      body: `A blurred image of a child standing in fog.\nOn the back: "IF YOU HEAR WATER IN THE WALLS, DO NOT ANSWER."`
    },
    {
      title: `Note: "Signal Hygiene"`,
      body: `Do not use names.\nNames let it pretend.\nUse DESCRIPTION ONLY.\n\n"The daughter" / "the voice" / "the thing".`
    },
    {
      title: `Receipt: "Foundation Supplies"`,
      body: `Coarse salt • magnet wire • wax • 11 small mirrors.\nThe total is circled twice.\nUnderlined: "DO NOT PLACE MIRRORS IN CORNERS".`
    }
  ];

  for (let i=0;i<3;i++){
    const c = makeClue({ seed: seed+100+i*7, ...clueTexts[i] });
    const px = (i===0) ? 2.4 : (i===1 ? -14.6 : -6.0);
    const pz = (i===0) ? -9.0 : (i===1 ? -24.4 : -18.6);
    c.position.set(px, 0.02, pz);
    scene.add(c);
    world.interactables.push(c);
  }

  // forest ring
  const forest = new THREE.Group();
  for(let i=0;i<160;i++){
    const t = makeTree(seed + 300 + i*13);
    const ang = rng()*Math.PI*2;
    const rad = 55 + rng()*55;
    const x = Math.cos(ang)*rad;
    const z = Math.sin(ang)*rad;
    t.position.set(x, 0, z);
    t.rotation.y = rng()*Math.PI*2;
    const s = 0.85 + rng()*1.35;
    t.scale.set(s, s, s);
    forest.add(t);

    // very rough collision for closer trees
    if (rad < 85 && rng() < 0.35){
      world.solids.push({ type:"cyl", center:new THREE.Vector3(x,0,z), r: 0.75*s, h: 2.4*s });
    }
  }
  scene.add(forest);

  // fog sprites
  const fogGroup = makeFogBillboards({ seed: seed+777, count: 110, area: 170 });
  scene.add(fogGroup);
  world.fogGroup = fogGroup;

  // helper functions
  world.pickInteractable = (camera)=>{
    // simple raycast from center
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0,0), camera);
    const hits = ray.intersectObjects(world.interactables, true)
      .filter(h=> h.object?.visible !== false)
      .slice(0, 1);
    if (!hits.length) return null;
    const obj = hits[0].object;
    // bubble up until userData.kind exists
    let o = obj;
    while(o && !o.userData?.kind && o.parent) o = o.parent;
    if (!o?.userData?.kind) return null;
    if (hits[0].distance > 2.3) return null;
    return o;
  };

  world.openDoor = (doorMesh)=>{
    if (doorMesh.userData.open) return;
    doorMesh.userData.open = true;
    // animate over time via update()
    doorMesh.userData._openT = 0;
  };

  world.reachedDeepZone = (pos)=>{
    const d = pos.distanceTo(world.deepZone.center);
    return d < world.deepZone.r;
  };

  world.update = (dt)=>{
    // fog drift
    if (world.fogGroup?.userData?.isFog){
      for (const s of world.fogGroup.children){
        const d = s.userData.drift;
        if (!d) continue;
        d.a += dt * d.sp;
        s.position.x += Math.cos(d.a) * d.r * dt;
        s.position.z += Math.sin(d.a) * d.r * dt;
      }
    }

    // door animation
    const door = world.doorRef;
    if (door && door.userData.open && door.userData._openT < 1){
      door.userData._openT = clamp(door.userData._openT + dt*0.9, 0, 1);
      const t = smoothstep(0,1,door.userData._openT);
      door.rotation.y = (Math.PI/2) + (-1.1 * t);
      door.position.x = 5.01 + 0.45*t;
    }
  };

  // collision: push out of solids
  world.resolveCollision = (pos, radius=0.35)=>{
    // simple: keep y stable
    const p = pos.clone();

    for (const s of world.solids){
      if (s.type === "cyl"){
        const dx = p.x - s.center.x;
        const dz = p.z - s.center.z;
        const dist = Math.hypot(dx, dz);
        const minD = s.r + radius;
        if (dist < minD){
          const nx = dx / (dist || 1e-6);
          const nz = dz / (dist || 1e-6);
          p.x = s.center.x + nx*minD;
          p.z = s.center.z + nz*minD;
        }
        continue;
      }

      // oriented box approx: rotate point into box space by -yaw
      const yaw = s.yaw || 0;
      const c = Math.cos(-yaw), si = Math.sin(-yaw);
      const relx = p.x - s.center.x;
      const relz = p.z - s.center.z;
      const lx = relx*c - relz*si;
      const lz = relx*si + relz*c;

      const hx = s.size.x/2 + radius;
      const hz = s.size.z/2 + radius;

      if (Math.abs(lx) <= hx && Math.abs(lz) <= hz){
        // push out along smallest penetration
        const px = hx - Math.abs(lx);
        const pz = hz - Math.abs(lz);

        if (px < pz){
          const sign = lx >= 0 ? 1 : -1;
          const outx = (Math.abs(lx) + px) * sign;
          // rotate back
          const wx = outx*c + lz*si;
          const wz = -outx*si + lz*c;
          p.x = s.center.x + wx;
          p.z = s.center.z + wz;
        } else {
          const sign = lz >= 0 ? 1 : -1;
          const outz = (Math.abs(lz) + pz) * sign;
          const wx = lx*c + outz*si;
          const wz = -lx*si + outz*c;
          p.x = s.center.x + wx;
          p.z = s.center.z + wz;
        }
      }
    }

    return p;
  };

  return world;
}

