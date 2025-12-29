import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js";

import { UI } from "./ui.js";
import { Player } from "./player.js";
import { World } from "./world.js";
import { Entity } from "./entity.js";
import { AudioBus } from "./audio.js";
import { getRunTheme } from "./fetchers.js";
import { buildIntroDialogue, buildNote } from "./dialogue.js";
import { DialogueSystem } from "./dialogue.js";
import { clamp, setElText } from "./utils.js";

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 180);
camera.position.set(0, 1.7, 6);

const controls = new PointerLockControls(camera, document.body);
controls.getObject().position.set(0, 1.7, 6);
scene.add(controls.getObject());

const raycaster = new THREE.Raycaster();

const state = {
  theme: null,
  themeFragments: [],
  objectives: [
    { id:"find", text:"Find your daughter.", done:false },
    { id:"follow", text:"Follow the failing streetlights.", done:false },
    { id:"notes", text:"Collect 3 fragments.", done:false },
    { id:"signal", text:"Reach the house with the warm light.", done:false }
  ],
  notes: [],
  collected: 0,
  ended: false,

  settings: {
    sensitivity: 1.0,
    fog: 0.95,
    grain: 0.6,
    vignette: 0.7
  }
};

const ui = new UI(state);
const audio = new AudioBus();
const dialogue = new DialogueSystem(ui);

const world = new World(renderer, scene);
const entity = new Entity(scene);
const player = new Player(camera, controls);

let last = performance.now();
let started = false;
let entityTimer = 0;
let interactHint = "";

wireUI();
bootstrap();

function wireUI(){
  document.getElementById("btnStart").onclick = async () => {
    ui.setBootVisible(false);
    await audio.enable();
    startRun();
  };

  document.getElementById("btnRestart").onclick = () => {
    window.location.reload();
  };

  document.getElementById("btnAccessibility").onclick = () => ui.toggleAccessibility(true);
  document.getElementById("btnCloseAccessibility").onclick = () => ui.toggleAccessibility(false);

  document.getElementById("btnCloseJournal").onclick = () => ui.toggleJournal(false);

  ui.sens.oninput = () => state.settings.sensitivity = parseFloat(ui.sens.value);
  ui.fog.oninput = () => state.settings.fog = parseFloat(ui.fog.value);
  ui.grain.oninput = () => state.settings.grain = parseFloat(ui.grain.value);
  ui.vignette.oninput = () => state.settings.vignette = parseFloat(ui.vignette.value);

  window.addEventListener("resize", onResize);

  // input
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab"){
      e.preventDefault();
      if (!started || state.ended) return;
      ui.toggleJournal();
      if (!ui.journal.classList.contains("hidden")){
        controls.unlock();
      } else {
        controls.lock();
      }
      return;
    }

    if (e.code === "Escape"){
      // let pointer lock handle it
      return;
    }

    if (dialogue.isOpen()){
      if (e.code === "KeyE") dialogue.next();
      return;
    }

    if (e.code === "KeyE"){
      tryInteract();
      return;
    }

    player.handleKey(e, true);
  });

  window.addEventListener("keyup", (e) => {
    player.handleKey(e, false);
  });

  // lock/unlock
  document.body.addEventListener("click", () => {
    if (!started || state.ended) return;
    if (ui.boot.classList.contains("hidden") && ui.journal.classList.contains("hidden") && ui.acc.classList.contains("hidden")){
      controls.lock();
    }
  });
}

async function bootstrap(){
  ui.setBootVisible(true);

  const theme = await getRunTheme();
  state.theme = theme;
  state.themeFragments = [...theme.fragments];

  setElText("bootTheme", `THEME: ${theme.themeName.toUpperCase()}`);
  setElText("bootFacts", theme.fragments.join("  —  "));

  // background uses style_ref.png via CSS already
  ui.updateJournal(state);
  ui.setPostFX(state.settings);

  animate();
}

async function startRun(){
  if (started) return;
  started = true;

  // build world
  await world.init(state.theme);
  world.setFogDensity(state.settings.fog);

  // player start
  controls.getObject().position.set(0, 1.7, 6);

  // intro dialogue
  ui.setObjective("OBJECTIVE: Find your daughter.");
  ui.setHint("Click to look around. Find something to read. The town listens when you run.");
  ui.updateJournal(state);

  dialogue.open(buildIntroDialogue(state.theme), {
    onClose: () => controls.lock()
  });

  ui.onChoice((key) => dialogue.next(key));

  // entity schedule
  entityTimer = 10.0 + Math.random()*6.0; // first appearance
}

