export function swadeTools(runtime=globalThis) {
  const active=runtime.game.modules?.get("swade-tools")?.active;
  const tools=runtime.game.swadetools;
  if(active === false || !tools?.item || !tools?.skill || !tools?.attribute || !tools?.run)throw new Error("Enable SWADE Tools 2.2.2 or later to use this command grid.");
  return tools;
}

export async function useToolsItem(item, token, action="attack", event, runtime=globalThis) {
  const tools=swadeTools(runtime),actor=token.actor;
  if(action === "sheet")return item.sheet.render(true);
  if(action === "card")return item.show();
  if(item.type === "skill")return tools.skill(actor,item.id);
  if(action === "reload") {
    if(typeof item.reload !== "function")throw new Error("This item cannot be reloaded.");
    return item.reload();
  }
  const additional=item.system?.actions?.additional?.[action];
  if(!["attack","damage"].includes(action) && !additional)throw new Error("The selected action is no longer available on this item.");
  // Make the selected additional action the dialog's default. Opening the panel
  // never rolls or consumes resources; the player confirms its modifiers there.
  let hook,expiry;
  if(additional && runtime.Hooks?.on) {
    hook=runtime.Hooks.on("renderDialog",app=>{
      if((app.data?.title ?? app.title ?? app.options?.title) !== item.name || !app.data?.buttons?.[action])return;
      app.data.default=action;
      const root=app.element?.[0] ?? app.element;
      root?.querySelector?.(`button[data-button="${globalThis.CSS?.escape?.(action) ?? action.replace(/[^a-zA-Z0-9_-]/g,"")}"]`)?.classList.add("rcg-preferred-action");
      runtime.Hooks.off("renderDialog",hook);clearTimeout(expiry);
    });
    expiry=setTimeout(()=>runtime.Hooks.off("renderDialog",hook),10000);expiry.unref?.();
  }
  try {
    if(item.type === "action" || (item.type === "shield" && item.system?.actions?.trait) || (item.type === "gear" && (item.system?.isArcaneDevice || item.system?.actions?.trait))) {
      const api=runtime.game.swade?.swadetoolsAttack;
      if(typeof api !== "function")throw new Error("The SWADE Tools action dialog is unavailable. Update SWADE Tools.");
      return await api(actor,item,true);
    }
    return await tools.item(actor,item.id,null,{token,restoreLast:false,damageOnly:action === "damage"});
  } catch(error){if(hook){runtime.Hooks.off("renderDialog",hook);clearTimeout(expiry);}throw error;}
}
