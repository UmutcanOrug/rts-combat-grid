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
  const mime={'.mjs':'text/javascript','.html':'text/html','.json':'application/json','.css':'text/css','.webp':'image/webp'}[path.extname(filename)] ?? 'text/plain';
  await route.fulfill({contentType:mime,body:fs.readFileSync(filename)});
});
await page.goto('http://rts-preview.test');await page.waitForSelector('#rts-combat-grid');
async function check(name,fn){await fn();console.log('PASS '+name);}
const assert=(value,message)=>{if(!value)throw new Error(message);};
await check('CoH II renders complete inventory and assets',async()=>{
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('#rts-combat-grid img')).every(i=>i.complete && i.naturalWidth>0));
  assert(await page.locator('.rcg-slot').count()===15,'15 slots');assert(await page.locator('.rcg-slot-icon').count()===7,'7 assigned slot icons');
  await page.screenshot({path:path.join(out,'coh2-preview.png')});
  await page.locator('#rts-combat-grid').screenshot({path:path.join(out,'coh2-panel.png')});
});
await check('SWADE attack updates ammunition through system bridge',async()=>{
  await page.locator('[data-slot="0"]').click();await page.waitForFunction(()=>preview.items.get('rifle').system.currentShots===7);
  assert((await page.locator('[data-slot="0"] .rcg-ammo').textContent())==='7/10','ammo reflects actor');
  assert(await page.evaluate(()=>preview.calls.some(c=>c.name==='SWADE action' && c.args[1]==='formula')),'formula bridge');
});
await check('right click item menu offers damage and reload',async()=>{
  await page.locator('[data-slot="0"]').click({button:'right'});await page.locator('[data-item-action="damage"]').click();
  await page.waitForFunction(()=>preview.calls.some(c=>c.name==='SWADE action' && c.args[1]==='damage'));
});
await check('SC II theme renders extracted local game textures',async()=>{
  await page.locator('#sc2-theme').click();await page.waitForSelector('.theme-sc2');
  await page.locator('[data-page="3"]').click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('#rts-combat-grid img')).every(i=>i.complete && i.naturalWidth>0));
  await page.screenshot({path:path.join(out,'sc2-preview.png')});
  await page.locator('#rts-combat-grid').screenshot({path:path.join(out,'sc2-panel.png')});
});
await check('slot editor persists macro binding and original actor scope',async()=>{
  await page.locator('[data-page="0"]').click();await page.locator('[data-ui="edit"]').click();await page.locator('[data-slot="8"]').click();
  await page.locator('dialog select[name="kind"]').selectOption('macro');await page.locator('dialog select[name="ref"]').selectOption('M');
  await page.locator('dialog input[name="label"]').fill('Call Support');await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});
  assert(await page.evaluate(()=>preview.actor.flags['rts-combat-grid'].grid.pages[0].slots[8].ref)==='M','saved slot');
  await page.locator('[data-ui="edit"]').click();await page.locator('[data-slot="8"]').click();
  await page.waitForFunction(()=>preview.calls.some(c=>c.name==='Macro' && c.args[1]==='Scene.S.Token.T'));
});
await check('panel appearance editor persists rows, columns and labels',async()=>{
  await page.locator('[data-ui="settings"]').click();
  await page.locator('dialog textarea[name="pages"]').fill('   ');await page.locator('dialog button[value="save"]').click();
  assert(await page.locator('dialog[open]').count()===1,'invalid save leaves editor open');
  await page.locator('dialog textarea[name="pages"]').fill('Weapons\nPowers\nSkills\nCommands');
  await page.locator('dialog input[name="columns"]').fill('4');await page.locator('dialog select[name="labels"]').selectOption('yes');
  await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});assert(await page.locator('.rcg-slot').count()===12,'4 by 3 grid');
});
await check('imported layout is normalized and persisted',async()=>{
  await page.locator('[data-ui="settings"]').click();
  const imported=await page.evaluate(()=>({format:'rts-combat-grid',version:1,grid:{...preview.actor.flags['rts-combat-grid'].grid,theme:'coh2',columns:5}}));
  await page.locator('dialog [data-import]').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.waitForFunction(()=>document.querySelector('dialog .rcg-edit-intro')?.textContent.includes('ready'));
  await page.locator('dialog button[value="save"]').click();await page.waitForSelector('dialog',{state:'detached'});assert(await page.locator('.theme-coh2').count()===1,'import theme applied');
});
await check('dragged slots swap and survive closing and reopening',async()=>{
  await page.locator('[data-ui="edit"]').click();await page.evaluate(()=>{
    const data=new DataTransfer();data.setData('application/x-rcg-slot',JSON.stringify({actor:'Actor.A',page:0,index:0}));
    document.querySelector('[data-slot="1"]').dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));
  });await page.waitForFunction(()=>preview.actor.flags['rts-combat-grid'].grid.pages[0].slots[1].ref==='rifle');
});
await check('dragged actor item is stored in chosen slot',async()=>{
  await page.evaluate(async()=>{
    const data=new DataTransfer();data.setData('text/plain',JSON.stringify({type:'Item',uuid:'Actor.A.Item.rifle'}));
    document.querySelector('[data-slot="11"]').dispatchEvent(new DragEvent('drop',{dataTransfer:data,bubbles:true,cancelable:true}));
  });await page.waitForFunction(()=>preview.actor.flags['rts-combat-grid'].grid.pages[0].slots[11]?.ref==='rifle');
});
await check('Escape closes and right-click HUD reopens',async()=>{
  await page.keyboard.press('Escape');assert(await page.locator('#rts-combat-grid').count()===0,'closed');
  await page.locator('#unit').click({button:'right'});await page.waitForSelector('#rts-combat-grid');
});
await check('permission loss closes an open HUD',async()=>{
  await page.evaluate(()=>{preview.actor.isOwner=false;Hooks.callAll('updateActor',preview.actor);});assert(await page.locator('#rts-combat-grid').count()===0,'permission close');
  await page.evaluate(()=>{preview.actor.isOwner=true;preview.open();});
});
await check('small viewport keeps the full panel inside screen',async()=>{
  await page.setViewportSize({width:550,height:520});await page.evaluate(()=>preview.main.grid.clampPosition());
  const r=await page.locator('#rts-combat-grid').boundingBox();assert(r.x>=7 && r.y>=7 && r.x+r.width<=551 && r.y+r.height<=521,JSON.stringify(r));
});
assert(errors.length===0,errors.join('\n'));
await browser.close();console.log('PASS no browser errors');
