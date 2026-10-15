import test from "node:test";
import assert from "node:assert/strict";
import {normalizeConfig,autoConfig,insertSlot,moveSlot,readConfig,migrateConfig,canUse,imagePath,slotView,loadoutItem,woundView} from "../scripts/core.mjs";
const items=new Map([['a',{id:'a',name:'Rifle',type:'weapon',system:{equipped:true,damage:'2d6',range:'12/24/48',shots:30,currentShots:8}}],['b',{id:'b',name:'SMG',type:'weapon'}],['p',{id:'p',name:'Pistol',type:'weapon'}],['c',{id:'c',name:'Shooting',type:'skill'}]]);
const actor={items,isOwner:true,getFlag:()=>undefined,system:{},statuses:new Set()};
test('Base has three weapons down the left, eight commands and four custom slots',()=>{
 const c=autoConfig(actor,'sc2');assert.equal(c.theme,'sc2');assert.equal(c.pages.length,1);assert.equal(c.pages[0].name,'Base');
 assert.deepEqual([0,5,10].map(i=>c.pages[0].slots[i].ref),['primary','secondary','sidearm']);
 assert.deepEqual(c.pages[0].slots.filter(s=>s?.kind==='command').map(s=>s.ref),['prone','movement','skills','attributes','run','items','status','powers']);
 assert.deepEqual(c.pages[0].slots.slice(11),[null,null,null,null]);assert.deepEqual(readConfig(actor,'sc2'),c);
 assert.equal(loadoutItem(actor,'primary').id,'a');assert.equal(loadoutItem(actor,'secondary').id,'b');assert.equal(loadoutItem(actor,'sidearm').id,'p');
});
test('old default tabs migrate to Base; custom bindings and appearance survive',()=>{
 const old={version:1,theme:'sc2',portrait:'portrait.webp',pages:[{name:'Weapons',slots:[{kind:'item',ref:'a',action:'attack'},{kind:'macro',ref:'m',label:'Voice'}]},{name:'Commands',slots:[{kind:'command',ref:'combat'}]},{name:'Utility',slots:[{kind:'attribute',ref:'spirit'}]}]};
 const c=migrateConfig(old,actor);assert.equal(c.pages[0].name,'Base');assert.equal(c.theme,'sc2');assert.equal(c.portrait,'portrait.webp');assert.equal(c.pages[1].name,'Utility');assert.equal(c.pages[2].slots[0].ref,'m');assert.ok(!c.pages.flatMap(p=>p.slots).some(s=>s?.ref==='combat'));
});
test('configuration bounds sizes and rejects unsafe paths and commands',()=>{
 const c=normalizeConfig({theme:'bad',columns:999,rows:-1,size:900,accent:'red;position:fixed',portrait:'javascript:evil()',pages:[{name:'<script>',slots:[{kind:'command',ref:'evil'},{kind:'attribute',ref:'evil'},{kind:'item',ref:'a',icon:'data:image/svg+xml,evil'}]}]});
 assert.equal(c.columns,8);assert.equal(c.rows,2);assert.equal(c.size,96);assert.equal(c.accent,'');assert.equal(c.portrait,'');assert.equal(c.pages[0].slots[0],null);assert.equal(c.pages[0].slots[1],null);assert.equal(c.pages[0].slots[2].icon,'');assert.equal(imagePath('file:///C:/secret'),'');
});
test('slot moves preserve hidden slots after shrinking',()=>{
 let c=autoConfig(actor);c=insertSlot(c,0,14,{kind:'item',ref:'c'});const n=moveSlot(c,0,0,0,5);
 assert.equal(n.pages[0].slots[0].ref,'secondary');assert.equal(n.pages[0].slots[5].ref,'primary');assert.equal(c.pages[0].slots[0].ref,'primary');
 const shrunk=normalizeConfig({...n,columns:3,rows:2});assert.equal(shrunk.pages[0].slots[14].ref,'c');assert.throws(()=>insertSlot(shrunk,0,8,null));
});
test('permissions exclude nonowners and hidden tokens for players',()=>{
 const token={actor,document:{hidden:false},isVisible:true};assert.equal(canUse(token,{isGM:false}),true);assert.equal(canUse({...token,actor:{isOwner:false}},{isGM:true}),false);assert.equal(canUse({...token,document:{hidden:true}},{isGM:false}),false);assert.equal(canUse({...token,document:{hidden:true}},{isGM:true}),true);
});
test('live ammo and missing loadout references render safely',()=>{
 const view=slotView({kind:'loadout',ref:'primary',action:'attack'},actor,{},'coh2');assert.equal(view.badge,'8/30');assert.equal(view.label,'1st Weapon');assert.match(view.hint,/Rifle/);assert.equal(slotView({kind:'loadout',ref:'primary'},{...actor,items:[]},{},'coh2').disabled,true);
});
test('wound capacity zero stays zero and modified capacities remain accurate',()=>{
 assert.deepEqual(woundView({system:{wounds:{value:0,max:0}}}),{value:0,max:0,incapacitated:false});assert.deepEqual(woundView({system:{wounds:{value:1,max:0}}}),{value:1,max:0,incapacitated:true});assert.equal(woundView({system:{wounds:{value:3,max:5}}}).max,5);
});
