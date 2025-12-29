export const TAU = Math.PI * 2;

export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function lerp(a, b, t){ return a + (b - a) * t; }
export function smoothstep(t){ return t * t * (3 - 2*t); }

export function hashStringToSeed(str){
  // deterministic 32-bit seed from string
  let h = 2166136261 >>> 0; // FNV-1a base
  for (let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng, a, b){ return a + (b - a) * rng(); }
export function randi(rng, a, b){ return Math.floor(randRange(rng, a, b + 1)); }
export function pick(rng, arr){ return arr[Math.floor(rng() * arr.length)]; }

export function dist2(a, b){
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return dx*dx + dy*dy + dz*dz;
}

export function now(){ return performance.now() / 1000; }

export function fmtTitle(s){
  return (s || "").replace(/\s+/g, " ").trim();
}

export function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

export function isMobile(){
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

