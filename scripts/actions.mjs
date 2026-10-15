import {canUse, ITEM_ACTIONS, loadoutItem, woundView} from "./core.mjs";
import {swadeTools,useToolsItem} from "./tools-bridge.mjs";
import {chooseItems,chooseSkills,chooseAttribute,chooseActions,chooseStatus,chooseEffects,showHelp} from "./menus.mjs";

export function assertControl(token,runtime=globalThis) {
  if(!canUse(token,runtime.game.user))throw new Error("You do not have permission to control this token.");
  if(runtime.game.paused && !runtime.game.user.isGM)throw new Error("The game is paused.");
}
export async function executeMacro(id,token,extra={},runtime=globalThis) {
  assertControl(token,runtime);
  const macro=runtime.game.macros?.get(id);
  if(!macro || macro.canExecute === false)throw new Error("The macro is missing or you do not have permission to execute it.");
  return macro.execute({actor:token.actor,token,tokenDocument:token.document,...extra});
}
export async function adjustWounds(token,change,runtime=globalThis) {
  assertControl(token,runtime);
  const health=woundView(token.actor);
  const value=change.delta !== undefined ? health.value+Number(change.delta) : Number(change.value);
  if(!Number.isFinite(value))throw new Error("Invalid wound value.");
  // Match the actor sheet's wound control. The system/Tools owns wound penalties.
  // Values over max represent incapacitation, including an Extra's first wound.
  return token.actor.update({"system.wounds.value":Math.max(0,Math.floor(value))});
}
export async function executeSlot(slot,token,event,runtime=globalThis) {
  assertControl(token,runtime);
  const actor=token.actor;
  if(slot.kind === "item" || slot.kind === "loadout") {
    const item=slot.kind === "loadout" ? loadoutItem(actor,slot.ref) : actor.items.get(slot.ref);
    if(!item || !item.isOwner)throw new Error("The item is missing or you do not have permission to use it.");
    return useToolsItem(item,token,slot.action || "attack",event,runtime);
  }
  if(slot.kind === "macro")return executeMacro(slot.ref,token,{},runtime);
  if(slot.kind === "attribute")return swadeTools(runtime).attribute(actor,slot.ref);
  if(slot.kind === "condition") {
    if(!runtime.CONFIG?.statusEffects?.some(e=>e.id === slot.ref))throw new Error("The condition is no longer available.");
    return actor.toggleStatusEffect(slot.ref);
  }
  switch(slot.ref) {
    case "sheet":return actor.sheet.render(true);
    case "run":return swadeTools(runtime).run(actor);
    case "benny":return actor.spendBenny();
    case "giveBenny":
      if(!runtime.game.user.isGM)throw new Error("Only the GM can grant Bennies.");
      return actor.getBenny();
    case "prone":return actor.toggleStatusEffect("prone");
    case "movement":
      if(slot.macro && (!runtime.game.macros?.get(slot.macro) || runtime.game.macros.get(slot.macro).canExecute === false))throw new Error("Choose a movement macro you can execute.");
      token.control?.({releaseOthers:true});
      await runtime.ui.controls.activate({control:"tokens",tool:"select"});
      return {movement:true,macro:slot.macro || ""};
    case "weapons":return chooseItems(token,"weapon",runtime);
    case "powers":return chooseItems(token,"power",runtime);
    case "items":return chooseItems(token,"item",runtime);
    case "skills":return chooseSkills(token,runtime);
    case "attributes":return chooseAttribute(token,runtime);
    case "actions":return chooseActions(token,runtime);
    case "status":return chooseStatus(token,runtime);
    case "effects":return chooseEffects(token,runtime);
    case "help":return showHelp(token,runtime);
    default:throw new Error("Command not found.");
  }
}
export function itemActions(item) {
  if(!item)return [];
  const rollable=["weapon","power","skill","action"].includes(item.type) || item.system?.actions?.trait || item.system?.isArcaneDevice;
  const base=rollable ? ["attack",...(["weapon","power"].includes(item.type) ? ["damage"] : []),...(item.type === "weapon" && Number(item.system?.shots)>0 ? ["reload"] : []),"card","sheet"] : ["card","sheet"];
  return base.map(ref=>({ref,label:ITEM_ACTIONS[ref]})).concat(Object.entries(item.system?.actions?.additional ?? {}).map(([ref,action])=>({ref,label:action.name || ref})));
}
