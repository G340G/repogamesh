import { clamp } from "./utils.js";

export class UI{
  constructor(state){
    this.state = state;

    this.boot = document.getElementById("boot");
    this.end = document.getElementById("end");
    this.endText = document.getElementById("endText");

    this.dialogue = document.getElementById("dialogue");
    this.dlgName = document.getElementById("dlgName");
    this.dlgText = document.getElementById("dlgText");
    this.dlgChoices = document.getElementById("dlgChoices");
    this.dlgFooter = document.getElementById("dlgFooter");

    this.hint = document.getElementById("hint");
    this.status = document.getElementById("status");
    this.objective = document.getElementById("objective");

    this.journal = document.getElementById("journal");
    this.journalObjectives = document.getElementById("journalObjectives");
    this.journalTheme = document.getElementById("journalTheme");
    this.journalNotes = document.getElementById("journalNotes");

    this.acc = document.getElementById("accessibility");
    this.sens = document.getElementById("sens");
    this.fog = document.getElementById("fog");
    this.grain = document.getElementById("grain");
    this.vignette = document.getElementById("vignette");

    this.grainLayer = document.getElementById("grainLayer");
    this.vignetteLayer = document.getElementById("vignetteLayer");

    this.breathFill = document.getElementById("breathFill");
    this.fearFill = document.getElementById("fearFill");

    this._choiceHandler = null;
  }

  setBootVisible(v){ this.boot.classList.toggle("hidden", !v); }
  setEndVisible(v){ this.end.classList.toggle("hidden", !v); }

  setHint(text){ this.hint.textContent = text || ""; }
  setStatus(text){ this.status.textContent = text || ""; }
  setObjective(text){ this.objective.textContent = text || ""; }

  showDialogue(node){
    this.dialogue.classList.remove("hidden");
    this.dlgName.textContent = node.name || "";
    this.dlgText.textContent = node.text || "";
    this.dlgChoices.innerHTML = "";

    if (this._choiceHandler) this._choiceHandler = null;

    if (node.choices && node.choices.length){
      node.choices.forEach(c => {
        const b = document.createElement("button");
        b.className = "choice";
        b.textContent = c.label;
        b.onclick = () => {
          if (this._choiceHandler) this._choiceHandler(c.key);
        };
        this.dlgChoices.appendChild(b);
      });
      this.dlgFooter.textContent = "Choose";
    } else {
      this.dlgFooter.textContent = "[E] advance";
    }
  }

  onChoice(handler){
    this._choiceHandler = handler;
  }

  hideDialogue(){
    this.dialogue.classList.add("hidden");
    this.dlgChoices.innerHTML = "";
    this._choiceHandler = null;
  }

  toggleJournal(v){
    const show = (v ?? this.journal.classList.contains("hidden"));
    this.journal.classList.toggle("hidden", !show);
  }

  toggleAccessibility(v){
    const show = (v ?? this.acc.classList.contains("hidden"));
    this.acc.classList.toggle("hidden", !show);
  }

  updateJournal(state){
    // objectives
    this.journalObjectives.innerHTML = "";
    state.objectives.forEach(o => {
      const div = document.createElement("div");
      div.className = "note";
      div.innerHTML = `<div class="note-title">${o.done ? "✓" : "•"} ${escapeHtml(o.text)}</div>`;
      this.journalObjectives.appendChild(div);
    });

    // theme fragments
    this.journalTheme.textContent = state.themeFragments.join("\n\n");

    // notes
    this.journalNotes.innerHTML = "";
    state.notes.slice().reverse().forEach(n => {
      const wrap = document.createElement("div");
      wrap.className = "note";
      wrap.innerHTML = `
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-body">${escapeHtml(n.body)}</div>
      `;
      this.journalNotes.appendChild(wrap);
    });
  }

  setPostFX({ grain=0.6, vignette=0.7 } = {}){
    this.grainLayer.style.opacity = String(clamp(grain, 0, 1));
    this.vignetteLayer.style.opacity = String(clamp(vignette, 0, 1));
  }

  setMeters({ breath=1, fear=0 }){
    this.breathFill.style.width = `${clamp(breath,0,1)*100}%`;
    this.fearFill.style.width = `${clamp(fear,0,1)*100}%`;
  }

  showEnd(text){
    this.endText.textContent = text;
    this.setEndVisible(true);
  }
}

function escapeHtml(s){
  return (s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
