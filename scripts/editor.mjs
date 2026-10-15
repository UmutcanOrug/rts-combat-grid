import {ID, ASSETS, THEMES, ATTRIBUTES, COMMANDS, array, escape as e, clone, normalizeConfig, normalizeSlot, autoConfig} from "./core.mjs";
import {itemActions} from "./actions.mjs";

const options = (entries, current) => Object.entries(entries).map(([value,label])=>`<option value="${e(value)}" ${value===current ? "selected" : ""}>${e(label)}</option>`).join("");
const field = (label, input, hint="") => `<label class="rcg-field"><span>${e(label)}</span>${input}${hint ? `<small>${e(hint)}</small>` : ""}</label>`;
const text = (name,value="",extra="") => `<input name="${name}" value="${e(value)}" ${extra}>`;
const imageField = (label,name,value) => field(label,`<div class="rcg-path">${text(name,value)}<button type="button" data-pick="${name}" title="Choose image">▧</button></div>`);
function bindPickers(root) {
  root.querySelectorAll("[data-pick]").forEach(button=>button.addEventListener("click",()=>{
    const input=root.querySelector(`[name="${button.dataset.pick}"]`);
    const Picker=foundry.applications.apps.FilePicker.implementation;
    new Picker({type:"image",current:input.value,callback:path=>{input.value=path;input.dispatchEvent(new Event("change",{bubbles:true}));}}).render(true);
  }));
}
const dialog = config => foundry.applications.api.DialogV2.wait({classes:["rcg-dialog"],position:{width:650},rejectClose:false,...config,render:(event,app)=>{
  config.render?.(event,app);
  const root=app.element;
  const validate=()=>{
    const pages=root.querySelector('[name="pages"]');
    if(pages)pages.setCustomValidity(pages.value.trim() ? "" : "Enter at least one page name.");
    const ref=root.querySelector('[name="ref"]');
    if(ref)ref.setCustomValidity(ref.value ? "" : "Select an entry for this button.");
    return root.querySelector("form").reportValidity();
  };
  root.addEventListener("click",ev=>{if(ev.target.closest('[data-action="save"],button[value="save"]') && !validate()){ev.preventDefault();ev.stopImmediatePropagation();}},true);
  root.addEventListener("submit",ev=>{if(!validate()){ev.preventDefault();ev.stopImmediatePropagation();}},true);
  for(const input of root.querySelectorAll("input,select,textarea"))input.addEventListener("input",()=>input.setCustomValidity(""));
}});
const values = app => Object.fromEntries(new FormData(app.element.querySelector("form")));

