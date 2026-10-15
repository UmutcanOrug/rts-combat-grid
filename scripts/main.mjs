import {ID, THEMES, readConfig, normalizeConfig, insertSlot, moveSlot, itemSlot, canUse, cssImage, escape as e} from "./core.mjs";
import {executeSlot,itemActions} from "./actions.mjs";
import {renderPanel} from "./view.mjs";
import {editAppearance,editSlot} from "./editor.mjs";

export class CombatGrid {
  token=null; config=null; page=0; editing=false; pinned=false; element=null; busy=false; menu=null; saveChain=Promise.resolve();
  constructor() {
    document.addEventListener("keydown",event=>{
      if(!this.element || event.defaultPrevented || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable || document.querySelector("dialog[open]")) return;
      if(event.key === "Escape"){this.close();event.preventDefault();}
      if(game.settings.get(ID,"hotkeys") && event.altKey && !event.ctrlKey && !event.metaKey && /^[1-9]$/.test(event.key)) {event.preventDefault();void this.activate(Number(event.key)-1,event);}
    });
    window.addEventListener("resize",()=>this.clampPosition());
  }
  open(token,{force=false}={}) {
    if(!game.settings.get(ID,"enabled") || game.system.id !== "swade" || !canUse(token,game.user)) return;
    if(this.pinned && this.token !== token && !force) return;
    const changed=this.token?.document.uuid !== token.document.uuid;
    this.token=token;this.config=readConfig(token.actor,game.settings.get(ID,"theme"));
    if(changed){this.page=0;this.editing=false;this.pinned=false;}
    this.page=Math.min(this.page,this.config.pages.length-1);
    if(!this.element){
      this.element=document.createElement("section");this.element.id="rts-combat-grid";this.element.setAttribute("aria-label","RTS Combat Grid");
      document.body.append(this.element);
      const pos=game.settings.get(ID,"position");
      if(Number.isFinite(pos?.left) && Number.isFinite(pos?.top)){this.element.style.left=`${pos.left}px`;this.element.style.top=`${pos.top}px`;this.element.style.bottom="auto";this.element.style.right="auto";}
      this.bind();
    }
    this.render();
  }
  render() {
    if(!this.element)return;
    if(!canUse(this.token,game.user)){this.close();return;}
    this.element.className=`rcg theme-${this.config.theme} ${this.editing ? "is-editing" : ""}`;
    this.element.style.setProperty("--rcg-columns",this.config.columns);
    this.element.style.setProperty("--rcg-size",`${this.config.size}px`);
    this.element.style.setProperty("--rcg-background",cssImage(this.config.background));
    this.element.style.setProperty("--rcg-custom-frame",cssImage(this.config.frame));
    this.element.style.setProperty("--rcg-label-height",this.config.labels ? "18px" : "0px");
    this.element.style.removeProperty("--rcg-accent");if(this.config.accent)this.element.style.setProperty("--rcg-accent",this.config.accent);
    this.element.innerHTML=renderPanel(this);this.closeMenu();
    this.element.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>img.remove(),{once:true}));
    this.clampPosition();
  }
  close(){this.element?.remove();this.element=null;this.token=null;this.pinned=false;this.editing=false;this.closeMenu();}
  refresh(){if(this.token){this.config=readConfig(this.token.actor,game.settings.get(ID,"theme"));this.page=Math.min(this.page,this.config.pages.length-1);this.render();}}
  async saveConfig(config,token=this.token) {
    if(!canUse(token,game.user))throw new Error("You do not have permission to save this layout.");
    const normalized=normalizeConfig(config);
    const save=this.saveChain.catch(()=>{}).then(()=>token.actor.setFlag(ID,"grid",normalized));
    this.saveChain=save;await save;
    if(this.token?.document.uuid === token.document.uuid){this.config=normalized;this.page=Math.min(this.page,this.config.pages.length-1);this.render();}
  }
  async setSlot(page,index,slot,token=this.token){if(this.token?.document.uuid !== token.document.uuid)return;await this.saveConfig(insertSlot(this.config,page,index,slot),token);}
  async activate(index,event) {
    if(!this.element || this.busy)return;
    if(this.editing || event?.shiftKey)return this.guard(()=>editSlot(this,index));
    const slot=this.config.pages[this.page]?.slots[index];if(!slot)return;
    await this.run(slot,event,this.element.querySelector(`[data-slot="${index}"]`));
  }
  async run(slot,event,button) {
    if(this.busy)return;this.busy=true;button?.classList.add("busy");
    try {await executeSlot(slot,this.token,event);}
    catch(error){this.error(error);}
    finally{this.busy=false;button?.classList.remove("busy");this.refresh();}
  }
  error(error){console.error(`${ID} |`,error);ui.notifications.error(error.message || "The action could not be completed.");}
  guard(action){return Promise.resolve().then(action).catch(error=>this.error(error));}
  bind() {
    const root=this.element;
    // Do not forward panel interactions to Foundry's canvas or global key handlers.
    root.addEventListener("pointerdown",event=>{event.stopPropagation();if(event.button===0 && event.target.closest("[data-drag-handle]") && !event.target.closest("button"))this.drag(event);});
    root.addEventListener("wheel",event=>event.stopPropagation(),{passive:true});
    root.addEventListener("click",event=>{
      event.stopPropagation();const button=event.target.closest("button");if(!button)return;
      if(button.dataset.slot !== undefined){void this.activate(Number(button.dataset.slot),event);return;}
      if(button.dataset.page !== undefined){this.page=Number(button.dataset.page);this.render();return;}
      if(button.dataset.command){void this.run({kind:"command",ref:button.dataset.command},event,button);return;}
      switch(button.dataset.ui){
        case "close":this.close();break;
        case "pin":this.pinned=!this.pinned;this.render();break;
        case "edit":this.editing=!this.editing;this.render();break;
        case "settings":void this.guard(()=>editAppearance(this));break;
        case "sheet":void this.run({kind:"command",ref:"sheet"},event,button);break;
      }
    });
    root.addEventListener("contextmenu",event=>{
      event.preventDefault();event.stopPropagation();
      const button=event.target.closest("[data-slot]");if(!button)return;
      const index=Number(button.dataset.slot);if(this.editing){void this.guard(()=>editSlot(this,index));return;}
      this.showMenu(index,button);
    });
    root.addEventListener("dragstart",event=>{
      const button=event.target.closest("[data-slot]");if(!button || !this.editing){event.preventDefault();return;}
      event.dataTransfer.setData("application/x-rcg-slot",JSON.stringify({actor:this.token.actor.uuid,page:this.page,index:Number(button.dataset.slot)}));event.dataTransfer.effectAllowed="move";
    });
    root.addEventListener("dragover",event=>{if(event.target.closest("[data-slot]")){event.preventDefault();event.dataTransfer.dropEffect=this.editing ? "move" : "copy";}});
    root.addEventListener("dragenter",event=>{const tab=event.target.closest("[data-page]");if(tab && this.editing && Number(tab.dataset.page)!==this.page){event.preventDefault();this.page=Number(tab.dataset.page);this.render();}});
    root.addEventListener("drop",event=>{event.preventDefault();event.stopPropagation();const cell=event.target.closest("[data-slot]");if(cell)void this.guard(()=>this.drop(event,Number(cell.dataset.slot)));});
  }
  async drop(event,index) {
    const token=this.token, page=this.page;
    const internal=event.dataTransfer.getData("application/x-rcg-slot");
    if(internal){
      const source=JSON.parse(internal);
      if(source.actor !== token.actor.uuid || !this.editing)throw new Error("Use edit mode on the same actor to move buttons.");
      if(!Number.isInteger(source.page)||!Number.isInteger(source.index)||!this.config.pages[source.page]||source.index<0||source.index>=this.config.columns*this.config.rows)throw new Error("Invalid button position.");
      await this.saveConfig(moveSlot(this.config,source.page,source.index,page,index),token);return;
    }
    const raw=event.dataTransfer.getData("text/plain");if(!raw)return;
    const data=JSON.parse(raw);let slot;
    if(data.type === "Item") {
      const item=await fromUuid(data.uuid);
      if(!item || item.parent?.uuid !== token.actor.uuid)throw new Error("Add the item to this actor first, then drag it onto the grid.");
      slot=itemSlot(item);
    } else if(data.type === "Macro") {
      const macro=await fromUuid(data.uuid);if(!macro || !game.macros.get(macro.id) || macro.canExecute === false)throw new Error("Choose a world macro you can execute.");
      slot={kind:"macro",ref:macro.id};
    } else return;
    if(this.token?.document.uuid !== token.document.uuid)return;
    await this.setSlot(page,index,slot,token);
  }
  showMenu(index,button) {
    this.closeMenu();const slot=this.config.pages[this.page]?.slots[index];
    const item=slot?.kind === "item" ? this.token.actor.items.get(slot.ref) : null;
    const menu=document.createElement("div");menu.className="rcg-context";menu.setAttribute("role","menu");
    menu.innerHTML=`<strong>${e(slot?.label || item?.name || "Button")}</strong>${itemActions(item).map(action=>`<button type="button" role="menuitem" data-item-action="${e(action.ref)}">${e(action.label)}</button>`).join("")}<button type="button" role="menuitem" data-edit-slot>✎ Edit button</button>`;
    const rect=button.getBoundingClientRect();menu.style.left=`Math.min(rect.left,innerWidth-210)}px`;menu.style.top=`${Math.max(8,rect.top-10)}px`;
    document.body.append(menu);this.menu=menu;
    const bounds=menu.getBoundingClientRect();if(bounds.bottom>innerHeight-8)menu.style.top=`${Math.max(8,innerHeight-bounds.height-8)}px`;
    menu.addEventListener("click",event=>{event.stopPropagation();const target=event.target.closest("button");if(!target)return;this.closeMenu();if(target.hasAttribute("data-edit-slot"))void this.guard(()=>editSlot(this,index));else void this.run({...slot,action:target.dataset.itemAction},event,button);});
    const outside=event=>{if(!menu.contains(event.target))this.closeMenu();};
    setTimeout(()=>{if(this.menu===menu){document.addEventListener("pointerdown",outside,true);this.menuCleanup=()=>document.removeEventListener("pointerdown",outside,true);}},0);
    menu.querySelector("button")?.focus();
  }
  closeMenu(){this.menuCleanup?.();this.menuCleanup=null;this.menu?.remove();this.menu=null;}
  drag(event) {
    const root=this.element, rect=root.getBoundingClientRect(), x=event.clientX-rect.left,y=event.clientY-rect.top;
    root.style.bottom="auto";root.style.right="auto";root.style.left=`${rect.left}px`;root.style.top=`${rect.top}px`;
    const move=ev=>{root.style.left=`${ev.clientX-x}px`;root.style.top=`${ev.clientY-y}px`;this.clampPosition();};
    const stop=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",stop);window.removeEventListener("pointercancel",stop);this.guard(()=>game.settings.set(ID,"position",{left:root.offsetLeft,top:root.offsetTop}));};
    window.addEventListener("pointermove",move);window.addEventListener("pointerup",stop,{once:true});window.addEventListener("pointercancel",stop,{once:true});
  }
  clampPosition(){
    const root=this.element;if(!root)return;
    root.style.setProperty("--rcg-viewport-scale","1");
    const rect=root.getBoundingClientRect();
    const scale=Math.min(1,(innerWidth-16)/rect.width,(innerHeight-16)/rect.height);
    root.style.setProperty("--rcg-viewport-scale",String(Math.max(0.2,scale)));
    const after=root.getBoundingClientRect();
    if(!root.style.left && (after.left<8 || after.top<8 || after.right>innerWidth-8 || after.bottom>innerHeight-8)){
      root.style.right="auto";root.style.bottom="auto";root.style.left=`${Math.max(8,Math.min(after.left,innerWidth-after.width-8))}px`;root.style.top=`${Math.max(8,Math.min(after.top,innerHeight-after.height-8))}px`;
    }
    if(root.style.left){const r=root.getBoundingClientRect();root.style.left=`${Math.min(Math.max(8,parseFloat(root.style.left)),Math.max(8,innerWidth-r.width-8))}px`;root.style.top=`${Math.min(Math.max(8,parseFloat(root.style.top)),Math.max(8,innerHeight-r.height-8))}px`;}
  }
  resetPosition(){if(!this.element)return;for(const key of ["left","top","bottom","right"])this.element.style.removeProperty(key);void this.guard(()=>game.settings.set(ID,"position",{}));this.clampPosition();}
}

