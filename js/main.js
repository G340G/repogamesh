import * as THREE from "three";
import { Player } from "./player.js";
import { World } from "./world.js";
import { Entity } from "./entity.js";
import { fetchRandomTheme, shapeWikipediaExtract } from "./fetchers.js";
import { UI, showMenu, showPrompt, setThemeLabel, setObjective, setClues, fadeTo, closeDialogue, isDialogueOpen } from "./ui.js";
import { setDialogueSequence, startDialogue, advanceDialogue, stopDialogue, dialogueOpen } from "./dialogue.js";
import { audioInit, audioResume, setThreatLevel, oneShotClick } from "./audio.js";
import { clamp, now } from "./utils.js";

const canvas = document.getElementById("c");

// three basics
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:"high-performance" });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.05, 400);
camera.position.set(0, 1.65, 2.5);

const player = new Player(camera, document.body);
player.connect();

scene.add(player.object);

// game systems
let world = new World(renderer, scene);
let entity = new Entity(scene);

let theme = null;
let clueCount = 0;
const totalClues = 5;

let running = false;
let started = false;

let lastT = now();
let threat = 0;

const raycaster = new THREE.Raycaster();
const tmpVec = new THREE.Vector3();

const SAVE_KEY = "ashfield_theme_v1";

function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);

// UI buttons
UI.btnStart.addEventListener("click", async ()=>{
  await beginOrResume();
});
UI.btnReset.addEventListener("click", async ()=>{
  localStorage.removeItem(SAVE_KEY);
  await newGame(true);
});

document.addEventListener("click", async ()=>{
  if (!started) return;
  if (!running && !dialogueOpen()){
    // allow clicking to lock pointer after menu close
    tryLock();
  }
});

// Dialogue controls
window.addEventListener("keydown", (e)=>{
  if (!started) return;

  if (e.code === "KeyQ"){
    stopDialogue();
    showPrompt(null);
    return;
  }
  if (e.code === "KeyE"){
    if (dialogueOpen()){
      advanceDialogue();
      oneShotClick();
      return;
    }
  }
});

// Pointer lock state
document.addEventListener("pointerlockchange", ()=>{
  const locked = document.pointerLockElement != null;
  if (locked){
    running = true;
    showMenu(false);
  } else {
    running = false;
    if (started && !dialogueOpen()){
      showMenu(true);
    }
  }
});

function tryLock(){
  audioResume();
  player.setEnabled(true);
  player.lock();
}

async function beginOrResume(){
  audioInit();
  await audioResume();

  if (!started){
    await newGame(false);
    started = true;
  }
  tryLock();
}

async function newGame(forceNewTheme){
  fadeTo(1);
  await sleepFrame(2);

  clueCount = 0;
  setClues(clueCount, totalClues);

  entity.reset();

  theme = null;
  const saved = !forceNewTheme ? localStorage.getItem(SAVE_KEY) : null;

  if (saved){
    try { theme = JSON.parse(saved); } catch {}
  }
  if (!theme){
    theme = await fetchRandomTheme();
    localStorage.setItem(SAVE_KEY, JSON.stringify(theme));
  }

  setThemeLabel(theme.title);
  setObjective("Find a trace of your daughter. Read what the town leaves behind.");

  // rebuild scene
  scene.clear();
  scene.background = new THREE.Color(0x050505);
  scene.add(player.object);

  world = new World(renderer, scene);
  await world.build(theme.title);

  entity = new Entity(scene);

  // player spawn
  player.object.position.set(0, 1.65, 4.5);
  player.object.rotation.set(0,0,0);
  player.setEnabled(true);

  // opening dialogue
  setDialogueSequence([
    { speaker:"YOU", text:`The fog has a taste.\nMetallic. Old pennies and wet paper.` },
    { speaker:"YOU", text:`She vanished here.\nA town that doesn't remember its own name.` },
    { speaker:"RADIO", text:`…hiss…\nIf you can hear this, keep walking.\nDon't stare at the shapes.\n…hiss…` },
    { speaker:"NOTE", text:`THEME: ${theme.title}\n${shapeWikipediaExtract(theme.extract)}\n\n${theme.tagline}` }
  ]);
  startDialogue();

  fadeTo(0);
}