export async function editAppearance(controller) {
  const token=controller.token, actor=token.actor, config=clone(controller.config);
  const content=`<div class="rcg-edit-intro"><b>Command panel</b><p>${e(actor.name)} appearance and pages. Settings are saved to this actor.</p></div>
  <div class="rcg-form-grid">
  ${field("Base theme",`<select name="theme">${options(THEMES,config.theme)}</select>`)}
  ${field("Panel title",text("title",config.title,'placeholder="Actor name"'))}
  ${field("Columns",text("columns",config.columns,'type="number" min="3" max="8"'))}
  ${field("Rows",text("rows",config.rows,'type="number" min="2" max="6"'))}
  ${field("Button size (px)",text("size",config.size,'type="number" min="40" max="96"'))}
  ${field("Accent color",text("accent",config.accent,'placeholder="#87b7ce — leave blank for theme default"'))}
  ${imageField("Custom portrait","portrait",config.portrait)}
  ${imageField("Panel background","background",config.background)}
  ${imageField("Custom button frame (transparent PNG/WebP)","frame",config.frame)}
  ${field("Button labels",`<select name="labels">${options({no:"Icons only",yes:"Icons and labels"},config.labels ? "yes" : "no")}</select>`)}
  </div>
  ${field("Pages — one page name per line",`<textarea name="pages" rows="4">${e(config.pages.map(p=>p.name).join("\n"))}</textarea>`,"Up to 12 pages. Order is preserved. Append a line to add an empty page; deleting a line removes that page and its buttons.")}
  <div class="rcg-edit-tools"><button type="button" data-export>Export layout</button><label class="rcg-import">Import layout<input type="file" data-import accept=".json,application/json"></label><button type="button" data-position>Reset position</button></div><button type="button" data-rebuild>Rebuild layout from actor items</button>
  <p class="rcg-note">Drag items from the actor sheet onto the grid. Shrinking the grid keeps hidden slots; expanding it restores them.</p>`;
  let imported=null;
  const result=await dialog({window:{title:"RTS Combat Grid · Panel settings"},content,
    buttons:[{action:"save",label:"Save",default:true,callback:(_ev,_button,app)=>{
      if(imported) return imported;
      const data=values(app);
      const names=String(data.pages ?? "").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,12);
      if(!names.length) throw new Error("Enter at least one page name.");
      return normalizeConfig({...config,...data,labels:data.labels === "yes",pages:names.map((name,i)=>({name,slots:config.pages[i]?.slots ?? []}))});
    }},{action:"cancel",label:"Cancel"}],
    render:(_event,app)=>{
      const root=app.element;bindPickers(root);
      root.querySelector("[data-position]").addEventListener("click",()=>controller.resetPosition());
      root.querySelector("[data-rebuild]").addEventListener("click",()=>{imported=normalizeConfig({...config,pages:autoConfig(actor,config.theme).pages});root.querySelector(".rcg-edit-intro").textContent="A new layout is ready from the actor items. Click Save to replace the current button layout.";});
      root.querySelector("[data-export]").addEventListener("click",()=>{
        const blob=new Blob([JSON.stringify({format:ID,version:1,actor:actor.name,grid:config},null,2)],{type:"application/json"});
        const url=URL.createObjectURL(blob), a=document.createElement("a");a.href=url;a.download="rts-combat-grid.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      });
      root.querySelector("[data-import]").addEventListener("change",async event=>{
        const file=event.target.files?.[0];if(!file)return;
        try {
          if(file.size>200000)throw new Error("The layout file is too large.");
          const data=JSON.parse(await file.text());
          if(data.format !== ID || data.version !== 1 || !data.grid?.pages?.length) throw new Error("Choose an RTS Combat Grid v1 layout file.");
          imported=normalizeConfig(data.grid);
          root.querySelector(".rcg-edit-intro").textContent=`${file.name} is ready. ${imported.pages.length} pages · ${THEMES[imported.theme]}. Click Save to apply.`;
        } catch(error){ui.notifications.error(error.message);event.target.value="";}
      });
    }});
  if(result && typeof result === "object") await controller.saveConfig(result,token);
}

export async function editSlot(controller, index) {
  const token=controller.token, actor=token.actor, page=controller.page, existing=controller.config.pages[page].slots[index];
  const slot=existing ?? {kind:"item",ref:"",action:"attack",label:"",icon:"",hint:""};
  const kinds={item:"Weapon / power / skill / item",macro:"Foundry macro",attribute:"SWADE attribute",command:"Built-in command",condition:"Condition"};
  const references=kind=>kind === "item" ? Object.fromEntries(array(actor.items).map(item=>[item.id,`${item.name} · ${item.type}`])) : kind === "macro" ? Object.fromEntries(array(game.macros).filter(m=>m.canExecute !== false).map(m=>[m.id,m.name])) : kind === "attribute" ? ATTRIBUTES : kind === "command" ? COMMANDS : Object.fromEntries(CONFIG.statusEffects.map(effect=>[effect.id,game.i18n.localize(effect.name ?? effect.label ?? effect.id)]));
  let catalogue=[];
  try {const response=await fetch(`modules/${ID}/assets/catalog.json`);if(response.ok)catalogue=await response.json();} catch {/* User file picker is always available. */}
  const content=`<div class="rcg-edit-intro"><b>Button ${index+1}</b><p>${e(controller.config.pages[page].name)} · ${e(actor.name)}</p></div>
  <div class="rcg-form-grid">${field("Button type",`<select name="kind">${options(kinds,slot.kind)}</select>`)}${field("Assigned entry",`<select name="ref">${options(references(slot.kind),slot.ref)}</select>`)}
  ${field("Click action",`<select name="action"></select>`)}${field("Custom label",text("label",slot.label,'placeholder="Use entry name"'))}
  ${imageField("Custom icon","icon",slot.icon)}${field("Tooltip",text("hint",slot.hint,'placeholder="Automatic item details"'))}</div>
  ${catalogue.length ? `<p class="rcg-note">Game icon library — click to select</p><div class="rcg-icon-library">${catalogue.map(asset=>`<button type="button" data-icon="${e(`${ASSETS}/${asset.path}`)}" title="${e(asset.name)}"><img src="${e(`${ASSETS}/${asset.path}`)}" alt="${e(asset.name)}" loading="lazy"></button>`).join("")}</div>` : ""}
  <p class="rcg-note">Right-click a button during play to choose attack, damage, reload, and other item actions.</p>`;
  const result=await dialog({window:{title:"RTS Combat Grid · Edit button"},content,buttons:[
    {action:"save",label:"Save",default:true,callback:(_event,_button,app)=>{
      const normalized=normalizeSlot(values(app));
      if(!normalized) throw new Error("Select an entry for this button.");
      return {slot:normalized};
    }},{action:"clear",label:"Clear slot",callback:()=>({slot:null})},{action:"cancel",label:"Cancel"}],
    render:(_event,app)=>{
      const root=app.element;bindPickers(root);
      const kind=root.querySelector('[name="kind"]'),ref=root.querySelector('[name="ref"]'),action=root.querySelector('[name="action"]');
      const refreshAction=()=>{
        const item=actor.items.get(ref.value);
        action.innerHTML=options(kind.value === "item" ? Object.fromEntries(itemActions(item).map(a=>[a.ref,a.label])) : {attack:"Default"},slot.action);
        action.disabled=kind.value !== "item";
      };
      kind.addEventListener("change",()=>{ref.innerHTML=options(references(kind.value),"");refreshAction();});ref.addEventListener("change",refreshAction);refreshAction();
      root.querySelectorAll("[data-icon]").forEach(button=>button.addEventListener("click",()=>{root.querySelector('[name="icon"]').value=button.dataset.icon;root.querySelectorAll("[data-icon]").forEach(b=>b.classList.toggle("selected",b===button));}));
    }});
  if(result && typeof result === "object" && Object.hasOwn(result,"slot")) await controller.setSlot(page,index,result.slot,token);
}
