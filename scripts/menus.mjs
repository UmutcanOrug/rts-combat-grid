import {array,ATTRIBUTES,actorActionSlots,escape as e,canUse} from "./core.mjs";
import {swadeTools,useToolsItem} from "./tools-bridge.mjs";

function check(token,runtime) {
  if(!canUse(token,runtime.game.user))throw new Error("You do not have permission to control this token.");
  if(runtime.game.paused && !runtime.game.user.isGM)throw new Error("The game is paused.");
}
const wait=(runtime,options)=>runtime.foundry.applications.api.DialogV2.wait({classes:["rcg-dialog"],position:{width:480},rejectClose:false,...options});
export async function chooseEntry(title,entries,runtime=globalThis,{empty="No entries are available on this actor.",intro="Choose an entry to continue."}={}) {
  const result=await wait(runtime,{window:{title},content:`<p class="rcg-note">${e(intro)}</p>${entries.length ? `<label class="rcg-field"><span>Search</span><input type="search" data-search autocomplete="off"></label><label class="rcg-field"><span>Available entries</span><select name="entry" size="${Math.min(10,Math.max(3,entries.length))}">${entries.map((entry,i)=>`<option value="${i}" ${i===0 ? "selected" : ""}>${e(entry.label)}</option>`).join("")}</select></label>` : `<p>${e(empty)}</p>`}`,
    buttons:[...(entries.length ? [{action:"use",label:"Use",default:true,callback:(_ev,_button,app)=>{
      const selected=app.element.querySelector('[name="entry"]').value;
      return selected === "" ? null : {entry:entries[Number(selected)]};
    }}] : []),{action:"cancel",label:"Close"}],render:(_ev,app)=>{
      const search=app.element.querySelector("[data-search]"),select=app.element.querySelector('[name="entry"]');
      search?.addEventListener("input",()=>{const query=search.value.toLowerCase();for(const option of select.options)option.hidden=!option.textContent.toLowerCase().includes(query);select.value=Array.from(select.options).find(option=>!option.hidden)?.value ?? "";});
    }});
  return result?.entry ?? null;
}
export async function chooseItems(token,kind,runtime=globalThis) {
  const items=array(token.actor.items).filter(item=>item.isOwner && (kind === "item" ? ["gear","consumable","armor","shield"].includes(item.type) || (item.type === "weapon" && (item.system?.quantity !== undefined || /grenade|bomb/i.test(item.name))) : item.type === kind));
  const entry=await chooseEntry(kind === "weapon" ? "Use Weapon" : kind === "power" ? "Powers" : "Use Item",items.map(item=>({label:`${item.name}${item.system?.quantity !== undefined ? ` · ${item.system.quantity} remaining` : ""}`,item})),runtime,{intro:"Weapons and powers open SWADE Tools. Other items open their card, with the system's use controls."});
  if(!entry)return;
  check(token,runtime);
  return useToolsItem(entry.item,token,["weapon","power"].includes(entry.item.type) || entry.item.system?.actions?.trait || entry.item.system?.isArcaneDevice ? "attack" : "card",null,runtime);
}
export async function chooseSkills(token,runtime=globalThis) {
  const entry=await chooseEntry("Skill Roll",array(token.actor.items).filter(item=>item.type === "skill").map(item=>({label:`${item.name} · d${item.system?.die?.sides ?? "?"}`,id:item.id})),runtime);
  if(entry){check(token,runtime);return swadeTools(runtime).skill(token.actor,entry.id);}
}
export async function chooseAttribute(token,runtime=globalThis) {
  const entry=await chooseEntry("Attribute Roll",Object.entries(ATTRIBUTES).map(([id,label])=>({id,label:`${label} · d${token.actor.system?.attributes?.[id]?.die?.sides ?? "?"}`})),runtime);
  if(entry){check(token,runtime);return swadeTools(runtime).attribute(token.actor,entry.id);}
}
export async function actionLibrary(runtime=globalThis) {
  const entries=array(runtime.game.items).filter(item=>item.type === "action" && item.visible !== false).map(item=>({label:`${item.name} · World Action`,document:item}));
  const packs=array(runtime.game.packs).filter(pack=>pack.documentName === "Item" && pack.visible !== false);
  for(const pack of packs) {
    try {
      const index=await pack.getIndex({fields:["type"]});
      for(const item of array(index).filter(item=>item.type === "action"))entries.push({label:`${item.name} · ${pack.metadata.label}`,pack,id:item._id ?? item.id});
    } catch(error){console.warn("rts-combat-grid | Could not read action compendium",pack.collection,error);}
  }
  return entries;
}
export async function chooseActions(token,runtime=globalThis) {
  const own=actorActionSlots(token.actor).map(slot=>({label:slot.label || token.actor.items.get(slot.ref)?.name || "Action",slot}));
  const maneuvers=[["aiming","Aim"],["defending","Defend"],["holding","Hold"],["wild-attack","Wild Attack"]].filter(([id])=>runtime.CONFIG.statusEffects.some(effect=>effect.id === id)).map(([status,label])=>({status,label:`${token.actor.statuses?.has(status) ? "✓ " : ""}${label} · Toggle Status`}));
  const entries=[...own,...maneuvers,{label:"Browse Action Library…",library:true},{label:"Support / Test · Skill Roll",helper:"skill"},{label:"Recover from Shaken · Spirit Roll",helper:"spirit"},{label:"Run · Running Die",helper:"run"}];
  const entry=await chooseEntry("Actions",entries,runtime,{intro:"Actor Action items and additional weapon/power actions use SWADE Tools. Browse installed Action compendiums to add another action."});
  if(!entry)return;
  check(token,runtime);
  if(entry.status)return token.actor.toggleStatusEffect(entry.status);
  if(entry.helper === "skill")return chooseSkills(token,runtime);
  if(entry.helper === "spirit")return swadeTools(runtime).attribute(token.actor,"spirit");
  if(entry.helper === "run")return swadeTools(runtime).run(token.actor);
  if(!entry.library) {
    const item=token.actor.items.get(entry.slot.ref);
    if(!item?.isOwner)throw new Error("The action is missing or no longer available.");
    return useToolsItem(item,token,entry.slot.action,null,runtime);
  }
  const external=await chooseEntry("Action Library",await actionLibrary(runtime),runtime,{intro:"Use adds a copy to this actor and opens it in SWADE Tools.",empty:"No accessible Action items were found. Add Action items to the actor, or enable an installed SWADE Action compendium."});
  if(!external)return;
  check(token,runtime);
  const source=external.document ?? await external.pack.getDocument(external.id);
  if(!source || source.type !== "action")throw new Error("This Action is no longer available.");
  const data=source.toObject();delete data._id;
  const [item]=await token.actor.createEmbeddedDocuments("Item",[data]);
  if(item)return useToolsItem(item,token,"attack",null,runtime);
}
export async function chooseStatus(token,runtime=globalThis) {
  const entry=await chooseEntry("Status",(runtime.CONFIG.statusEffects ?? []).map(effect=>({id:effect.id,label:`${token.actor.statuses?.has(effect.id) ? "✓ " : ""}${runtime.game.i18n.localize(effect.name ?? effect.label ?? effect.id)}`})),runtime,{intro:"Use toggles the selected condition."});
  if(entry){check(token,runtime);return token.actor.toggleStatusEffect(entry.id);}
}
export async function chooseEffects(token,runtime=globalThis) {
  const effects=array(token.actor.allApplicableEffects?.() ?? token.actor.effects).filter(effect=>effect.isOwner !== false);
  const entry=await chooseEntry("Effects",effects.map(effect=>({effect,label:`${effect.disabled ? "Off" : "On"} · ${effect.name}`})),runtime,{intro:"Use enables or disables the selected effect.",empty:"This actor has no editable active effects."});
  if(entry){check(token,runtime);return entry.effect.update({disabled:!entry.effect.disabled});}
}
export async function showHelp(token,runtime=globalThis) {
  const entry=await chooseEntry("Help Me",[{label:"Support / Test: choose a skill",ref:"skill"},{label:"Recover from Shaken: Spirit roll",ref:"spirit"},{label:"Run: roll the running die",ref:"run"}],runtime,{intro:"Choose a roll, then configure its modifiers in SWADE Tools. Support and Tests still require the appropriate target and GM ruling."});
  if(!entry)return;
  check(token,runtime);
  if(entry.ref === "skill")return chooseSkills(token,runtime);
  return entry.ref === "run" ? swadeTools(runtime).run(token.actor) : swadeTools(runtime).attribute(token.actor,"spirit");
}