export let grid;
Hooks.once("init",()=>{
  const register=(key,name,type,defaultValue,extra={})=>game.settings.register(ID,key,{name,scope:"client",config:true,type,default:defaultValue,...extra});
  register("enabled","RTS Combat Grid: Enable panel",Boolean,true,{onChange:value=>{if(!value)grid?.close();}});
  register("autoOpen","Open automatically when right-clicking a token",Boolean,true);
  register("theme","Default theme for new actors",String,"coh2",{scope:"world",choices:THEMES});
  register("follow","Follow the selected token while the panel is open",Boolean,true);
  register("hotkeys","Use Alt+1…9 to activate grid buttons",Boolean,false);
  register("position","Panel position",Object,{}, {config:false});
  game.keybindings.register(ID,"toggle",{name:"Toggle RTS command panel",editable:[{key:"KeyR",modifiers:["Control","Shift"]}],onDown:()=>{if(grid?.element)grid.close();else grid?.open(canvas.tokens.controlled[0],{force:true});return true;}});
});
Hooks.once("ready",()=>{
  if(game.system.id !== "swade")return;
  grid=new CombatGrid();
  game.modules.get(ID).api={open:token=>grid.open(token ?? canvas.tokens.controlled[0],{force:true}),close:()=>grid.close(),configure:()=>grid.token ? grid.guard(()=>editAppearance(grid)) : ui.notifications.info("Right-click a token first."),getConfig:actor=>readConfig(actor,game.settings.get(ID,"theme"))};
});
Hooks.on("renderTokenHUD",(hud,html)=>{
  if(!grid || !canUse(hud.object,game.user) || !game.settings.get(ID,"enabled"))return;
  const root=html instanceof HTMLElement ? html : html?.[0];
  const column=root?.querySelector(".col.right") ?? root;
  if(column && !column.querySelector(".rcg-launcher")){
    const token=hud.object, button=document.createElement("button");button.type="button";button.className="control-icon rcg-launcher";button.title="RTS Combat Grid";button.setAttribute("aria-label","RTS Combat Grid");button.innerHTML='<i class="fa-solid fa-table-cells"></i>';
    button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();grid.open(token,{force:true});});column.append(button);
  }
  if(game.settings.get(ID,"autoOpen"))grid.open(hud.object);
});
Hooks.on("controlToken",(token,controlled)=>{if(grid?.element && controlled && game.settings.get(ID,"follow") && !grid.pinned)grid.open(token);});
for(const hook of ["updateActor","updateItem","createItem","deleteItem","createActiveEffect","updateActiveEffect","deleteActiveEffect"]){
  Hooks.on(hook,document=>{const actor=document.documentName === "Actor" ? document : document.parent;if(grid?.token && actor?.uuid === grid.token.actor.uuid)grid.refresh();});
}
Hooks.on("updateToken",document=>{if(grid?.token?.document.uuid===document.uuid)grid.refresh();});
Hooks.on("deleteToken",document=>{if(grid?.token?.document.uuid===document.uuid)grid.close();});
Hooks.on("deleteActor",actor=>{if(grid?.token?.actor.uuid===actor.uuid)grid.close();});
Hooks.on("updateUser",user=>{if(user.id===game.user.id)grid?.refresh();});
Hooks.on("canvasTearDown",()=>grid?.close());
