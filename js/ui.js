import { clamp } from "./utils.js";

export class UI {
  constructor(){
    this.prompt = document.getElementById("prompt");
    this.promptText = document.getElementById("promptText");
    this.objectiveText = document.getElementById("objectiveText");

    this.journal = document.getElementById("journal");
    this.journalBody = document.getElementById("journalBody");
    this.journalTheme = document.getElementById("journalTheme");

    this.hint = document.getElementById("hint");

    this._signal = 0;
    this._danger = 0;

    this._pulseT = 0;
    this._lastFlash = 0;
  }

  setObjective(text){
    this.objectiveText.textContent = text;
  }

  showPrompt(text){
    this.promptText.textContent = text;
    this.prompt.classList.remove("hidden");
  }

  hidePrompt(){
    this.prompt.classList.add("hidden");
  }

  flashPrompt(text){
    this.showPrompt(text);
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(()=> this.hidePrompt(), 1500);
  }

  toggleJournal(){
    this.journal.classList.toggle("hidden");
  }

  setJournalTheme(theme){
    this.journalTheme.textContent = `Theme: ${theme}`;
  }

  appendJournal(text){
    this.journalBody.textContent += text;
    this.journal.scrollTop = this.journal.scrollHeight;
  }

  setSignal(signal, danger){
    this._signal = clamp(signal, 0, 1);
    this._danger = clamp(danger, 0, 1);

    // reflect in hint text subtly
    const sigWord =
      this._signal < 0.25 ? "WEAK" :
      this._signal < 0.55 ? "STABLE" :
      this._signal < 0.85 ? "STRONG" : "MAX";

    const dWord =
      this._danger < 0.18 ? "" :
      this._danger < 0.5 ? " • pressure rising" :
      this._danger < 0.8 ? " • DO NOT TURN AROUND" :
      " • RUN";

    this.hint.style.opacity = (this._danger > 0.6) ? "0.92" : "0.7";
    this.hint.textContent = `Signal: ${sigWord}${dWord} • WASD move • Mouse look • E interact • TAB journal`;
    // vignette intensity
    const v = document.getElementById("vignette");
    v.style.opacity = String(0.85 + this._danger*0.35);
  }
}

