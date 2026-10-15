import {ID,array,readConfig,normalizeConfig,makeNPCPreset,applyNPCPreset,matchItem,loadoutItem} from "./core.mjs";

export function baseActor(document,runtime=globalThis) {
  return document?.baseActor ?? runtime.game.actors?.get(document?.actorId) ?? (document?.parent?.documentName === "Actor" ? document.parent : !document?.actor?.isToken ? document?.actor : null);
}
export async function saveNPCDefault(document,config,runtime=globalThis) {
  const base=baseActor(document,runtime),actor=document.actor ?? base;
  if(!runtime.game.user.isGM || !base?.isOwner || !actor)throw new Error("Only a GM who owns the base actor can save an NPC default.");
  const normalized=normalizeConfig(config);
  for(const key of ["primary","secondary","sidearm"])if(!Object.hasOwn(normalized.loadout,key)){const item=loadoutItem(actor,key,normalized);normalized.loadout[key]=item?.id ?? "";}
  const preset=makeNPCPreset(actor,normalized);
  const refs=new Set(normalized.pages.flatMap(page=>page.slots).filter(slot=>slot?.kind === "item").map(slot=>slot.ref));
  for(const key of ["primary","secondary","sidearm"]){const item=loadoutItem(actor,key,normalized);if(item)refs.add(item.id);}
  // Preserve assigned token-only items so a newly created Extra can use the layout.
  const missing=[...refs].map(id=>actor.items.get(id)).filter(item=>item && !matchItem(base,item.id,preset.bindings[item.id]));
  if(missing.length)await base.createEmbeddedDocuments("Item",missing.map(item=>{const data=item.toObject();delete data._id;return data;}));
  const rebased=applyNPCPreset(preset,base,normalized.theme),saved=makeNPCPreset(base,rebased);
  await base.update({[`flags.${ID}.grid`]:rebased,[`flags.${ID}.defaultGrid`]:saved,[`prototypeToken.flags.${ID}.defaultGrid`]:saved});
  return saved;
}
export async function useNPCDefault(document,runtime=globalThis) {
  const base=baseActor(document,runtime),actor=document.actor;
  if(!runtime.game.user.isGM || !actor?.isOwner)throw new Error("Only a GM who owns this token can apply an NPC default.");
  const preset=base?.getFlag(ID,"defaultGrid") ?? document.getFlag?.(ID,"defaultGrid");
  if(!preset?.grid)throw new Error("Save an NPC default for this actor first.");
  const config=applyNPCPreset(preset,actor);
  await actor.setFlag(ID,"grid",config);
  return config;
}
export function addTokenConfigControls(app,html,controller,runtime=globalThis) {
  if(!runtime.game.user.isGM)return;
  const root=html instanceof HTMLElement ? html : html?.[0],document=app.document;
  const base=baseActor(document,runtime);
  if(!root || !base?.isOwner || root.querySelector("[data-rcg-preset]"))return;
  const section=globalThis.document.createElement("fieldset");section.dataset.rcgPreset="true";section.className="rcg-token-preset";
  section.innerHTML=`<legend>RTS Combat Grid</legend><p>Save this layout for new NPC tokens. Assigned items missing from the base actor are copied too.</p><div><button type="button" data-save-default>Save as NPC Default</button>${!app.isPrototype ? '<button type="button" data-use-default>Use NPC Default</button>' : ""}</div>`;
  const host=root.querySelector('.tab[data-tab="identity"]') ?? root.querySelector(".window-content") ?? root;
  host.append(section);
  const run=async action=>{try{await action();controller?.refresh();}catch(error){runtime.ui.notifications.error(error.message);}};
  section.querySelector("[data-save-default]").addEventListener("click",event=>{
    event.preventDefault();void run(async()=>{
      const current=controller?.token?.document;
      const source=current && baseActor(current,runtime)?.uuid === base.uuid ? current : document;
      const config=source === current ? controller.config : readConfig(document.actor ?? base,runtime.game.settings.get(ID,"theme"),document);
      await saveNPCDefault(source,config,runtime);runtime.ui.notifications.info(`NPC default saved for ${base.name}. New tokens will use this layout.`);
    });
  });
  section.querySelector("[data-use-default]")?.addEventListener("click",event=>{event.preventDefault();void run(async()=>{await useNPCDefault(document,runtime);runtime.ui.notifications.info("NPC default applied to this token.");});});
}
