import { pick } from "./utils.js";
import { fetchTextFragment } from "./fetchers.js";

export class DialogueSystem{
  constructor(ui){
    this.ui = ui;
    this.active = null;
    this.queue = [];
    this.onClose = null;
  }

  isOpen(){ return !!this.active; }

  async open(script, { onClose=null } = {}){
    this.onClose = onClose;
    this.queue = Array.isArray(script) ? [...script] : [script];
    await this.next();
  }

  async next(choiceKey=null){
    if (this.queue.length === 0){
      this.close();
      return;
    }
    const node = this.queue.shift();

    // dynamic node
    if (typeof node === "function"){
      const generated = await node(choiceKey);
      if (generated) this.queue.unshift(generated);
      return this.next();
    }

    this.active = node;
    this.ui.showDialogue(node);
  }

  close(){
    this.active = null;
    this.ui.hideDialogue();
    const cb = this.onClose;
    this.onClose = null;
    if (cb) cb();
  }
}

export function buildIntroDialogue(theme){
  return [
    { name:"RADIO", text:`…psshh… ${theme.base.toUpperCase()} …psshh… do you read?`, choices:[
      { key:"ok", label:"Who is this?" },
      { key:"silent", label:"(Say nothing.)" }
    ]},
    async (choice) => {
      const frag = await fetchTextFragment();
      if (choice === "silent"){
        return { name:"RADIO", text:`…psshh… silence is a kind of answer. ${frag}`, choices:[
          { key:"where", label:"Where is she?" },
          { key:"hang", label:"Turn it off." }
        ]};
      }
      return { name:"RADIO", text:`Your voice sounds… distant. Like it’s coming from the wrong room. ${frag}`, choices:[
        { key:"where", label:"Where is she?" },
        { key:"name", label:"What’s your name?" }
      ]};
    },
    async (choice) => {
      if (choice === "name"){
        return { name:"RADIO", text:`Names don’t survive the fog. Only patterns do.`, choices:[
          { key:"where", label:"Where is she?" }
        ]};
      }
      return { name:"RADIO", text:`You’ll find her where the town forgets to look. Follow the lights that fail.`, choices:[
        { key:"go", label:"I’m coming." }
      ]};
    },
    { name:"YOU", text:"My daughter… I heard her. I’m not leaving without her.", choices:[
      { key:"end", label:"(Continue.)" }
    ]}
  ];
}

export function buildNote(theme){
  const variants = [
    `The fog tastes like old paper. I keep seeing ${theme.base} in places it shouldn’t fit.`,
    `If you see a man-shaped outline in the mist: do not run first. Listen first.`,
    `The streets here turn inward. I walked a straight line and arrived behind myself.`
  ];
  return {
    title: pick([
      "Folded Map Fragment", "Waterlogged Note", "Receipt with Writing", "Hospital Tag", "A Child’s Drawing"
    ]),
    body: pick(variants)
  };
}
