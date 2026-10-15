import test from "node:test";
import assert from "node:assert/strict";
import {executeSlot,itemActions} from "../scripts/actions.mjs";
function fixture() {
  const calls=[];
  const item={id:'w',isOwner:true,type:'weapon',system:{shots:30,actions:{additional:{burst:{name:'Burst'}}}},sheet:{render:value=>calls.push(['itemSheet',value])},show:()=>calls.push(['card'])};
  const actor={isOwner:true,items:new Map([['w',item]]),sheet:{render:value=>calls.push(['sheet',value])},rollSkill:id=>calls.push(['skill',id]),rollAttribute:ref=>calls.push(['attribute',ref]),rollRunningDie:()=>calls.push(['run']),spendBenny:()=>calls.push(['benny']),toggleStatusEffect:id=>calls.push(['status',id])};
  const token={actor,document:{hidden:false},toggleCombat:()=>calls.push(['combat'])};
  const runtime={game:{user:{isGM:false,updateTokenTargets:ids=>calls.push(['targets',ids])},macros:new Map(),swade:{itemChatCardHelper:{handleAction:(...args)=>calls.push(['native',...args])}}},CONFIG:{statusEffects:[{id:'shaken'}]},canvas:{},ui:{controls:{activate:options=>calls.push(['targetTool',options])}}};
  return {calls,item,actor,token,runtime};
}
test('weapon attack delegates to SWADE formula with the exact actor and item, without spending resources itself',async()=>{
  const f=fixture(),event={shiftKey:false};await executeSlot({kind:'item',ref:'w',action:'attack'},f.token,event,f.runtime);
  assert.deepEqual(f.calls,[['native',f.item,f.actor,'formula',{additionalMods:[],event}]]);
});
test('damage, reload and additional item actions keep the SWADE action hook bridge',async()=>{
  const f=fixture();for(const action of ['damage','reload','burst'])await executeSlot({kind:'item',ref:'w',action},f.token,null,f.runtime);
  assert.deepEqual(f.calls.map(call=>call[3]),['damage','reload','burst']);
  await assert.rejects(executeSlot({kind:'item',ref:'w',action:'missing'},f.token,null,f.runtime),/no longer/);
});
test('skill items call actor.rollSkill instead of weapon attack',async()=>{
  const f=fixture();f.item.type='skill';await executeSlot({kind:'item',ref:'w',action:'attack'},f.token,null,f.runtime);assert.deepEqual(f.calls,[['skill','w']]);
});
test('macro receives token and actor scope and rechecks execution permission',async()=>{
  const f=fixture();f.runtime.game.macros.set('m',{canExecute:true,execute:scope=>f.calls.push(['macro',scope])});await executeSlot({kind:'macro',ref:'m'},f.token,null,f.runtime);
  assert.deepEqual(f.calls[0][1],{actor:f.actor,token:f.token,tokenDocument:f.token.document});
  f.runtime.game.macros.get('m').canExecute=false;await assert.rejects(executeSlot({kind:'macro',ref:'m'},f.token,null,f.runtime),/permission/);
});
test('ownership, pause and missing-item guards prevent every action',async()=>{
  const f=fixture();f.actor.isOwner=false;await assert.rejects(executeSlot({kind:'item',ref:'w',action:'attack'},f.token,null,f.runtime),/permission/);
  f.actor.isOwner=true;f.runtime.game.paused=true;await assert.rejects(executeSlot({kind:'command',ref:'benny'},f.token,null,f.runtime),/paused/);
  f.runtime.game.paused=false;await assert.rejects(executeSlot({kind:'item',ref:'gone'},f.token,null,f.runtime),/missing/);assert.equal(f.calls.length,0);
});
test('native commands and conditions use the Foundry v13 and SWADE APIs',async()=>{
  const f=fixture();for(const ref of ['run','spirit','vigor','benny','combat','target','clearTargets'])await executeSlot({kind:'command',ref},f.token,null,f.runtime);
  await executeSlot({kind:'condition',ref:'shaken'},f.token,null,f.runtime);
  assert.deepEqual(f.calls,[['run'],['attribute','spirit'],['attribute','vigor'],['benny'],['combat'],['targetTool',{control:'tokens',tool:'target'}],['targets',[]],['status','shaken']]);
});
test('additional actions are available alongside the default item actions',()=>{const f=fixture();assert.deepEqual(itemActions(f.item).map(x=>x.ref),['attack','damage','reload','card','sheet','burst']);});
test('No Power Points rule passes the current power cost penalty to trait actions only',async()=>{
  const f=fixture();f.item.type='power';f.item.system.ppModifiers={cost:5};f.runtime.game.settings={get:()=>true};f.runtime.game.i18n={localize:()=>"Power"};
  await executeSlot({kind:'item',ref:'w',action:'attack'},f.token,null,f.runtime);
  assert.deepEqual(f.calls[0][4].additionalMods,[{label:'Power',value:-3}]);
  await executeSlot({kind:'item',ref:'w',action:'damage'},f.token,null,f.runtime);
  assert.deepEqual(f.calls[1][4].additionalMods,[]);
});
