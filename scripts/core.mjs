export const ID = "rts-combat-grid";
export const ASSETS = `modules/${ID}/assets`;
export const THEMES = {coh2:"CoH II · Frontline", sc2:"SC II · Terran", ironclad:"Ironclad", arcane:"Arcane", desert:"Desert"};
export const ATTRIBUTES = {agility:"Agility", smarts:"Smarts", spirit:"Spirit", strength:"Strength", vigor:"Vigor"};
export const COMMANDS = {weapons:"Weapon Loadout", powers:"Powers", actions:"Actions", items:"Use Item", skills:"Skills", attributes:"Attributes", movement:"Movement", benny:"Spend a Benny", help:"Help Me", prone:"Prone", shaken:"Shaken", run:"Run", status:"Status", effects:"Effects", sheet:"Character Sheet", giveBenny:"Give a Benny"};
export const DEFAULT_COMMANDS = ["prone","movement","skills","attributes","run","items","status","powers"];
export const LOADOUT = {primary:"1st Weapon",secondary:"2nd Weapon",sidearm:"3rd Weapon"};
export const CATEGORIES = ["base","commands","weapons","powers","actions","skills","items"];
export const commandSlots = () => DEFAULT_COMMANDS.map(ref=>({kind:"command",ref}));
export const GAME_COMMAND_ICONS = {
  coh2:{prone:"command-prone",movement:"command-movement",skills:"command-skills",attributes:"command-attributes",run:"command-run",items:"command-items",status:"command-status",powers:"command-powers",shaken:"command-shaken",weapons:"command-weapons",actions:"command-actions",effects:"command-effects",benny:"command-benny",giveBenny:"command-benny",help:"command-status",sheet:"command-items"},
  sc2:{prone:"hold",movement:"move",skills:"snipe",attributes:"defensivematrix",run:"charge",items:"stimpack",status:"scannersweep",powers:"emp",shaken:"stop",weapons:"attack",actions:"attack",effects:"cloak",benny:"hold",giveBenny:"hold",help:"patrol",sheet:"heal"}
};
export function commandIcon(ref,theme="coh2",iconSet="auto") {
  const group=["coh2","sc2"].includes(iconSet) ? iconSet : ["coh2","desert"].includes(theme) ? "coh2" : "sc2";
  const name=GAME_COMMAND_ICONS[group][ref];
  return name ? `${ASSETS}/${group}/${name}.webp` : "";
}
export const ITEM_ACTIONS = {attack:"Attack / use", damage:"Damage", reload:"Reload", card:"Chat card", sheet:"Item sheet"};
export const GLYPHS = {sheet:"▤", run:"➜", spirit:"◉", vigor:"✚", benny:"★", combat:"⚔", target:"⌖", clearTargets:"⊗", weapon:"⚔", power:"ϟ", skill:"◆", macro:"▶", attribute:"◇", condition:"◈", item:"⚔"};
export const DEFAULTS = {version:3, theme:"coh2", iconSet:"auto", loadout:{}, columns:5, rows:3, size:62, labels:true, title:"", portrait:"", background:"", frame:"", accent:"", pages:[]};
export const array = collection => collection?.contents ?? Array.from(collection?.values?.() ?? collection ?? []);
export const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
export const clone = value => structuredClone(value);
export const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Math.round(Number(value)))) : fallback;
export const imagePath = value => {
  const path = String(value ?? "").trim().slice(0,2048);
  if (!path || /[\x00-\x1f]/.test(path) || /^(?:javascript|data|vbscript|file):/i.test(path) || path.startsWith("//")) return "";
  if (/^[a-z][a-z\d+.-]*:/i.test(path) && !/^https?:/i.test(path)) return "";
  return path;
};
export const cssImage = path => path ? `url("${imagePath(path).replace(/\\/g,"\\\\").replace(/"/g,'\\"')}")` : "none";
export function normalizeSlot(raw) {
  if (!raw || !["loadout","item","macro","attribute","command","condition"].includes(raw.kind)) return null;
  const ref = String(raw.ref ?? "").slice(0,200);
  if (!ref) return null;
  if (raw.kind === "loadout" && !Object.hasOwn(LOADOUT,ref)) return null;
  if (raw.kind === "attribute" && !Object.hasOwn(ATTRIBUTES,ref)) return null;
  if (raw.kind === "command" && !Object.hasOwn(COMMANDS,ref)) return null;
  return {kind:raw.kind, ref, action:String(raw.action ?? "attack").slice(0,120), label:String(raw.label ?? "").slice(0,80), icon:imagePath(raw.icon), hint:String(raw.hint ?? "").slice(0,500), macro:String(raw.macro ?? "").slice(0,200)};
}
export function normalizeConfig(raw = {}, fallbackTheme = "coh2") {
  raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const config = {...DEFAULTS, theme:Object.hasOwn(THEMES,raw.theme) ? raw.theme : fallbackTheme,
    columns:bounded(raw.columns,3,8,5), rows:bounded(raw.rows,2,6,3), size:bounded(raw.size,40,96,62), labels:raw.labels !== false,
    title:String(raw.title ?? "").slice(0,80), portrait:imagePath(raw.portrait), background:imagePath(raw.background), frame:imagePath(raw.frame),
    accent:/^#[a-f\d]{6}$/i.test(raw.accent ?? "") ? raw.accent : ""};
  config.iconSet=["coh2","sc2"].includes(raw.iconSet) ? raw.iconSet : "auto";
  config.loadout=Object.fromEntries(Object.keys(LOADOUT).filter(key=>Object.hasOwn(raw.loadout ?? {},key)).map(key=>[key,String(raw.loadout[key] ?? "").slice(0,200)]));
  config.pages = (Array.isArray(raw.pages) ? raw.pages : []).slice(0,12).map((page,i) => ({
    id:`page-${i}`, name:String(page?.name ?? `Page ${i+1}`).slice(0,40), category:CATEGORIES.includes(page?.category) ? page.category : "custom",
    slots:(Array.isArray(page?.slots) ? page.slots : []).slice(0,48).map(normalizeSlot)
  }));
  return config;
}
export const itemSlot = item => ({kind:"item", ref:item.id, action:["weapon","power","skill","action"].includes(item.type) ? "attack" : "card", label:"", icon:"", hint:""});
export function loadoutItem(actor, ref, config) {
  const loadout=config?.loadout ?? actor?.getFlag?.(ID,"grid")?.loadout ?? {};
  if(Object.hasOwn(loadout,ref))return actor.items.get(loadout[ref]);
  const weapons=array(actor.items).filter(item=>item.type === "weapon");
  weapons.sort((a,b)=>Number(Boolean(b.system?.equipped))-Number(Boolean(a.system?.equipped)));
  const sidearm=weapons.find(item=>/\b(pistol|sidearm|handgun|revolver)\b/i.test(`${item.name} ${item.system?.category ?? ""}`));
  const primary=weapons.filter(item=>item !== sidearm);
  return ref === "sidearm" ? sidearm ?? primary[2] : primary[ref === "secondary" ? 1 : 0];
}
export function actorActionSlots(actor) {
  const items=array(actor.items);
  return items.filter(item=>item.type === "action").map(itemSlot).concat(items.filter(item=>item.type !== "action").flatMap(item=>
    Object.entries(item.system?.actions?.additional ?? {}).filter(([,action])=>action).map(([key,action])=>({kind:"item",ref:item.id,action:key,label:`${action.name || key} · ${item.name}`,icon:"",hint:"Configure this action in SWADE Tools."}))));
}
export function migrateConfig(raw, actor, theme="coh2") {
  const config=normalizeConfig(raw,theme);
  if(Number(raw?.version ?? 1)<2) {
    const standard=/^(Weapons|Powers|Skills|Commands|Actions|Items)( \d+)?$/;
    const custom=config.pages.filter(page=>!standard.test(page.name));
    const saved=config.pages.filter(page=>standard.test(page.name)).flatMap(page=>page.slots).filter(slot=>slot && (slot.kind === "macro" || slot.kind === "condition" || slot.label || slot.icon || slot.hint || (slot.kind === "item" && !["attack","card"].includes(slot.action))));
    config.pages=[...autoConfig(actor,theme).pages,...custom];
    for(let i=0;i<saved.length;i+=15)config.pages.push({name:`Saved Buttons${i ? ` ${i/15+1}` : ""}`,slots:saved.slice(i,i+15)});
  }
  const index=config.pages.findIndex(page=>page.category === "base");
  if(index>0)config.pages.unshift(config.pages.splice(index,1)[0]);
  return normalizeConfig(config,theme);
}
export function autoConfig(actor, theme = "coh2") {
  const config = normalizeConfig({},theme);
  const commands=commandSlots();
  config.pages=[{name:"Base",category:"base",slots:[{kind:"loadout",ref:"primary"},...commands.slice(0,4),{kind:"loadout",ref:"secondary"},...commands.slice(4),{kind:"loadout",ref:"sidearm"},null,null,null,null]}];
  return normalizeConfig(config,theme);
}
export function itemBinding(item) {
  return {name:item.name,type:item.type,source:item._stats?.compendiumSource || item.getFlag?.("core","sourceId") || "",swid:item.system?.swid || ""};
}
export function matchItem(actor,id,binding) {
  const items=array(actor.items),exact=actor.items.get?.(id);
  if(exact && (!binding || (exact.type === binding.type && exact.name === binding.name)))return exact;
  if(!binding)return null;
  for(const key of ["source","swid","name"]) {
    if(!binding[key])continue;
    const matches=items.filter(item=>item.type === binding.type && itemBinding(item)[key] === binding[key]);
    if(matches.length === 1)return matches[0];
  }
  return null;
}
export function makeNPCPreset(actor,config) {
  return {version:1,grid:normalizeConfig(config),bindings:Object.fromEntries(array(actor.items).map(item=>[item.id,itemBinding(item)]))};
}
export function applyNPCPreset(preset,actor,theme="coh2") {
  const config=migrateConfig(preset.grid,actor,theme);
  const rebind=id=>matchItem(actor,id,preset.bindings?.[id])?.id ?? id;
  for(const page of config.pages)for(const slot of page.slots)if(slot?.kind === "item")slot.ref=rebind(slot.ref);
  for(const key of Object.keys(config.loadout))if(config.loadout[key])config.loadout[key]=rebind(config.loadout[key]);
  return config;
}
export function readConfig(actor, theme = "coh2", tokenDocument=actor?.token) {
  const base=tokenDocument?.baseActor;
  const synthetic=actor?.isToken || (base && base !== actor && tokenDocument.actorLink === false);
  const own=synthetic && tokenDocument?.delta ? tokenDocument.delta.getFlag?.(ID,"grid") : actor?.getFlag?.(ID,"grid");
  if(own?.pages?.length)return migrateConfig(own,actor,theme);
  const preset=base?.getFlag?.(ID,"defaultGrid") ?? tokenDocument?.getFlag?.(ID,"defaultGrid") ?? actor?.getFlag?.(ID,"defaultGrid");
  if(preset?.grid?.pages?.length)return applyNPCPreset(preset,actor,theme);
  const inherited=actor?.getFlag?.(ID,"grid");
  return inherited?.pages?.length ? migrateConfig(inherited,actor,theme) : autoConfig(actor,theme);
}
export function slotView(slot, actor, gameRef, theme, config) {
  if (!slot) return {empty:true,label:"Empty slot",hint:"Assign a command in edit mode.",glyph:"+"};
  let label="", icon="", hint="", disabled=false, badge="", type=slot.kind, active=false;
  if(slot.kind === "item" || slot.kind === "loadout") {
    const item=slot.kind === "loadout" ? loadoutItem(actor,slot.ref,config) : actor.items.get(slot.ref); disabled=!item;
    label=item?.name ?? "Missing item"; icon=imagePath(item?.img); type=item?.type ?? "item";
    const system=item?.system ?? {};
    if(type === "weapon") {
      hint=[ITEM_ACTIONS[slot.action] ?? slot.action, system.damage && `Damage ${system.damage}`,system.range && `Range ${system.range}`,system.rof && `RoF ${system.rof}`].filter(Boolean).join(" · ");
      const current=system.currentShots, max=system.shots;
      if(Number(max)>0 && current !== undefined) badge=`${current}/${max}`;
    } else if(type === "power") { hint=[ITEM_ACTIONS[slot.action] ?? slot.action,system.pp !== undefined && `${system.pp} PP`,system.range && `Range ${system.range}`].filter(Boolean).join(" · "); }
    else hint=type === "skill" ? `Skill roll · d${system.die?.sides ?? "?"}` : type === "action" ? "Open the SWADE Tools action dialog" : "Item card";
    if(slot.kind === "loadout") {hint=item ? `${item.name} · ${hint}` : "No weapon assigned. Open Weapon Loadout to assign one.";label=LOADOUT[slot.ref];if(!icon)icon=commandIcon("weapons",theme,config?.iconSet);}
  } else if(slot.kind === "macro") {
    const macro=gameRef.macros?.get(slot.ref); disabled=!macro || macro.canExecute === false;
    label=macro?.name ?? "Missing macro";icon=imagePath(macro?.img);hint="Run the macro with this actor and token";
  } else if(slot.kind === "attribute") {label=ATTRIBUTES[slot.ref]; hint=`Attribute roll · d${actor.system?.attributes?.[slot.ref]?.die?.sides ?? "?"}`;}
  else if(slot.kind === "condition") {
    const effect=globalThis.CONFIG?.statusEffects?.find(e=>e.id === slot.ref);
    label=effect ? gameRef.i18n.localize(effect.name ?? effect.label ?? effect.id) : slot.ref;
    icon=imagePath(effect?.img ?? effect?.icon);hint="Toggle condition";active=actor.statuses?.has(slot.ref) ?? false;
    disabled=!effect;
  } else {label=COMMANDS[slot.ref];hint=label;
    icon=commandIcon(slot.ref,theme,config?.iconSet);
    if(["prone","shaken"].includes(slot.ref))active=actor.statuses?.has(slot.ref) ?? false;
    if(slot.ref === "giveBenny"){disabled=!gameRef.user?.isGM;hint="GM only: grant a Benny to this actor.";}
    if(slot.ref === "help")hint="Quick guidance for main and free actions, with SWADE Tools skill rolls.";
    if(slot.ref === "actions")hint="Actor Action items, additional item actions, and installed SWADE action compendiums.";
  }
  return {empty:false,label:slot.label || label,icon:slot.icon || icon,hint:slot.hint || hint,disabled,badge,glyph:GLYPHS[slot.kind === "command" ? slot.ref : type] ?? "◆",active,type};
}
export function insertSlot(config, pageIndex, index, slot) {
  const next=normalizeConfig(config);
  if(!next.pages[pageIndex] || index<0 || index>=next.columns*next.rows) throw new Error("Invalid slot.");
  while(next.pages[pageIndex].slots.length<=index) next.pages[pageIndex].slots.push(null);
  next.pages[pageIndex].slots[index]=normalizeSlot(slot);
  return next;
}
export function moveSlot(config, sourcePage, sourceIndex, targetPage, targetIndex) {
  const a=config.pages[sourcePage]?.slots[sourceIndex] ?? null;
  const b=config.pages[targetPage]?.slots[targetIndex] ?? null;
  const next=insertSlot(config,targetPage,targetIndex,a);
  return insertSlot(next,sourcePage,sourceIndex,b);
}
export function canUse(token, user) {
  return Boolean(token?.actor && !token.destroyed && token.actor.isOwner && (user?.isGM || (!token.document?.hidden && token.isVisible !== false)));
}
export function statView(actor) {
  const system=actor.system ?? {};
  return {wounds:`${system.wounds?.value ?? 0}/${system.wounds?.max ?? 3}`,fatigue:`${system.fatigue?.value ?? 0}/${system.fatigue?.max ?? 2}`,bennies:system.bennies?.value ?? "—",pp:system.powerPoints?.general?.value ?? system.powerPoints?.value ?? "—",parry:system.stats?.parry?.value ?? "—",toughness:system.stats?.toughness?.value ?? "—"};
}
export function woundView(actor) {
  const max=Math.max(0,Math.floor(Number(actor.system?.wounds?.max) || 0));
  const value=Math.max(0,Math.floor(Number(actor.system?.wounds?.value) || 0));
  return {max,value,incapacitated:value>max || Boolean(actor.statuses?.has("incapacitated"))};
}
