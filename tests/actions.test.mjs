import test from "node:test";
import assert from "node:assert/strict";
import {executeSlot,executeMacro,adjustWounds,itemActions} from "../scripts/actions.mjs";
import {actionLibrary,chooseActions} from "../scripts/menus.mjs";
function fixture() {
 const calls=[];
 const item={id:'w',name:'Rifle',isOwner:true,type:'weapon',system:{shots:30,actions:{additional:{burst:{name:'Burst'}}}},sheet:{render:value=>calls.push(['itemSheet',value])},show:()=>calls.push(['card']),reload:()=>calls.push(['reload'])};
 const actor={isOwner:true,items:new Map([['w',item]]),system:{wounds:{value:0,max:0},bennies:{value:3}},sheet:{render:value=>calls.push(['sheet',value])},spendBenny:()=>calls.push(['benny']),getBenny:()=>calls.push(['giveBenny']),toggleStatusEffect:id=>calls.push(['status',id]),update:change=>{if('system.wounds.value' in change)actor.system.wounds.value=change['system.wounds.value'];if('system.bennies.value' in change)actor.system.bennies.value=change['system.bennies.value'];calls.push(['update',change]);}};
 const token={actor,document:{hidden:false},control:()=>calls.push(['control'])};
 const runtime={game:{user:{isGM:false},modules:new Map([['swade-tools',{active:true}]]),macros:new Map(),swadetools:{item:(...args)=>calls.push(['toolsItem',...args]),skill:(...args)=>calls.push(['skill',...args]),attribute:(...args)=>calls.push(['attribute',...args]),run:(...args)=>calls.push(['run',...args])},swade:{swadetoolsAttack:(...args)=>calls.push(['action',...args])}},CONFIG:{statusEffects:[{id:'shaken'},{id:'prone'}]},ui:{controls:{activate:options=>calls.push(['tool',options])}}};
 return {calls,item,actor,token,runtime};
}
test('weapon and power use the custom SWADE Tools panel with exact token context',async()=>{
 const f=fixture();await executeSlot({kind:'item',ref:'w',action:'attack'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['toolsItem',f.actor,'w',null,{token:f.token,restoreLast:false,damageOnly:false}]]);
 f.item.type='power';await executeSlot({kind:'item',ref:'w',action:'damage'},f.token,null,f.runtime);assert.equal(f.calls[1][4].damageOnly,true);
});
test('Action items use the Tools action dialog rather than a chat card',async()=>{
 const f=fixture();f.item.type='action';await executeSlot({kind:'item',ref:'w',action:'attack'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['action',f.actor,f.item,true]]);
});
test('skill, attribute and Run all use SWADE Tools',async()=>{
 const f=fixture();f.item.type='skill';await executeSlot({kind:'item',ref:'w',action:'attack'},f.token,null,f.runtime);await executeSlot({kind:'attribute',ref:'spirit'},f.token,null,f.runtime);await executeSlot({kind:'command',ref:'run'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['skill',f.actor,'w'],['attribute',f.actor,'spirit'],['run',f.actor]]);
});
test('reload and cards retain the native item operation; missing additional actions fail',async()=>{
 const f=fixture();await executeSlot({kind:'item',ref:'w',action:'reload'},f.token,null,f.runtime);await executeSlot({kind:'item',ref:'w',action:'card'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['reload'],['card']]);await assert.rejects(executeSlot({kind:'item',ref:'w',action:'missing'},f.token,null,f.runtime),/no longer/);
});
test('additional item action becomes the default in only the matching Tools dialog',async()=>{
 const f=fixture();let hook,removed=false;f.runtime.Hooks={on:(name,fn)=>(hook=fn,7),off:()=>removed=true};await executeSlot({kind:'item',ref:'w',action:'burst'},f.token,null,f.runtime);
 const wrong={data:{title:'Other',buttons:{burst:{}}}};hook(wrong);assert.equal(wrong.data.default,undefined);const dialog={data:{title:'Rifle',buttons:{burst:{}}}};hook(dialog);assert.equal(dialog.data.default,'burst');assert.equal(removed,true);
});
test('macro receives actor/token scope, and checks permission again at execution',async()=>{
 const f=fixture();f.runtime.game.macros.set('m',{canExecute:true,execute:scope=>f.calls.push(['macro',scope])});await executeMacro('m',f.token,{from:{x:1,y:2}},f.runtime);assert.equal(f.calls[0][1].token,f.token);assert.deepEqual(f.calls[0][1].from,{x:1,y:2});f.runtime.game.macros.get('m').canExecute=false;await assert.rejects(executeMacro('m',f.token,{},f.runtime),/permission/);
});
test('Movement selects the token and arms a later move without executing the voice',async()=>{
 const f=fixture();f.runtime.game.macros.set('m',{canExecute:true});const result=await executeSlot({kind:'command',ref:'movement',macro:'m'},f.token,null,f.runtime);assert.deepEqual(result,{movement:true,macro:'m'});assert.deepEqual(f.calls,[['control'],['tool',{control:'tokens',tool:'select'}]]);
});
test('wounds update real actor data, including Extra incapacitation and healing to zero',async()=>{
 const f=fixture();await adjustWounds(f.token,{delta:1},f.runtime);assert.equal(f.actor.system.wounds.value,1);await adjustWounds(f.token,{delta:-1},f.runtime);await adjustWounds(f.token,{delta:-1},f.runtime);assert.equal(f.actor.system.wounds.value,0);await adjustWounds(f.token,{value:3},f.runtime);assert.equal(f.actor.system.wounds.value,3);
});
test('ownership, paused game and inactive Tools prevent actions',async()=>{
 const f=fixture();f.actor.isOwner=false;await assert.rejects(adjustWounds(f.token,{delta:1},f.runtime),/permission/);f.actor.isOwner=true;f.runtime.game.paused=true;await assert.rejects(executeSlot({kind:'command',ref:'benny'},f.token,null,f.runtime),/paused/);f.runtime.game.paused=false;f.runtime.game.modules.get('swade-tools').active=false;await assert.rejects(executeSlot({kind:'item',ref:'w'},f.token,null,f.runtime),/Enable SWADE Tools/);assert.equal(f.calls.length,0);
});
test('player can spend a Benny and toggle Prone; granting one is GM only',async()=>{
 const f=fixture();await executeSlot({kind:'command',ref:'benny'},f.token,null,f.runtime);await executeSlot({kind:'command',ref:'prone'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['benny'],['status','prone']]);await assert.rejects(executeSlot({kind:'command',ref:'giveBenny'},f.token,null,f.runtime),/Only the GM/);
});
test('action discovery uses item type, includes non-English pack labels, and excludes hidden packs',async()=>{
 const f=fixture();f.runtime.game.items=[{name:'World Action',type:'action',visible:true},{name:'Hidden',type:'action',visible:false}];f.runtime.game.packs=[{documentName:'Item',visible:true,metadata:{label:'Core Library'},getIndex:async()=>[{_id:'a',name:'Grapple',type:'action'},{_id:'w',name:'Rifle',type:'weapon'}]},{documentName:'Item',visible:false,getIndex:()=>{throw new Error('must not read');}}];const entries=await actionLibrary(f.runtime);assert.equal(entries.length,2);assert.equal(entries[1].id,'a');
});
test('Action item context menu includes use and additional actions',()=>{const f=fixture();f.item.type='action';assert.deepEqual(itemActions(f.item).map(x=>x.ref),['attack','card','sheet','burst']);});
test('action library copies an Action only after explicit Use, then opens Tools',async()=>{
 const f=fixture();const source={type:'action',toObject:()=>({_id:'source',name:'Disarm',type:'action'})};
 f.runtime.game.items=[];f.runtime.game.packs=[];let dialogs=0;
 f.runtime.foundry={applications:{api:{DialogV2:{wait:async()=>({entry:++dialogs === 1 ? {library:true} : {document:source}})}}}};
 f.actor.createEmbeddedDocuments=async(type,data)=>{assert.equal(type,'Item');assert.equal(data[0]._id,undefined);assert.equal(data[0].name,'Disarm');f.calls.push(['created']);f.item.type='action';return [f.item];};
 await chooseActions(f.token,f.runtime);assert.equal(f.calls[0][0],'created');assert.equal(f.calls[1][0],'action');
});
test('cancelled action library browse does not import content',async()=>{
 const f=fixture();f.runtime.game.items=[];f.runtime.game.packs=[];let dialogs=0;
 f.runtime.foundry={applications:{api:{DialogV2:{wait:async()=>++dialogs === 1 ? {entry:{library:true}} : null}}}};
 f.actor.createEmbeddedDocuments=()=>{throw new Error('unexpected import');};await chooseActions(f.token,f.runtime);assert.equal(f.calls.length,0);
});

test('owner Benny adjustments use native award and direct removal without the spend hook',async()=>{
 const f=fixture();await executeSlot({kind:'command',ref:'addBenny'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['giveBenny']]);await executeSlot({kind:'command',ref:'removeBenny'},f.token,null,f.runtime);assert.equal(f.actor.system.bennies.value,2);assert.deepEqual(f.calls[1],['update',{'system.bennies.value':2}]);assert.ok(!f.calls.some(call=>call[0]==='benny'));
 f.actor.system.bennies.value=0;const count=f.calls.length;await executeSlot({kind:'command',ref:'removeBenny'},f.token,null,f.runtime);assert.equal(f.calls.length,count);assert.equal(f.actor.system.bennies.value,0);
 f.actor.isOwner=false;await assert.rejects(executeSlot({kind:'command',ref:'addBenny'},f.token,null,f.runtime),/permission/);
});