function interactCheck(){
  if (!running) return;

  // Don’t interrupt dialogue
  if (dialogueOpen()) return;

  const cam = camera;
  raycaster.setFromCamera({ x:0, y:0 }, cam);

  const meshes = world.interactables.map(o=>o.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length){
    showPrompt(null);
    return;
  }
  const hit = hits[0];
  if (hit.distance > 3.1){
    showPrompt(null);
    return;
  }

  const it = world.interactables.find(o=>o.mesh === hit.object);
  if (!it){
    showPrompt(null);
    return;
  }

  showPrompt(`[E] Inspect`);

  // If player presses E (and not in dialogue), open interaction
  // We handle E in keydown by checking dialogue first; so here we add a one-frame listener:
  const handler = (e)=>{
    if (e.code !== "KeyE") return;
    window.removeEventListener("keydown", handler);

    if (it.type === "clue"){
      onClue(it);
    } else if (it.type === "sign"){
      onSign(it);
    }
  };
  window.addEventListener("keydown", handler, { once:true });
}

function onSign(it){
  const t = theme?.title || "ASHFIELD";
  setDialogueSequence([
    { speaker:"SIGN", text:`ASHFIELD\nPopulation: (scratched out)\n\nIf you're looking for someone, start with what the town tries to hide.` },
    { speaker:"YOU", text:`A name carved deep, like a warning.\nI can’t tell if it's meant for me… or for her.` },
    { speaker:"CASE FILE", text:`THEME LINKED: ${t}\nThe town is borrowing language to describe what it cannot contain.` }
  ]);
  startDialogue();
  oneShotClick();
}

function onClue(it){
  const id = it.data.id;

  // prevent re-collecting: mark mesh invisible and remove from interactables
  it.mesh.visible = false;
  world.interactables = world.interactables.filter(x => x !== it);

  clueCount++;
  setClues(clueCount, totalClues);

  const fragments = [
    "You find a child's handwriting that feels too steady.",
    "A smear of ash… arranged like a map.",
    "A strand of hair taped to the paper. It hums against your skin.",
    "A phone number with one digit missing. You can *feel* the missing digit.",
    "A drawing of a door inside a door inside a door."
  ];

  const entityNotes = [
    "Something tall stands where the fog is thickest—then it isn't there.",
    "A silhouette refuses to make a sound, like it’s saving breath for later.",
    "You sense a presence that waits for you to stop moving.",
    "A pressure behind your eyes: do not turn around.",
    "The town exhales. The fog shifts, as if watching you read."
  ];

  setDialogueSequence([
    { speaker:"CLUE", text:`CLUE ${id+1}/5\n${fragments[id % fragments.length]}` },
    { speaker:"NOTE", text:`${shapeWikipediaExtract(theme?.extract || "")}` },
    { speaker:"…", text:`${entityNotes[id % entityNotes.length]}` }
  ]);
  startDialogue();
  oneShotClick();

  // Activate entity after first clue
  if (clueCount === 1){
    // spawn after a moment
    setTimeout(()=>{
      const fwd = new THREE.Vector3();
      camera.getWorldDirection(fwd);
      entity.spawnNear(player.object.position, fwd);
    }, 1200);
  }

  if (clueCount >= totalClues){
    setObjective("You have enough traces. Follow the road deeper into the fog.");
    endSequenceSoon();
  }
}

function endSequenceSoon(){
  setTimeout(()=>{
    if (dialogueOpen()) return;
    setDialogueSequence([
      { speaker:"RADIO", text:`…hiss…\nYou collected what the town sheds.\nNow it will collect *you*.\n…hiss…` },
      { speaker:"YOU", text:`Daughter…\nI’m coming.\nEven if I have to walk through every wrong room in this place.` }
    ]);
    startDialogue();
  }, 1400);
}

function updateEntity(dt){
  // threat behavior: entity exists only after spawn
  if (!entity.active){
    threat *= 0.92;
    setThreatLevel(threat);
    return;
  }
  entity.update(dt, player);
  // compute threat from entity
  const d = player.object.position.distanceTo(entity.pos);
  const t = clamp(1 - (d / 22), 0, 1);
  threat += (t - threat) * clamp(dt*1.2, 0, 1);
  setThreatLevel(threat);

  // If threat too high, fade and “push back” (no cheap jumpscare, just dread)
  if (threat > 0.92){
    fadeTo(1);
    running = false;
    player.unlock();
    setTimeout(()=>{
      // reset player a bit back
      player.object.position.set(0, 1.65, 6.5);
      threat = 0.25;
      fadeTo(0);
      showMenu(true);
    }, 900);
  }
}

function loop(){
  requestAnimationFrame(loop);
  const t = now();
  const dt = clamp(t - lastT, 0, 0.05);
  lastT = t;

  if (started){
    if (running && !dialogueOpen()){
      player.update(dt);
      interactCheck();
    } else {
      showPrompt(null);
    }
    updateEntity(dt);
  }

  renderer.render(scene, camera);
}
loop();

// boot menu
showMenu(true);

function sleepFrame(n=1){
  return new Promise((resolve)=>{
    let k = 0;
    const step = ()=>{
      k++;
      if (k >= n) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

