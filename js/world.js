import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { clamp, pick, rand, randi, smoothstep, seededRand, hashString } from "./utils.js";
import { fetchWikimediaRandomImageUrl } from "./fetchers.js";

export class World{
  constructor(renderer, scene){
    this.renderer = renderer;
    this.scene = scene;

    this.size = 140; // town radius-ish
    this.seedName = "ASHFIELD";
    this.rng = Math.random;

    this.fogDensity = 0.95;

    this.assets = {
      groundTex: null,
      wallTex: null,
      signTex: null
    };

    this.interactables = []; // { mesh, kind, data }
    this.lights = [];
    this.spawnPoints = [];

    this._tmp = new THREE.Vector3();
  }

  setFogDensity(v){
    this.fogDensity = v;
    // exponential fog (denser = shorter distance)
    const d = clamp(v, 0.2, 1.4);
    this.scene.fog.density = 0.0105 * d;
  }

  async init(theme){
    this.seedName = theme.themeName || "ASHFIELD";
    this.rng = seededRand(hashString(this.seedName));

    // fog & background color grade (yellowed, sickly)
    this.scene.background = new THREE.Color(0x0b0a09);
    this.scene.fog = new THREE.FogExp2(0x0b0a09, 0.0105 * this.fogDensity);

    // subtle ambient
    this.scene.add(new THREE.AmbientLight(0x6b5c44, 0.18));

    // "moon" key light
    const moon = new THREE.DirectionalLight(0xc7b58a, 0.85);
    moon.position.set(-18, 34, -22);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 120;
    moon.shadow.camera.left = -50;
    moon.shadow.camera.right = 50;
    moon.shadow.camera.top = 50;
    moon.shadow.camera.bottom = -50;
    this.scene.add(moon);

    // fetch textures (random) with fallbacks
    await this._loadTextures();

    // build terrain/roads/town
    this._buildGround();
    this._buildRoads();
    this._buildTown(theme);

    // boundary fog walls
    this._addFogCurtain();

    // spawn points
    this.spawnPoints = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-22, 0, 18),
      new THREE.Vector3(30, 0, -26),
      new THREE.Vector3(12, 0, 44)
    ];
  }

  async _loadTextures(){
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const makeFallback = (kind) => {
      const c = document.createElement("canvas");
      c.width = 256; c.height = 256;
      const g = c.getContext("2d");

      // grimy procedural
      g.fillStyle = "#15120f"; g.fillRect(0,0,256,256);
      for (let i=0;i<2200;i++){
        const x = Math.random()*256, y=Math.random()*256;
        const a = Math.random()*0.18;
        g.fillStyle = `rgba(230,215,180,${a})`;
        g.fillRect(x,y,1+Math.random()*2,1+Math.random()*2);
      }
      // cracks
      g.strokeStyle = "rgba(0,0,0,.35)";
      for (let i=0;i<18;i++){
        g.beginPath();
        g.moveTo(Math.random()*256, Math.random()*256);
        for (let k=0;k<6;k++){
          g.lineTo(Math.random()*256, Math.random()*256);
        }
        g.stroke();
      }

      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(kind==="ground" ? 22 : 3, kind==="ground" ? 22 : 3);
      tex.anisotropy = 4;
      return tex;
    };

    const tryLoad = async (kind) => {
      try{
        const url = await fetchWikimediaRandomImageUrl();
        const tex = await new Promise((resolve, reject) => {
          loader.load(url, resolve, undefined, reject);
        });
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(kind==="ground" ? 18 : 2, kind==="ground" ? 18 : 2);
        tex.anisotropy = 4;
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      }catch{
        return makeFallback(kind);
      }
    };

    // These are intentionally different random images each run
    this.assets.groundTex = await tryLoad("ground");
    this.assets.wallTex = await tryLoad("wall");
    this.assets.signTex = await tryLoad("sign");
  }

  _buildGround(){
    const geo = new THREE.PlaneGeometry(this.size*2, this.size*2, 64, 64);
    geo.rotateX(-Math.PI/2);

    // mild displacement
    const pos = geo.attributes.position;
    for (let i=0;i<pos.count;i++){
      const x = pos.getX(i), z = pos.getZ(i);
      const n = (Math.sin(x*0.06) + Math.cos(z*0.05) + Math.sin((x+z)*0.035))*0.35;
      pos.setY(i, n * 0.25);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: this.assets.groundTex,
      roughness: 1.0,
      metalness: 0.0,
      color: 0x6c5a3c
    });

    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildRoads(){
    // simple cracked road strips
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x2a2621,
      roughness: 1.0,
      metalness: 0.0
    });

    const addRoad = (x,z,w,h,rot=0) => {
      const g = new THREE.PlaneGeometry(w, h, 1, 1);
      g.rotateX(-Math.PI/2);
      const m = new THREE.Mesh(g, roadMat);
      m.position.set(x, 0.02, z);
      m.rotation.y = rot;
      m.receiveShadow = true;
      this.scene.add(m);
    };

    addRoad(0, 0, 10, 120, 0);
    addRoad(-18, 10, 9, 90, 0.15);
    addRoad(24, -14, 8, 80, -0.18);
    addRoad(0, 26, 56, 10, 0.03);
    addRoad(-6, -30, 52, 9, -0.06);
  }

  _buildTown(theme){
    // clusters of buildings
    const blocks = [
      { cx:-16, cz:18, n:10 },
      { cx:18, cz:-14, n:9 },
      { cx:6, cz:36, n:8 }
    ];

    blocks.forEach(b => {
      for (let i=0;i<b.n;i++){
        const x = b.cx + rand(-18, 18);
        const z = b.cz + rand(-18, 18);
        this._addBuilding(x,z, theme);
      }
    });

    // forest ring
    for (let i=0;i<220;i++){
      const ang = this.rng()*Math.PI*2;
      const r = 48 + this.rng()*74;
      const x = Math.cos(ang)*r + rand(-4,4);
      const z = Math.sin(ang)*r + rand(-4,4);
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      this._addTree(x, z);
    }

    // interactables: notes + a "signal" location
    this._addInteractableSign(8, 0, -12, `ASHFIELD / ${theme.base.toUpperCase()}`);
    this._addNotePickup(-22, 0, 16);
    this._addNotePickup(26, 0, -22);
    this._addNotePickup(10, 0, 42);

    // the "daughter" beacon (end condition)
    this._addBeaconHouse(-34, 0, -6);
  }

  _addBuilding(x,z, theme){
    const w = rand(4.2, 8.6);
    const h = rand(3.8, 8.8);
    const d = rand(4.2, 8.6);

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      map: this.assets.wallTex,
      roughness: 0.95,
      metalness: 0.0,
      color: 0x7a6748
    });

    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h/2, z);
    m.rotation.y = rand(-0.4, 0.4);
    m.castShadow = true;
    m.receiveShadow = true;

    // make them feel abandoned: missing chunks via dark “void windows”
    const winCount = randi(2, 6);
    const winGeo = new THREE.PlaneGeometry(0.9, 1.1);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 });
    for (let i=0;i<winCount;i++){
      const wmesh = new THREE.Mesh(winGeo, winMat);
      wmesh.position.set(rand(-w/2+0.7, w/2-0.7), rand(h*0.25, h*0.8), d/2 + 0.01);
      wmesh.rotation.y = 0;
      m.add(wmesh);
    }

    // occasional streetlamp
    if (Math.random() < 0.18){
      this._addLamp(x + rand(-4,4), z + rand(-4,4));
    }

    this.scene.add(m);
  }

  _addTree(x,z){
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, rand(2.6, 4.2), 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1.0 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1.6, z);
    trunk.castShadow = true;

    const crownGeo = new THREE.ConeGeometry(rand(0.8, 1.6), rand(2.6, 4.4), 10);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x0f120f, roughness: 1.0 });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(0, rand(2.8, 3.8), 0);
    crown.castShadow = true;

    trunk.add(crown);
    this.scene.add(trunk);
  }

  _addLamp(x,z){
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.08, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2621, roughness: 1.0 })
    );
    pole.position.set(x, 1.6, z);
    pole.castShadow = true;

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 10),
      new THREE.MeshStandardMaterial({ emissive: 0xffd7a0, emissiveIntensity: 1.0, color: 0x222222 })
    );
    bulb.position.set(0, 1.55, 0);
    pole.add(bulb);

    const light = new THREE.PointLight(0xffd7a0, 1.0, 12, 2.2);
    light.position.set(x, 3.1, z);
    light.castShadow = true;

    this.scene.add(pole);
    this.scene.add(light);
    this.lights.push(light);
  }

  _addInteractableSign(x,y,z, text){
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 256;
    const g = canvas.getContext("2d");
    g.fillStyle = "#0e0c0a"; g.fillRect(0,0,512,256);
    g.globalAlpha = 0.45;
    // use random sign texture as grimy overlay
    g.fillStyle = g.createPattern(canvasNoisePattern(), "repeat");
    g.fillRect(0,0,512,256);
    g.globalAlpha = 1;

    g.strokeStyle = "rgba(255,255,255,.18)";
    g.strokeRect(16,16,480,224);

    g.fillStyle = "rgba(220,205,170,.92)";
    g.font = "28px ui-monospace, Menlo, Consolas, monospace";
    wrapText(g, text, 30, 70, 450, 34);
    g.font = "16px ui-monospace, Menlo, Consolas, monospace";
    g.fillStyle = "rgba(220,205,170,.70)";
    g.fillText("SPEED LIMIT: MEMORY", 30, 210);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 3.2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.0 })
    );
    sign.position.set(x, 1.6, z);
    sign.rotation.y = rand(-0.4, 0.4);
    sign.castShadow = true;

    this.scene.add(sign);

    this.interactables.push({
      mesh: sign,
      kind: "sign",
      data: { text: "The sign is cold. The paint looks wet, but it flakes like skin." }
    });
  }

  _addNotePickup(x,y,z){
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.08, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xb9ac90, roughness: 1.0 })
    );
    m.position.set(x, 0.12, z);
    m.castShadow = true;
    this.scene.add(m);

    this.interactables.push({
      mesh: m,
      kind: "note",
      data: { taken:false }
    });
  }

  _addBeaconHouse(x,y,z){
    // a distinct “manor” silhouette
    const w=12, h=7.5, d=9;
    const mat = new THREE.MeshStandardMaterial({ map:this.assets.wallTex, roughness:0.95, color:0x6f5b3e });
    const base = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    base.position.set(x, h/2, z);
    base.castShadow = true; base.receiveShadow=true;

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(8, 4.2, 4),
      new THREE.MeshStandardMaterial({ color:0x2a2320, roughness:1.0 })
    );
    roof.position.set(0, h/2 + 2.1, 0);
    roof.rotation.y = Math.PI/4;
    roof.castShadow = true;
    base.add(roof);

    // faint interior light to pull player
    const inner = new THREE.PointLight(0xffd7a0, 0.7, 18, 2.0);
    inner.position.set(x+1.2, 2.2, z-1.3);
    this.scene.add(inner);

    this.scene.add(base);

    this.interactables.push({
      mesh: base,
      kind: "beacon",
      data: { reached:false }
    });
  }

  _addFogCurtain(){
    // invisible boundary helper: nothing rendered, but we clamp player to bounds
  }

  projectToTownBounds(v){
    const r = this.size * 0.92;
    const len = Math.hypot(v.x, v.z);
    if (len > r){
      const s = r / len;
      v.x *= s; v.z *= s;
    }
  }

  raycastInteract(camera, raycaster){
    raycaster.setFromCamera({ x:0, y:0 }, camera);
    const meshes = this.interactables.map(i => i.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (!hits.length) return null;

    // find top-level interactable (walk up parent chain)
    const hitObj = hits[0].object;
    let found = null;
    for (const it of this.interactables){
      if (it.mesh === hitObj || it.mesh.children.includes(hitObj) || it.mesh === hitObj.parent || it.mesh === hitObj.parent?.parent){
        found = it; break;
      }
      // fallback: check ancestry
      let p = hitObj.parent;
      while (p){
        if (p === it.mesh){ found = it; break; }
        p = p.parent;
      }
      if (found) break;
    }
    return found;
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = text.split(" ");
  let line = "";
  for (let n=0;n<words.length;n++){
    const testLine = line + words[n] + " ";
    const w = ctx.measureText(testLine).width;
    if (w > maxWidth && n > 0){
      ctx.fillText(line, x, y);
      line = words[n] + " ";
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

function canvasNoisePattern(){
  const c = document.createElement("canvas");
  c.width=64; c.height=64;
  const g = c.getContext("2d");
  g.fillStyle = "#0f0d0b"; g.fillRect(0,0,64,64);
  for (let i=0;i<650;i++){
    const a = Math.random()*0.12;
    g.fillStyle = `rgba(230,215,180,${a})`;
    g.fillRect(Math.random()*64, Math.random()*64, 1, 1);
  }
  return c;
}