function tryInteract(){
  if (!started || state.ended) return;
  const it = world.raycastInteract(camera, raycaster);
  if (!it) return;

  if (it.kind === "sign"){
    dialogue.open([
      { name:"YOU", text: it.data.text, choices:[{ key:"ok", label:"(Step back.)" }] }
    ], { onClose: () => controls.lock() });
    ui.onChoice((k)=> dialogue.next(k));
    audio.radioBurst();
    return;
  }

  if (it.kind === "note"){
    if (it.data.taken) return;
    it.data.taken = true;
    it.mesh.visible = false;

    const note = buildNote(state.theme);
    state.notes.push(note);
    state.collected++;

    // objective progression
    markObjective("follow");
    if (state.collected >= 3) markObjective("notes");

    ui.updateJournal(state);
    dialogue.open([
      { name:"YOU", text:`${note.title}: ${note.body}`, choices:[{ key:"keep", label:"Keep it." }] }
    ], { onClose: () => controls.lock() });
    ui.onChoice((k)=> dialogue.next(k));
    return;
  }

  if (it.kind === "beacon"){
    if (it.data.reached) return;
    it.data.reached = true;
    markObjective("signal");
    markObjective("find");

    endGame();
  }
}

function markObjective(id){
  const o = state.objectives.find(x => x.id === id);
  if (o && !o.done){
    o.done = true;
    ui.setStatus(`Objective updated: ${o.text}`);
    setTimeout(() => ui.setStatus(""), 2400);
  }
}

function endGame(){
  state.ended = true;
  controls.unlock();
  ui.setHint("");
  ui.setStatus("");
  ui.setObjective("OBJECTIVE COMPLETE.");

  const end = [
    "The house is warm in a way the town is not.",
    "You hear a child’s breathing behind a door that doesn’t exist.",
    "The radio hiss collapses into a single syllable:",
    "—Dad."
  ].join(" ");

  ui.showEnd(end);
}

function updateInteractHint(){
  if (!started || state.ended) return;
  if (dialogue.isOpen() || !controls.isLocked){
    ui.setHint("");
    return;
  }
  const it = world.raycastInteract(camera, raycaster);
  if (!it){
    interactHint = "";
    ui.setHint("WASD move • E interact • Tab journal • Shift sprint");
    return;
  }
  let msg = "";
  if (it.kind === "note") msg = "Press E to pick up the fragment.";
  if (it.kind === "sign") msg = "Press E to read the sign.";
  if (it.kind === "beacon") msg = "Press E to approach the warm light.";
  interactHint = msg;
  ui.setHint(msg);
}

function animate(){
  requestAnimationFrame(animate);

  const t = performance.now();
  const dt = Math.min(0.05, (t - last)/1000);
  last = t;

  // live settings
  ui.setPostFX(state.settings);
  world.setFogDensity(state.settings.fog);
  player.setSensitivity(state.settings.sensitivity);

  if (started && !state.ended){
    // update movement only when locked and no dialogue/journal
    const blocked = dialogue.isOpen() || !controls.isLocked || !ui.journal.classList.contains("hidden") || !ui.acc.classList.contains("hidden");
    if (!blocked){
      player.update(dt, audio);
      // clamp to town bounds
      world.projectToTownBounds(controls.getObject().position);
    }

    updateInteractHint();

    // entity behavior timer
    entityTimer -= dt;
    if (entityTimer <= 0 && !entity.active){
      // spawn behind player
      const forward = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
      forward.y = 0; forward.normalize();
      entity.spawnNear(player.position, forward);
      entityTimer = 999; // now active until caught/end
    }

    // entity update
    const e = entity.update(dt, player, world, audio);
    player.fear = clamp(player.fear + (e.tension*0.32 - 0.18)*dt, 0, 1);

    audio.setTension(player.fear);

    // meters
    ui.setMeters({ breath: player.breath, fear: player.fear });

    // “fear” impacts visuals slightly
    ui.grain.value = String(clamp(state.settings.grain + player.fear*0.18, 0, 1));
    ui.vignette.value = String(clamp(state.settings.vignette + player.fear*0.22, 0, 1));

    if (e.caught){
      state.ended = true;
      controls.unlock();
      ui.setObjective("OBJECTIVE FAILED.");
      ui.showEnd("You feel a thread tighten behind your eyes. The fog closes like a mouth.");
    }
  }

  renderer.render(scene, camera);
}

function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}
