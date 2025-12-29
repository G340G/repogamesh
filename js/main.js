import * as THREE from "three";
import { clamp } from "./utils.js";
import { buildWorld } from "./world.js";
import { Player } from "./player.js";
import { Entity } from "./entity.js";
import { UI } from "./ui.js";
import { Dialogue } from "./dialogue.js";
import { AudioEngine } from "./audio.js";
import { Fetchers } from "./fetchers.js";

const canvas = document.getElementById("c");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060606);
scene.fog = new THREE.FogExp2(0x0a0a0a, 0.03);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.05,
  500
);

const clock = new THREE.Clock();

const ui = new UI();
const dialogue = new Dialogue(ui);
const audio = new AudioEngine();
const fetchers = new Fetchers();

let world, player, entity;

const state = {
  started: false,
  paused: false,
  foundClueCount: 0,
  daughterSignal: 0.08, // grows with clues
  theme: null,
  themeText: null,
  themeImages: [],
  interactables: [],
  danger: 0,
};

function addLights(){
  // cold moon key
  const moon = new THREE.DirectionalLight(0xdde6ff, 1.0);
  moon.position.set(-30, 55, -20);
  moon.castShadow = false;
  scene.add(moon);

  // weak ambient
  const amb = new THREE.AmbientLight(0x8899aa, 0.2);
  scene.add(amb);

  // subtle flicker lamp (near the house)
  const lamp = new THREE.PointLight(0xffe2b8, 0.9, 25, 2.0);
  lamp.position.set(6, 2.5, -8);
  lamp.userData.flicker = true;
  scene.add(lamp);

  // fog glow volume-ish
  const fogGlow = new THREE.HemisphereLight(0x9db0c9, 0x151010, 0.22);
  scene.add(fogGlow);
}

function resize(){
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", resize);

async function boot(){
  addLights();

  // Online randomness (safe CORS sources)
  const pkg = await fetchers.getThemePackage();
  state.theme = pkg.theme;
  state.themeText = pkg.text;
  state.themeImages = pkg.images;

  ui.setJournalTheme(state.theme);
  ui.appendJournal(`Theme locked: ${state.theme}\n\n`);
  ui.appendJournal(pkg.text + "\n\n");

  // Build world using theme + images
  world = await buildWorld({ THREE, scene, themePackage: pkg });
  state.interactables = world.interactables;

  player = new Player({ THREE, camera, domElement: renderer.domElement, world });
  entity = new Entity({ THREE, scene, world, theme: state.theme });

  // place player
  player.teleport(world.spawn.position, world.spawn.yaw);

  // Begin subtle ambience (requires user gesture; will start on click)
  audio.configureTheme(state.theme);
  ui.setObjective("Find your daughter. Search the structures for traces.");

  wireInputs();
  animate();
}

function wireInputs(){
  // start on click
  const hint = document.getElementById("hint");

  function tryStart(){
    if (state.started) return;
    state.started = true;
    hint.textContent = "WASD move • Mouse look • E interact • TAB journal • Follow the signal.";
    player.enablePointerLock();

    audio.start(); // user gesture satisfied
    audio.setDanger(0);

    // opening radio fragment
    dialogue.open({
      speaker: "RADIO / UNKNOWN",
      text:
        `…ksssh… If you can hear this: do not follow the roads.\n` +
        `She is not *lost*. She is *kept*.\n` +
        `Theme imprint: ${state.theme}.\n` +
        `Find the marked rooms. The signal grows with proof.\n\n` +
        `…ksssh…`
    });
    setTimeout(()=> dialogue.close(), 4500);
  }

  window.addEventListener("click", tryStart, { once:false });

  window.addEventListener("keydown", (e)=>{
    if (e.code === "Tab"){
      e.preventDefault();
      ui.toggleJournal();
      return;
    }
    if (e.code === "Escape"){
      dialogue.close();
      return;
    }
    dialogue.onKey(e);
  });

  // E interact
  window.addEventListener("keydown", (e)=>{
    if (e.code !== "KeyE") return;
    if (!state.started) return;
    if (dialogue.isOpen()) return;

    const hit = world.pickInteractable(camera);
    if (!hit) return;

    interact(hit);
  });
}

async function interact(hit){
  const kind = hit.userData.kind;

  if (kind === "clue"){
    hit.userData.used = true;
    hit.visible = false;

    state.foundClueCount += 1;
    state.daughterSignal = clamp(state.daughterSignal + 0.12, 0, 1);

    audio.oneShot("beep");
    ui.flashPrompt(`Clue recovered: ${hit.userData.title}`);

    ui.appendJournal(
      `\n[CLUE ${state.foundClueCount}] ${hit.userData.title}\n` +
      `${hit.userData.body}\n`
    );

    ui.setObjective(
      state.foundClueCount >= 3
        ? "The signal is stronger. Follow the deeper fog."
        : "Find more traces. The signal is weak here."
    );

    // entity reacts
    entity.onClueTaken(state.foundClueCount);

    // chance of dialogue
    if (Math.random() < 0.55){
      const msg = await fetchers.getCreepyTransmission(state.theme);
      dialogue.open({
        speaker: "RADIO / DAUGHTER?",
        text: msg
      });
    }
    return;
  }

  if (kind === "door"){
    audio.oneShot("thump");
    dialogue.open({
      speaker: "DOOR",
      text: hit.userData.locked
        ? "It doesn’t move. Something presses back from the other side."
        : "It opens into a room that smells like wet paper and old electricity."
    });
    if (!hit.userData.locked){
      world.openDoor(hit);
      // “scene shift” small
      audio.oneShot("whisper");
      ui.flashPrompt("The air changes.");
    } else {
      // chance unlock after enough clues
      if (state.foundClueCount >= 2 && Math.random() < 0.55){
        hit.userData.locked = false;
        ui.flashPrompt("A latch clicks by itself.");
      }
    }
    return;
  }

  if (kind === "terminal"){
    audio.oneShot("buzz");
    const fragment = await fetchers.getTerminalFragment(state.theme);
    dialogue.open({
      speaker: "FOUNDATION TERMINAL",
      text:
        `ARCHIVE ENTRY\n` +
        `Subject: CHILD / retrieval\n` +
        `Status: ACTIVE\n\n` +
        fragment
    });
    return;
  }
}

function animate(){
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.033);

  // lights flicker
  scene.traverse((o)=>{
    if (o.isLight && o.userData.flicker){
      const t = clock.elapsedTime;
      o.intensity = 0.72 + 0.18*Math.sin(t*9.0) + 0.1*Math.sin(t*22.0);
    }
  });

  if (world) world.update(dt);
  if (player) player.update(dt);

  if (entity && player){
    entity.update(dt, player.getPosition());
    // danger is driven by proximity & chase state
    state.danger = clamp(entity.getDangerLevel(), 0, 1);
    audio.setDanger(state.danger);
    ui.setSignal(state.daughterSignal, state.danger);

    // end condition (prototype): enough clues + reach "deep marker"
    if (!state.paused && state.foundClueCount >= 3 && world.reachedDeepZone(player.getPosition())){
      state.paused = true;
      player.disablePointerLock();
      dialogue.open({
        speaker: "RADIO / DAUGHTER",
        text:
          "Dad…?\n\n" +
          "You found the right house.\n" +
          "But it isn’t a house.\n\n" +
          "Don’t look at the corners.\n" +
          "It learns your shape.\n\n" +
          "…come closer.\n"
      });
      ui.setObjective("END OF PROLOGUE • Refresh to generate a new theme.");
      audio.setDanger(0.2);
    }
  }

  renderer.render(scene, camera);
}

boot();

