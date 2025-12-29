import { clamp } from "./utils.js";

/**
 * Practical “scraping” for GitHub Pages:
 * - Wikipedia REST (random summary) for theme + text
 * - Wikimedia Commons API for random images related to theme (origin=* allows CORS)
 *
 * True arbitrary site scraping is blocked by browsers (CORS).
 */
export class Fetchers {
  constructor(){
    this.cache = new Map();
  }

  async getThemePackage(){
    const theme = await this._randomTheme();
    const text = await this._wikiSummary(theme);
    const images = await this._wikimediaImages(theme, 4);

    return { theme, text, images };
  }

  async getTerminalFragment(theme){
    const s = await this._wikiSummary(theme);
    // chop + “documentify”
    const lines = s.split(/\n+/).join(" ");
    const fragment = lines.slice(0, 680);
    return (
      `IMPRINT: ${theme}\n\n` +
      `${fragment}\n\n` +
      `NOTE: The archive is not a memory.\nIt is a mouth.\n`
    );
  }

  async getCreepyTransmission(theme){
    const s = await this._wikiSummary(theme);
    const base = s.replace(/\s+/g," ").slice(0, 280);

    const glitches = [
      "…ksssh…",
      "—SIGNAL FRACTURE—",
      "///",
      "<<<",
      "…",
    ];
    const g = glitches[Math.floor(Math.random()*glitches.length)];

    // weave in “daughter” vibe
    const tail = [
      "I can see the road but it doesn't lead anywhere.",
      "Don't say my name out loud in the fog.",
      "There is a second house inside the first.",
      "If you find the picture, turn it face down.",
      "The corners are listening again."
    ][Math.floor(Math.random()*5)];

    return `${g}\n${base}\n\n${tail}\n${g}`;
  }

  async _randomTheme(){
    // Wikipedia random summary, use title as theme
    const url = "https://en.wikipedia.org/api/rest_v1/page/random/summary";
    const j = await this._fetchJson(url);
    // keep it usable as a motif
    const title = (j?.title || "Foundation").replace(/[^\w\s\-']/g,"").slice(0, 42);
    return title || "Foundation";
  }

  async _wikiSummary(title){
    const key = "sum:"+title;
    if (this.cache.has(key)) return this.cache.get(key);

    const safe = encodeURIComponent(title);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${safe}`;
    try{
      const j = await this._fetchJson(url);
      const txt = (j?.extract || "")
        .replace(/\s+/g," ")
        .trim();
      const out = txt ? txt : `No summary available. The signal resists description.`;
      this.cache.set(key, out);
      return out;
    } catch {
      const out = `The page tears. The text won't hold.`;
      this.cache.set(key, out);
      return out;
    }
  }

  async _wikimediaImages(query, count=4){
    const key = "img:"+query+":"+count;
    if (this.cache.has(key)) return this.cache.get(key);

    // search files
    const q = encodeURIComponent(query);
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=search&gsrnamespace=6&gsrlimit=${clamp(count*2, 6, 20)}` +
      `&gsrsearch=${q}` +
      `&prop=imageinfo&iiprop=url|mime&iiurlwidth=1024`;

    try{
      const j = await this._fetchJson(url);
      const pages = j?.query?.pages ? Object.values(j.query.pages) : [];
      const urls = pages
        .map(p => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url)
        .filter(Boolean)
        .slice(0, count);

      // if too few, fallback to random files
      const out = urls.length ? urls : await this._wikimediaRandom(count);
      this.cache.set(key, out);
      return out;
    } catch {
      const out = await this._wikimediaRandom(count);
      this.cache.set(key, out);
      return out;
    }
  }

  async _wikimediaRandom(count=4){
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
      `&generator=random&grnnamespace=6&grnlimit=${clamp(count,1,8)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=1024`;

    try{
      const j = await this._fetchJson(url);
      const pages = j?.query?.pages ? Object.values(j.query.pages) : [];
      return pages
        .map(p => p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url)
        .filter(Boolean)
        .slice(0, count);
    } catch {
      return [];
    }
  }

  async _fetchJson(url){
    const r = await fetch(url, { mode:"cors" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }
}

