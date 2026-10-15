export const ID = "rts-combat-grid";
export const ASSETS = `modules/${ID}/assets`;
export const THEMES = {coh2: "CoH II · Frontline", sc2: "SC II · Terran"};
export const ATTRIBUTES = {agility:"Agility", smarts:"Smarts", spirit:"Spirit", strength:"Strength", vigor:"Vigor"};
export const COMMANDS = {sheet:"Character sheet", run:"Run", spirit:"Spirit roll", vigor:"Vigor roll", benny:"Spend a Benny", combat:"Toggle combat", target:"Select targets", clearTargets:"Clear targets"};
export const ITEM_ACTIONS = {attack:"Attack / use", damage:"Damage", reload:"Reload", card:"Chat card", sheet:"Item sheet"};
export const GLYPHS = {sheet:"▤", run:"➜", spirit:"◉", vigor:"✚", benny:"★", combat:"⚔", target:"⌖", clearTargets:"⊗", weapon:"⚔", power:"ϟ", skill:"◆", macro:"▶", attribute:"◇", condition:"◈", item:"⚔"};
export const DEFAULTS = {version:1, theme:"coh2", columns:5, rows:3, size:62, labels:false, title:"", portrait:"", background:"", frame:"", accent:"", pages:[]};
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
  if (!raw || !["item","macro","attribute","command","condition"].includes(raw.kind)) return null;
  const ref = String(raw.ref ?? "").slice(0,200);
  if (!ref) return null;
  if (raw.kind === "attribute" && !Object.hasOwn(ATTRIBUTES,ref)) return null;
  if (raw.kind === "command" && !Object.hasOwn(COMMANDS,ref)) return null;
  return {kind:raw.kind, ref, action:String(raw.action ?? "attack").slice(0,120), label:String(raw.label ?? "").slice(0,80), icon:imagePath(raw.icon), hint:String(raw.hint ?? "").slice(0,500)};
}
export function normalizeConfig(raw = {}, fallbackTheme = "coh2") {
  raw = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const config = {...DEFAULTS, theme:Object.hasOwn(THEMES,raw.theme) ? raw.theme : fallbackTheme,
    columns:bounded(raw.columns,3,8,5), rows:bounded(raw.rows,2,6,3), size:bounded(raw.size,40,96,62), labels:raw.labels === true,
    title:String(raw.title ?? "").slice(0,80), portrait:imagePath(raw.portrait), background:imagePath(raw.background), frame:imagePath(raw.frame),
    accent:/^#[a-f\d]{6}$/i.test(raw.accent ?? "") ? raw.accent : ""};
  config.pages = (Array.isArray(raw.pages) ? raw.pages : []).slice(0,12).map((page,i) => ({
    id:`page-${i}`, name:String(page?.name ?? `Page ${i+1}`).slice(0,40),
    slots:(Array.isArray(page?.slots) ? page.slots : []).slice(0,48).map(normalizeSlot)
  }));
  return config;
}
export const itemSlot = item => ({kind:"item", ref:item.id, action:["weapon","power"].includes(item.type) ? "attack" : item.type === "skill" ? "attack" : "card", label:"", icon:"", hint:""});
export function autoConfig(actor, theme = "coh2") {
  const config = normalizeConfig({},theme);
  const items = array(actor.items);
  const count = config.columns * config.rows;
  const add = (name, slots) => {
    for(let i=0;i<Math.max(1,slots.length);i+=count) config.pages.push({id:`page-${config.pages.length}`,name:`${name}${i ? ` ${Math.floor(i/count)+1}` : ""}`,slots:slots.slice(i,i+count)});
  };
  add("Weapons", items.filter(i => i.type === "weapon").map(itemSlot));
  add("Powers",items.filter(i => i.type === "power").map(itemSlot));
  add("Skills",items.filter(i => i.type === "skill").map(itemSlot));
  add("Commands",Object.keys(COMMANDS).map(ref => ({kind:"command",ref})).concat(Object.keys(ATTRIBUTES).map(ref=>({kind:"attribute",ref}))));
  return normalizeConfig(config,theme);
}
export function readConfig(actor, theme = "coh2") {
  const raw=actor?.getFlag?.(ID,"grid");
  return raw?.pages?.length ? normalizeConfig(raw,theme) : autoConfig(actor,theme);
}
export function slotView(slot, actor, gameRef, theme) {
  if (!slot) return {empty:true,label:"Empty slot",hint:"Assign a command in edit mode.",glyph:"+"};
  let label="", icon="", hint="", disabled=false, badge="", type=slot.kind, active=false;
  if(slot.kind === "item") {
    const item=actor.items.get(slot.ref); disabled=!item;
    label=item?.name ?? "Missing item"; icon=imagePath(item?.img); type=item?.type ?? "item";
    const system=item?.system ?? {};
    if(type === "weapon") {
      hint=[ITEM_ACTIONS[slot.action] ?? slot.action, system.damage && `Damage ${system.damage}`,system.range && `Range ${system.range}`,system.rof && `RoF ${system.rof}`].filter(Boolean).join(" · ");
      const current=system.currentShots, max=system.shots;
      if(Number(max)>0 && current !== undefined) badge=`${current}/${max}`;
    } else if(type === "power") { hint=[ITEM_ACTIONS[slot.action] ?? slot.action,system.pp !== undefined && `${system.pp} PP`,system.range && `Range ${system.range}`].filter(Boolean).join(" · "); }
    else hint=type === "skill" ? `Skill roll · d${system.die?.sides ?? "?"}` : "Item card";
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
    if(theme === "sc2") icon=({run:`${ASSETS}/sc2/move.webp`,spirit:`${ASSETS}/sc2/hold.webp`,vigor:`${ASSETS}/sc2/stimpack.webp`,combat:`${ASSETS}/sc2/attack.webp`,target:`${ASSETS}/sc2/patrol.webp`,clearTargets:`${ASSETS}/sc2/stop.webp`})[slot.ref] ?? "";
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
