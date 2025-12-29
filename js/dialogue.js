export class Dialogue {
  constructor(ui){
    this.ui = ui;
    this.opened = false;

    this.el = document.getElementById("dialogue");
    this.speakerEl = document.getElementById("speaker");
    this.bodyEl = document.getElementById("dialogueBody");
    this.choicesEl = document.getElementById("dialogueChoices");
    this.sigEl = document.getElementById("sig");

    this._choices = [];
    this._onChoose = null;
  }

  isOpen(){ return this.opened; }

  open({ speaker="…", text="", choices=null, onChoose=null, signal="WEAK" }){
    this.opened = true;
    this.el.classList.remove("hidden");
    this.speakerEl.textContent = speaker;
    this.bodyEl.textContent = text;
    this.sigEl.textContent = `Signal: ${signal}`;

    this._choices = Array.isArray(choices) ? choices : [];
    this._onChoose = onChoose;

    this.choicesEl.innerHTML = "";
    if (this._choices.length){
      this._choices.forEach((c, i)=>{
        const div = document.createElement("div");
        div.className = "choice";
        div.innerHTML = `<span class="k">[${i+1}]</span>${c}`;
        this.choicesEl.appendChild(div);
      });
    }
  }

  close(){
    if (!this.opened) return;
    this.opened = false;
    this.el.classList.add("hidden");
    this._choices = [];
    this._onChoose = null;
  }

  onKey(e){
    if (!this.opened) return;
    if (!this._choices.length) return;

    const n = parseInt(e.key, 10);
    if (!Number.isFinite(n)) return;
    const idx = n - 1;
    if (idx < 0 || idx >= this._choices.length) return;

    if (typeof this._onChoose === "function"){
      this._onChoose(idx, this._choices[idx]);
    }
    this.close();
  }
}

