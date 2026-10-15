import test from "node:test";
import assert from "node:assert/strict";
import {normalizeConfig,normalizeSlot,autoConfig,insertSlot,moveSlot,readConfig,canUse,imagePath,slotView,ID} from "../scripts/core.mjs";
const items=new Map([['a',{id:'a',name:'Rifle',type:'weapon',system:{damage:'2d6',range:'12/24/48',shots:30,currentShots:8}}],['b',{id:'b',name:'Bolt',type:'power'}],['c',{id:'c',name:'Shooting',type:'skill'}]]);
const actor={items,isOwner:true,getFlag:()=>undefined,system:{},statuses:new Set()};
test('automatic loadout includes weapons, powers, skills and commands without writing actor data',()=>{
  const c=autoConfig(actor,'sc2');assert.equal(c.theme,'sc2');assert.equal(c.pages[0].slots[0].ref,'a');assert.equal(c.pages[1].slots[0].ref,'b');assert.equal(c.pages[2].slots[0].ref,'c');assert.equal(c.pages[3].slots[0].ref,'sheet');assert.deepEqual(readConfig(actor,'sc2'),c);
});
test('large inventories paginate with each item exactly once',()=>{
  const a={items:new Map(Array.from({length:55},(_,i)=>[String(i),{id:String(i),type:'weapon'}]))};
  const c=autoConfig(a);const refs=c.pages.flatMap(p=>p.slots).filter(s=>s.kind==='item').map(s=>s.ref);
  assert.equal(refs.length,55);assert.equal(new Set(refs).size,55);assert.ok(c.pages.every(p=>p.slots.length<=15));
});
test('configuration import bounds sizes and rejects unsafe paths and commands',()=>{
  const c=normalizeConfig({theme:'bad',columns:999,rows:-1,size:900,accent:'red;position:fixed',portrait:'javascript:evil()',pages:[{name:'<script>',slots:[{kind:'command',ref:'evil'},{kind:'attribute',ref:'evil'},{kind:'item',ref:'a',icon:'data:image/svg+xml,evil'}]}]});
  assert.equal(c.columns,8);assert.equal(c.rows,2);assert.equal(c.size,96);assert.equal(c.theme,'coh2');assert.equal(c.accent,'');assert.equal(c.portrait,'');assert.equal(c.pages[0].slots[0],null);assert.equal(c.pages[0].slots[1],null);assert.equal(c.pages[0].slots[2].icon,'');
  assert.equal(imagePath('icons/foo.webp'),'icons/foo.webp');assert.equal(imagePath('https://example.test/icon.png'),'https://example.test/icon.png');assert.equal(imagePath('file:///C:/secret'),'');
});
test('slot moves swap across pages and preserve hidden slots after shrinking',()=>{
  let c=autoConfig(actor);c=insertSlot(c,0,14,{kind:'item',ref:'c'});const n=moveSlot(c,0,0,1,0);
  assert.equal(n.pages[0].slots[0].ref,'b');assert.equal(n.pages[1].slots[0].ref,'a');assert.equal(c.pages[0].slots[0].ref,'a');
  const shrunk=normalizeConfig({...n,columns:3,rows:2});assert.equal(shrunk.pages[0].slots[14].ref,'c');assert.throws(()=>insertSlot(shrunk,0,8,null));
});
test('permission filtering excludes nonowners and hidden/invisible tokens for players',()=>{
  const token={actor,document:{hidden:false},isVisible:true};assert.equal(canUse(token,{isGM:false}),true);
  assert.equal(canUse({...token,actor:{isOwner:false}},{isGM:true}),false);
  assert.equal(canUse({...token,document:{hidden:true}},{isGM:false}),false);
  assert.equal(canUse({...token,isVisible:false},{isGM:false}),false);
  assert.equal(canUse({...token,document:{hidden:true}},{isGM:true}),true);
});
test('view reflects live ammunition and safely disables deleted references',()=>{
  const slot={kind:'item',ref:'a',action:'attack'};const view=slotView(slot,actor,{},'coh2');assert.equal(view.badge,'8/30');assert.match(view.hint,/2d6/);assert.equal(view.disabled,false);
  assert.equal(slotView({...slot,ref:'gone'},actor,{},'coh2').disabled,true);
});
