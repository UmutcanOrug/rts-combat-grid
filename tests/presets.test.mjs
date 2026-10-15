import test from "node:test";
import assert from "node:assert/strict";
import {ID,autoConfig,readConfig,makeNPCPreset,applyNPCPreset,loadoutItem,commandIcon,normalizeConfig} from "../scripts/core.mjs";
import {saveNPCDefault,useNPCDefault} from "../scripts/presets.mjs";

function fixture() {
  const items=new Map([['rifle',{id:'rifle',name:'Rifle',type:'weapon',system:{swid:'rifle'}}],['pistol',{id:'pistol',name:'Pistol',type:'weapon',system:{swid:'pistol'}}]]);
  const flags={};
  const base={id:'A',uuid:'Actor.A',name:'Infantry',isOwner:true,documentName:'Actor',items,flags,prototypeToken:{flags:{}},getFlag:(id,key)=>flags[id]?.[key],async update(change){this.lastUpdate=change;for(const [key,value] of Object.entries(change)){const parts=key.split('.');let target=this;for(const part of parts.slice(0,-1))target=target[part] ??= {};target[parts.at(-1)]=structuredClone(value);}}};
  const doc={uuid:'Scene.S.Token.T',baseActor:base,actor:base,actorId:'A',actorLink:false};
  const runtime={game:{user:{isGM:true},actors:new Map([['A',base]])}};
  return {items,base,doc,runtime};
}
test('manual weapon choices and explicit empty override automatic matching',()=>{
  const f=fixture(),config=normalizeConfig({...autoConfig(f.base),loadout:{primary:'pistol',secondary:'',sidearm:'rifle'}});
  assert.equal(loadoutItem(f.base,'primary',config).id,'pistol');assert.equal(loadoutItem(f.base,'secondary',config),undefined);assert.equal(loadoutItem(f.base,'sidearm',config).id,'rifle');
});
test('command icons follow the selected theme, with an explicit icon-set override',()=>{
  assert.match(commandIcon('movement','coh2'),/coh2\/command-movement\.webp$/);assert.match(commandIcon('movement','sc2'),/sc2\/move\.webp$/);assert.match(commandIcon('shaken','desert'),/coh2\/command-shaken\.webp$/);assert.match(commandIcon('run','coh2','sc2'),/sc2\/charge\.webp$/);
});
test('NPC preset rebinds item buttons and three weapon assignments after item IDs change',()=>{
  const f=fixture(),config=autoConfig(f.base);config.loadout={primary:'rifle',secondary:'',sidearm:'pistol'};config.pages[0].slots[11]={kind:'item',ref:'pistol',action:'attack'};
  const target={items:new Map([['r2',{id:'r2',name:'Renamed Rifle',type:'weapon',system:{swid:'rifle'}}],['p2',{id:'p2',name:'Pistol',type:'weapon',system:{swid:'pistol'}}]])};
  const restored=applyNPCPreset(makeNPCPreset(f.base,config),target);assert.equal(restored.loadout.primary,'r2');assert.equal(restored.loadout.sidearm,'p2');assert.equal(restored.loadout.secondary,'');assert.equal(restored.pages[0].slots[11].ref,'p2');
});
test('saving a reusable NPC default stores both actor and prototype flags without changing wounds or token linking',async()=>{
  const f=fixture(),config=autoConfig(f.base);await saveNPCDefault(f.doc,config,f.runtime);
  assert.equal(f.base.getFlag(ID,'defaultGrid').grid.loadout.primary,'rifle');assert.deepEqual(f.base.prototypeToken.flags[ID].defaultGrid,f.base.flags[ID].defaultGrid);assert.deepEqual(Object.keys(f.base.lastUpdate).sort(),[`flags.${ID}.grid`,`flags.${ID}.defaultGrid`,`prototypeToken.flags.${ID}.defaultGrid`].sort());assert.equal(f.doc.actorLink,false);assert.equal(readConfig(f.base).loadout.primary,'rifle');
});
test('a new unlinked Extra inherits the base actor default even when Assign Token replaced prototype flags',async()=>{
  const f=fixture(),config=autoConfig(f.base);config.theme='sc2';config.loadout={primary:'pistol'};await saveNPCDefault(f.doc,config,f.runtime);f.base.prototypeToken.flags={};
  const actor={...f.base,isToken:true,uuid:'Scene.S.Token.New.Actor.A',getFlag:()=>undefined};const doc={actor,baseActor:f.base,actorLink:false,delta:{getFlag:()=>undefined},getFlag:()=>undefined};actor.token=doc;
  const result=readConfig(actor,'coh2',doc);assert.equal(result.theme,'sc2');assert.equal(result.loadout.primary,'pistol');
  const own=autoConfig(actor,'desert');doc.delta.getFlag=()=>own;assert.equal(readConfig(actor,'coh2',doc).theme,'desert');
});
test('NPC defaults preserve assigned items that only exist on the source Extra',async()=>{
  const f=fixture(),extraItem={id:'grenade',name:'Frag Grenade',type:'weapon',system:{swid:'frag'},toObject:()=>({_id:'grenade',name:'Frag Grenade',type:'weapon',system:{swid:'frag'}})};
  const actor={...f.base,items:new Map([...f.items,['grenade',extraItem]])};f.doc.actor=actor;let copied=0;
  f.base.createEmbeddedDocuments=async(type,data)=>{assert.equal(type,'Item');assert.equal(data[0]._id,undefined);copied++;f.base.items.set('g2',{...data[0],id:'g2'});};
  const config=autoConfig(actor);config.pages[0].slots[11]={kind:'item',ref:'grenade',action:'attack'};
  await saveNPCDefault(f.doc,config,f.runtime);assert.equal(copied,1);assert.equal(f.base.flags[ID].defaultGrid.grid.pages[0].slots[11].ref,'g2');
});
test('applying a default changes only the token actor layout and remains GM-only',async()=>{
  const f=fixture();await saveNPCDefault(f.doc,autoConfig(f.base),f.runtime);let saved;
  f.doc.actor={isOwner:true,items:f.items,setFlag:async(id,key,value)=>{assert.equal(id,ID);assert.equal(key,'grid');saved=value;}};
  await useNPCDefault(f.doc,f.runtime);assert.equal(saved.pages[0].name,'Base');f.runtime.game.user.isGM=false;await assert.rejects(useNPCDefault(f.doc,f.runtime),/Only a GM/);await assert.rejects(saveNPCDefault(f.doc,saved,f.runtime),/Only a GM/);
});
