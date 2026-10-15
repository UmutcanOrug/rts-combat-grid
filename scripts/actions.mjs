import {canUse, ITEM_ACTIONS} from "./core.mjs";
export async function executeSlot(slot, token, event, runtime = globalThis) {
  const {game,canvas}=runtime;
  if(!canUse(token,game.user)) throw new Error("You do not have permission to control this token.");
  if(game.paused && !game.user.isGM) throw new Error("The game is paused.");
  const actor=token.actor;
  if(slot.kind === "item") {
    const item=actor.items.get(slot.ref);
    if(!item || !item.isOwner) throw new Error("The item is missing or you do not have permission to use it.");
    if(slot.action === "sheet") return item.sheet.render(true);
    if(slot.action === "card" || !["weapon","power","skill"].includes(item.type)) return item.show();
    if(item.type === "skill") return actor.rollSkill(item.id);
    const helper=(runtime.swade ?? game.swade)?.itemChatCardHelper;
    if(!helper?.handleAction) throw new Error("The SWADE action API is unavailable. Use SWADE 5.x on Foundry V13.");
    const action=slot.action === "attack" ? "formula" : slot.action;
    if(!["formula","damage","reload"].includes(action) && !Object.hasOwn(item.system?.actions?.additional ?? {},action)) throw new Error("The selected action is no longer available on this item.");
    const additionalMods=[];
    // SWADE normally gathers this modifier from the power chat card before handleAction.
    // A grid button has no card, so use the power's current cost, including its modifiers.
    if(item.type === "power" && game.settings?.get("swade","noPowerPoints") && (action === "formula" || item.system?.actions?.additional?.[action]?.type === "trait")) {
      const cost=Number(item.system.ppModifiers?.cost ?? item.system.pp) || 0;
      const modifier=Math.ceil(cost/2);
      additionalMods.push({label:game.i18n.localize("TYPES.Item.power"),value:Math.min(-modifier,modifier)});
    }
    // The system owns trait modifiers, ammo/PP consumption, chat cards and swadeAction hooks.
    return helper.handleAction(item,actor,action,{additionalMods,event});
  }
  if(slot.kind === "macro") {
    const macro=game.macros?.get(slot.ref);
    if(!macro || macro.canExecute === false) throw new Error("The macro is missing or you do not have permission to execute it.");
    return macro.execute({actor,token,tokenDocument:token.document});
  }
  if(slot.kind === "attribute") return actor.rollAttribute(slot.ref);
  if(slot.kind === "condition") {
    if(!runtime.CONFIG?.statusEffects?.some(e=>e.id === slot.ref)) throw new Error("The condition is no longer available.");
    return actor.toggleStatusEffect(slot.ref);
  }
  switch(slot.ref) {
    case "sheet": return actor.sheet.render(true);
    case "run": return actor.rollRunningDie();
    case "spirit": case "vigor": return actor.rollAttribute(slot.ref);
    case "benny": return actor.spendBenny();
    case "combat": return token.toggleCombat();
    case "target": return runtime.ui.controls.activate({control:"tokens",tool:"target"});
    case "clearTargets": return game.user.updateTokenTargets([]);
    default: throw new Error("Command not found.");
  }
}
export function itemActions(item) {
  if(!item) return [];
  const base=["weapon","power"].includes(item.type) ? ["attack","damage",...(item.type === "weapon" && Number(item.system?.shots)>0 ? ["reload"] : []),"card","sheet"] : item.type === "skill" ? ["attack","card","sheet"] : ["card","sheet"];
  return base.map(ref=>({ref,label:ITEM_ACTIONS[ref]})).concat(Object.entries(item.system?.actions?.additional ?? {}).map(([ref,action])=>({ref,label:action.name || ref})));
}
