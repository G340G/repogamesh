export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function rand(min=0, max=1){ return min + Math.random() * (max - min); }
export function randi(min, max){ return Math.floor(rand(min, max+1)); }
export function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

export function smoothstep(edge0, edge1, x){
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t*t*(3 - 2*t);
}

export function now(){ return performance.now() / 1000; }

export function hashString(s){
  // stable-ish seed from string
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

export function seededRand(seed){
  // mulberry32
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function setElText(id, text){
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
