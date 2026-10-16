import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'previews');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.route('http://rts-preview.test/**',async route=>{
  let rel=new URL(route.request().url()).pathname.slice(1) || 'tests/preview.html';
  if(rel.startsWith('modules/rts-combat-grid/'))rel=rel.slice('modules/rts-combat-grid/'.length);
  const filename=path.resolve(root,rel);
  if(!filename.startsWith(root+path.sep) || !fs.existsSync(filename)){await route.fulfill({status:404});return;}
  const mime={'.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'}[path.extname(filename)] ?? 'text/plain';
  await route.fulfill({contentType:mime,body:fs.readFileSync(filename)});
});
await page.goto('http://rts-preview.test');
async function check(name,fn){await fn();console.log('PASS '+name);}
const assert=(value,message)=>{if(!value)throw new Error(message);};
async function choose(label){if(label)await page.getByRole('option',{name:label,exact:true}).click();await page.locator('dialog button[value="use"]').click();await page.waitForSelector('dialog',{state:'detached'});}
async function loaded(){await page.waitForFunction(()=>Array.from(document.querySelectorAll('#rts-combat-grid img')).every(i=>i.complete && i.naturalWidth>0));}
await check('right-click only reveals the launcher; icon opens compact Base',async()=>{
 await page.locator('#unit').click({button:'right'});assert(await page.locator('#rts-combat-grid').count()===0,'right click must not open panel');await page.locator('.rcg-launcher').click();await page.waitForSelector('#rts-combat-grid');await loaded();
 assert(await page.locator('.rcg-slot').count()===15,'15 slots');assert(await page.locator('#token-hud .col.left > :first-child').getAttribute('aria-label')==='RTS Combat Grid','launcher top left');assert(await page.locator('#token-hud .col.right .rcg-launcher').count()===0,'no right launcher');assert(await page.locator('[data-page]').count()===1,'single Base');assert(await page.locator('.rcg-header [data-page="0"]').textContent()==='Base','Base in header');assert(await page.locator('.rcg-footer,.rcg-command-strip,.rcg-header-title,[data-command="target"],[data-command="sheet"]').count()===0,'no redundant text or controls');
 assert(await page.locator('[data-slot="0"]').getAttribute('aria-label')==='1st Weapon','primary');assert(await page.locator('[data-slot="5"]').getAttribute('aria-label')==='2nd Weapon','secondary');assert(await page.locator('[data-slot="10"]').getAttribute('aria-label')==='3rd Weapon','sidearm');assert(await page.locator('.rcg-slot.empty').count()===4,'4 custom slots');
 const box=await page.locator('#rts-combat-grid').boundingBox();assert(box.height<325 && box.width<520,'compact dimensions '+JSON.stringify(box));assert(box.x<150,'default panel left');
});
await check('all player roll buttons delegate to SWADE Tools',async()=>{
 await page.evaluate(()=>game.user.isGM=false);
 await page.locator('[data-slot="0"]').click();await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools item' && c.args[0]==='rifle' && c.args[1]==='Scene.S.Token.T'));
 await page.locator('[data-slot="6"]').click();await page.locator('dialog').screenshot({path:path.join(out,'skill-roll.png')});await choose('Shooting · d12 +2');await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools skill'));
 await page.locator('[data-slot="7"]').click();await choose('Vigor · d6');await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools attribute' && c.args[0]==='vigor'));
 await page.locator('[data-slot="2"]').click();await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools run'));
 await page.locator('[data-slot="9"]').click();await choose('Energy Bolt');await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools item' && c.args[0]==='bolt'));
});
await check('searchable choice list scrolls and selects every entry despite host select height',async()=>{
 await page.evaluate(()=>{for(let i=0;i<30;i++)preview.items.set('skill-'+i,{id:'skill-'+i,name:'Extra Skill '+i,type:'skill',isOwner:true,system:{die:{sides:6}}});});
 await page.locator('[data-slot="6"]').click();const list=page.locator('.rcg-entry-list');assert(await list.evaluate(el=>el.scrollHeight>el.clientHeight),'long list scrolls');assert(await page.locator('dialog select[size]').count()===0,'no compressed select list');await page.locator('dialog [data-search]').fill('Extra Skill 29');await choose('Extra Skill 29 · d6');await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools skill' && c.args[0]==='skill-29'));
 await page.evaluate(()=>{for(let i=0;i<30;i++)preview.items.delete('skill-'+i);});
});
await check('Shaken toggles from the lower resource row without using an item slot',async()=>{
 assert(await page.locator('[data-command="shaken"]').count()===1,'dedicated Shaken');assert(await page.locator('.rcg-resources [data-command="shaken"]').count()===1,'Shaken below wounds');assert(await page.locator('.rcg-portrait-wrap [data-command="shaken"]').count()===0,'portrait unobstructed');await page.locator('[data-command="shaken"]').click();assert(await page.evaluate(()=>preview.actor.statuses.has('shaken')),'Shaken enabled');await page.locator('[data-command="shaken"]').click();assert(!await page.evaluate(()=>preview.actor.statuses.has('shaken')),'Shaken cleared');assert(await page.locator('.rcg-slot.empty').count()===4,'custom slots kept');
});
await check('All weapons assigns three persistent Base weapon slots',async()=>{
 await page.locator('[data-command="weapons"]').click();await page.locator('dialog select[name="primary"]').selectOption('mg');await page.locator('dialog select[name="secondary"]').selectOption('rifle');await page.locator('dialog select[name="sidearm"]').selectOption('smg');await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});assert(await page.evaluate(()=>preview.actor.flags['rts-combat-grid'].grid.loadout.primary)==='mg','saved weapon');await page.locator('[data-slot="0"]').click();await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools item' && c.args[0]==='mg'));
 await page.locator('[data-command="weapons"]').click();await page.locator('dialog select[name="primary"]').selectOption('rifle');await page.locator('dialog select[name="secondary"]').selectOption('mortar');await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});
});
await check('SWADE Action items are visible and use the Tools action dialog',async()=>{
 await page.locator('[data-command="actions"]').click();await choose('Grapple');await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools action' && c.args[0]==='act'));
});
await check('Prone, Status, Effects, items and Bennies work for an owner player',async()=>{
 await page.locator('[data-slot="3"]').click();assert(await page.evaluate(()=>preview.actor.statuses.has('prone')),'Prone toggled');await page.locator('[data-slot="3"]').click();
 await page.locator('[data-slot="8"]').click();await choose('Shaken');assert(await page.evaluate(()=>preview.actor.statuses.has('shaken')),'Status toggled');
 await page.locator('[data-command="effects"]').click();await choose('On · Armor boost');assert(await page.evaluate(()=>preview.actor.effects[0].disabled),'effect toggled');
 await page.locator('[data-slot="4"]').click();await choose('Medical Kit · 2 remaining');await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Item card' && c.args[0]==='Medical Kit'));
 await page.locator('[data-command="benny"]').click();assert(await page.evaluate(()=>preview.actor.system.bennies.value)===2,'Benny spent');
});
await check('header Benny controls let an owner add, remove and spend separately',async()=>{
 assert(await page.locator('.rcg-header [data-command="addBenny"]').count()===1,'Add in header');assert(await page.locator('.rcg-header [data-command="removeBenny"]').count()===1,'Remove in header');
 const before=await page.evaluate(()=>preview.actor.system.bennies.value);const spent=await page.evaluate(()=>preview.calls.filter(c=>c.name==='Benny spent').length);
 await page.locator('[data-command="addBenny"]').click();await page.waitForFunction(before=>preview.actor.system.bennies.value===before+1,before);await page.locator('[data-command="removeBenny"]').click();await page.waitForFunction(before=>preview.actor.system.bennies.value===before,before);assert(await page.evaluate(()=>preview.calls.filter(c=>c.name==='Benny spent').length)===spent,'remove did not spend');assert(await page.locator('.rcg-benny-count b').textContent()===String(before),'counter refreshed');
 await page.evaluate(()=>{preview.actor.system.bennies.value=0;Hooks.callAll('updateActor',preview.actor);});assert(await page.locator('[data-command="removeBenny"]').isDisabled(),'zero remove disabled');assert(await page.locator('[data-command="benny"]').isDisabled(),'zero spend disabled');await page.locator('[data-command="addBenny"]').click();await page.waitForFunction(()=>preview.actor.system.bennies.value===1);await page.evaluate(before=>{preview.actor.system.bennies.value=before;Hooks.callAll('updateActor',preview.actor);},before);
});
await check('real wound values update through segments and +/-; Extras have no fake bars',async()=>{
 assert(await page.locator('.rcg-wound-segment').count()===3,'wild card 3 bars');await page.locator('[data-wound-value="3"]').click();await page.waitForFunction(()=>preview.actor.system.wounds.value===3);
 await page.locator('[data-wound-delta="-1"]').click();await page.waitForFunction(()=>preview.actor.system.wounds.value===2);await page.locator('[data-wound-delta="1"]').click();await page.waitForFunction(()=>preview.actor.system.wounds.value===3);
 await page.evaluate(()=>{preview.actor.system.wildcard=false;preview.actor.system.wounds={value:0,max:0};Hooks.callAll('updateActor',preview.actor);});assert(await page.locator('.rcg-wound-segment').count()===0,'Extra no fake bars');await page.locator('[data-wound-delta="1"]').click();await page.waitForFunction(()=>preview.actor.system.wounds.value===1);assert(await page.locator('.rcg-extra-health').textContent()==='DOWN','Extra wound exceeds capacity');await page.locator('[data-wound-delta="-1"]').click();await page.waitForFunction(()=>preview.actor.system.wounds.value===0);
 await page.evaluate(()=>{preview.actor.system.wildcard=true;preview.actor.system.wounds={value:1,max:5};Hooks.callAll('updateActor',preview.actor);});assert(await page.locator('.rcg-wound-segment').count()===5,'modified capacity respected');await page.evaluate(()=>{preview.actor.system.wounds.max=3;Hooks.callAll('updateActor',preview.actor);});
});
await check('damage context action opens Tools in damage-only mode',async()=>{
 await page.locator('[data-slot="0"]').click({button:'right'});await page.locator('[data-item-action="damage"]').click();await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Tools item' && c.args[2]===true));
});
await check('player can drag grenades and consumables into bottom custom slots',async()=>{
 for(const [index,id] of [[11,'grenade'],[12,'medkit']]){
 await page.evaluate(({index,id})=>{const data=new DataTransfer();data.setData('text/plain',JSON.stringify({type:'Item',uuid:`Actor.A.Item.${id}`}));document.querySelector(`[data-slot="${index}"]`).dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));},{index,id});await page.waitForFunction(({index,id})=>preview.actor.flags['rts-combat-grid'].grid.pages[0].slots[index]?.ref===id,{index,id});
 }
});
await check('all five themes render and retain the same compact controls',async()=>{
 for(const theme of ['coh2','sc2','ironclad','arcane','desert']){
 await page.evaluate(async theme=>{const c=preview.main.grid.config;c.theme=theme;c.portrait=theme==='sc2'?'modules/rts-combat-grid/assets/sc2/marine.webp':'';await preview.actor.setFlag('rts-combat-grid','grid',c);},theme);await loaded();await page.locator('#rts-combat-grid').screenshot({path:path.join(out,`${theme}-panel.png`)});
 assert(await page.locator(`.theme-${theme} .rcg-slot`).count()===15,theme);const icon=await page.locator('[data-slot="1"] .rcg-slot-icon').getAttribute('src');assert(icon.includes('/sc2/move.webp'),'SC II command icon '+theme);if(theme==='sc2')assert((await page.locator('[data-slot="1"] .rcg-slot-frame').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('sc2/button-frame.webp'),'SC II game frame restored');
 }
});
await check('Movement voice macro triggers once on this user next moving this token',async()=>{
 await page.locator('[data-ui="edit"]').click();await page.locator('[data-slot="1"]').click();await page.locator('dialog [data-movement-field]').waitFor({state:'attached'});assert(await page.locator('dialog [data-movement-field]').isVisible(),'movement binding visible');await page.locator('dialog select[name="macro"]').selectOption('M');await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});await page.locator('[data-ui="edit"]').click();
 await page.locator('[data-slot="1"]').click();assert(await page.evaluate(()=>preview.calls.filter(c=>c.name==='Macro').length)===0,'no voice on click');
 await page.evaluate(()=>{preview.token.document.x=150;Hooks.callAll('updateToken',preview.token.document,{x:150},{},'other-user');});assert(await page.evaluate(()=>preview.calls.filter(c=>c.name==='Macro').length)===0,'ignore another user');
 await page.evaluate(()=>{preview.token.document.x=200;Hooks.callAll('updateToken',preview.token.document,{x:200},{},game.user.id);});await page.waitForFunction(()=>preview.calls.filter(c=>c.name==='Macro').length===1);
 await page.evaluate(()=>{preview.token.document.x=250;Hooks.callAll('updateToken',preview.token.document,{x:250},{},game.user.id);});assert(await page.evaluate(()=>preview.calls.filter(c=>c.name==='Macro').length)===1,'one shot');
});
await check('GM can save the current NPC layout from Token Configuration',async()=>{
 await page.evaluate(()=>{game.user.isGM=true;const root=document.createElement('section');root.id='test-token-config';root.innerHTML='<div class="window-content"><div class="tab" data-tab="identity"></div></div>';document.body.append(root);Hooks.callAll('renderTokenConfig',{document:preview.token.document,isPrototype:false},root);});await page.locator('#test-token-config [data-save-default]').click();await page.waitForFunction(()=>Boolean(preview.actor.flags['rts-combat-grid'].defaultGrid));assert(await page.evaluate(()=>preview.actor.prototypeToken.flags['rts-combat-grid'].defaultGrid.grid.loadout.primary)==='rifle','prototype carries default');await page.evaluate(()=>document.getElementById('test-token-config').remove());
});
await check('appearance editor, import and slot dragging persist',async()=>{
 await page.locator('[data-ui="settings"]').click();await page.locator('dialog textarea[name="pages"]').fill('   ');await page.locator('dialog button[value="save"]').click();assert(await page.locator('dialog[open]').count()===1,'invalid save keeps editor');await page.locator('dialog textarea[name="pages"]').fill('Base');await page.locator('dialog input[name="columns"]').fill('4');await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});assert(await page.locator('.rcg-slot').count()===12,'shrink');
 await page.locator('[data-ui="settings"]').click();const imported=await page.evaluate(()=>({format:'rts-combat-grid',version:1,grid:{...preview.actor.flags['rts-combat-grid'].grid,theme:'coh2',columns:5}}));await page.locator('dialog [data-import]').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await page.waitForFunction(()=>document.querySelector('dialog .rcg-edit-intro')?.textContent.includes('ready'));await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});assert(await page.locator('.rcg-slot').count()===15,'restore');
 await page.locator('[data-ui="edit"]').click();await page.evaluate(()=>{const data=new DataTransfer();data.setData('application/x-rcg-slot',JSON.stringify({actor:'Actor.A',page:0,index:0}));document.querySelector('[data-slot="5"]').dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>preview.actor.flags['rts-combat-grid'].grid.pages[0].slots[5].ref==='primary');
});
await check('Escape closes; right-click stays closed; launcher restores; ownership loss closes',async()=>{
 await page.keyboard.press('Escape');assert(await page.locator('#rts-combat-grid').count()===0,'Escape');await page.locator('#unit').click({button:'right'});assert(await page.locator('#rts-combat-grid').count()===0,'still closed');await page.locator('.rcg-launcher').click();await page.waitForSelector('#rts-combat-grid');await page.evaluate(()=>{preview.actor.isOwner=false;Hooks.callAll('updateActor',preview.actor);});assert(await page.locator('#rts-combat-grid').count()===0,'permission close');await page.evaluate(()=>{preview.actor.isOwner=true;preview.open();});
});
await check('small viewport contains the full panel',async()=>{
 await page.setViewportSize({width:550,height:520});await page.evaluate(()=>preview.main.grid.clampPosition());const r=await page.locator('#rts-combat-grid').boundingBox();assert(r.x>=7 && r.y>=7 && r.x+r.width<=551 && r.y+r.height<=521,JSON.stringify(r));
});
assert(errors.length===0,errors.join('\n'));await browser.close();console.log('PASS no browser errors');
