import { pick, randi } from "./utils.js";

export const THEMES = [
  "abandoned manor", "flooded tunnel", "radio numbers station", "fungal bloom", "forgotten hospital",
  "salt desert", "coal town", "fog siren", "broken lighthouse", "cold nursery rhyme",
  "mass evacuation", "missing persons", "sleep paralysis", "static electricity", "asylum folklore",
  "rusted carnival", "cemetery soil", "dead phone line", "paper mill", "subterranean chapel"
];

const FALLBACK_FRAGMENTS = [
  "The map is wrong. The streets repeat when you blink.",
  "A door that should lead outside leads into a hallway you remember from a dream.",
  "Your daughter’s voice is in the radio hiss. It says your name like it doesn’t know you.",
  "The fog isn’t weather. It’s a boundary."
];

export async function getRunTheme(){
  // Pick a base theme; then enrich with Wikipedia random summary
  const base = pick(THEMES);
  const wiki = await fetchWikipediaRandomSummary().catch(() => null);

  const themeName = wiki?.title ? `${base} / ${wiki.title}` : base;
  const fragments = [];

  if (wiki?.extract){
    fragments.push(wiki.extract);
  } else {
    fragments.push(pick(FALLBACK_FRAGMENTS));
  }

  fragments.push(...shuffleSmall(FALLBACK_FRAGMENTS).slice(0, 2));
  return { base, themeName, fragments, wiki };
}

function shuffleSmall(arr){
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

export async function fetchWikipediaRandomSummary(){
  // Wikipedia REST API supports CORS
  const url = "https://en.wikipedia.org/api/rest_v1/page/random/summary";
  const res = await fetch(url, { cache:"no-store" });
  if (!res.ok) throw new Error("wiki summary failed");
  const j = await res.json();
  return {
    title: j.title,
    extract: j.extract,
    page: j?.content_urls?.desktop?.page ?? null
  };
}

export async function fetchWikimediaRandomImageUrl(){
  // Wikimedia API supports CORS; request a random file page, try to grab its imageinfo URL
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&generator=random&grnnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*";
  const res = await fetch(url, { cache:"no-store" });
  if (!res.ok) throw new Error("wikimedia random failed");
  const j = await res.json();
  const pages = j?.query?.pages;
  if (!pages) throw new Error("no pages");
  const firstKey = Object.keys(pages)[0];
  const page = pages[firstKey];
  const img = page?.imageinfo?.[0]?.url;
  if (!img) throw new Error("no image url");
  return img;
}

export async function fetchTextFragment(){
  // mix of wiki extract + local corruptions
  const wiki = await fetchWikipediaRandomSummary().catch(() => null);
  if (wiki?.extract) return corruptText(wiki.extract);
  return corruptText(pick(FALLBACK_FRAGMENTS));
}

function corruptText(s){
  // gentle SH-style corruption; not meme-glitch, more unsettling
  const drops = ["…", "—", " ", " "];
  const cuts = [];
  const words = s.split(/\s+/).slice(0, randi(20, 46));
  for (let i=0;i<words.length;i++){
    let w = words[i];
    if (Math.random() < 0.06) w = w.toUpperCase();
    if (Math.random() < 0.05) w = w.replace(/[aeiou]/gi, "·");
    if (Math.random() < 0.03) w = "[REDACTED]";
    cuts.push(w);
    if (Math.random() < 0.08) cuts.push(pick(drops));
  }
  return cuts.join(" ").replace(/\s{2,}/g," ").trim();
}
