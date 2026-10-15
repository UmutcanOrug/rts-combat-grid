import {ID,ASSETS,autoConfig} from '../scripts/core.mjs';
const callbacks=new Map();
globalThis.Hooks={on(name,callback){if(!callbacks.has(name))callbacks.set(name,[]);callbacks.get(name).push(callback);return callback;},once(name,callback){this.on(name,callback);},off(name,callback){callbacks.set(name,(callbacks.get(name) ?? []).filter(c=>c!==callback));},callAll(name,...args){for(const callback of callbacks.get(name) ?? [])callback(...args);}};
const settings=new Map();const api={};const output=document.getElementById('output');
const calls=[];const record=(name,...args)=>{calls.push({name,args});output.textContent=`${name}\n${args.map(a=>a?.name ?? String(a)).join(' · ')}`;};
globalThis.game={system:{id:'swade'},user:{id:'gm',isGM:true,updateTokenTargets:targets=>record('Targets cleared',targets)},modules:new Map([[ID,api],['swade-tools',{active:true}]]),macros:new Map(),i18n:{localize:key=>key},keybindings:{register(){}},settings:{register(id,key,options){settings.set(key,options.default);},get(id,key){return settings.get(key);},async set(id,key,value){settings.set(key,value);}}};
globalThis.ui={notifications:{info:message=>record('Info',message),error:message=>record('Error',message)},controls:{activate:options=>record('Target tool',options.tool)}};
globalThis.CONFIG={statusEffects:[{id:'shaken',name:'Shaken'},{id:'prone',name:'Prone'}]};
globalThis.foundry={applications:{apps:{FilePicker:{implementation:class {constructor(options){this.options=options;}render(){this.options.callback(`${ASSETS}/sc2/marine.webp`);}}}},api:{DialogV2:{async wait(options){
  return new Promise(resolve=>{
    const element=document.createElement('dialog');element.className=(options.classes ?? []).join(' ');
    element.innerHTML=`<header>${options.window.title}<button type="button" data-close>×</button></header><div class="window-content"><form>${options.content}<footer>${options.buttons.map(button=>`<button type="submit" value="${button.action}">${button.label}</button>`).join('')}</footer></form></div>`;
    const app={element};document.body.append(element);element.showModal();options.render?.(null,app);
    const close=value=>{element.close();element.remove();resolve(value);};
    element.querySelector('[data-close]').addEventListener('click',()=>close(null));element.addEventListener('cancel',()=>close(null));
    element.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const button=options.buttons.find(b=>b.action===event.submitter?.value) ?? options.buttons.find(b=>b.default);try{close(button.callback ? await button.callback(event,event.submitter,app) : button.action);}catch(error){ui.notifications.error(error.message);}});
  });
}}}}};
function makeItem(id,name,type,img,system={}){return {id,name,type,img,uuid:`Actor.A.Item.${id}`,isOwner:true,system,sheet:{render:()=>record('Item sheet',name)},show:()=>record('Item card',name),reload:()=>record('Reload',id)};}
const items=new Map([
 ['rifle',makeItem('rifle','Infantry Rifle','weapon',`${ASSETS}/coh2/gun.webp`,{damage:'2d8',range:'24/48/96',shots:10,currentShots:8,rof:1,actions:{additional:{burst:{name:'Burst fire'}}}})],
 ['smg',makeItem('smg','Service Pistol','weapon',`${ASSETS}/coh2/smg.webp`,{damage:'2d6',range:'12/24/48',shots:30,currentShots:24,rof:3})],
 ['mortar',makeItem('mortar','Mortar','weapon',`${ASSETS}/coh2/mortar.webp`,{damage:'3d6',range:'50/100/200',shots:1,currentShots:1,rof:1})],
 ['mg',makeItem('mg','Heavy Machine Gun','weapon',`${ASSETS}/coh2/machine-gun.webp`,{damage:'2d8',range:'30/60/120',shots:100,currentShots:72,rof:3})],
 ['act',makeItem('act','Grapple','action',`${ASSETS}/commands/actions.svg`,{actions:{additional:{}}})],
 ['grenade',makeItem('grenade','Frag Grenade','weapon',`${ASSETS}/coh2/artillery.webp`,{quantity:3})],
 ['medkit',makeItem('medkit','Medical Kit','consumable',`${ASSETS}/coh2/medic.webp`,{quantity:2})],
 ['shot',makeItem('shot','Shooting','skill',`${ASSETS}/coh2/rifleman.webp`,{die:{sides:8}})],
 ['bolt',makeItem('bolt','Energy Bolt','power',`${ASSETS}/sc2/attack.webp`,{pp:1,range:'12/24/48'})]
]);
const actor={uuid:'Actor.A',name:'4th Infantry Company',img:`${ASSETS}/coh2/rifleman.webp`,items,isOwner:true,documentName:'Actor',statuses:new Set(),effects:[{name:'Armor boost',disabled:false,isOwner:true,async update(change){Object.assign(this,change);record('Effect updated',change.disabled);}}],system:{wildcard:true,wounds:{value:1,max:3},fatigue:{value:0,max:2},bennies:{value:3},powerPoints:{general:{value:10,max:15}},stats:{parry:{value:6},toughness:{value:7}},attributes:{agility:{die:{sides:8}},smarts:{die:{sides:6}},spirit:{die:{sides:8}},strength:{die:{sides:6}},vigor:{die:{sides:6}}}},flags:{},async update(change){if(change['system.wounds.value'] !== undefined)this.system.wounds.value=change['system.wounds.value'];Hooks.callAll('updateActor',this);record('Wounds updated',this.system.wounds.value);},getFlag(id,key){return this.flags[id]?.[key];},async setFlag(id,key,value){this.flags[id] ??= {};this.flags[id][key]=structuredClone(value);Hooks.callAll('updateActor',this);},sheet:{render:()=>record('Character sheet')},rollSkill:id=>record('Skill roll',id),rollAttribute:ref=>record('Attribute roll',ref),rollRunningDie:()=>record('Running roll'),spendBenny:()=>{actor.system.bennies.value--;Hooks.callAll('updateActor',actor);record('Benny spent');},toggleStatusEffect:id=>{actor.statuses.has(id)?actor.statuses.delete(id):actor.statuses.add(id);Hooks.callAll('updateActor',actor);record('Condition',id);}};
for(const item of items.values())item.parent=actor;
const token={actor,isVisible:true,document:{uuid:'Scene.S.Token.T',id:'T',name:actor.name,hidden:false,texture:{src:actor.img},x:100,y:100},control:()=>record('Token selected'),toggleCombat:()=>record('Toggle combat')};
globalThis.canvas={tokens:{controlled:[token]}};
globalThis.fromUuid=async uuid=>uuid.startsWith('Macro.') ? game.macros.get(uuid.slice(6)) : items.get(uuid.split('.').pop());
game.macros.set('M',{id:'M',name:'Fire Support',img:`${ASSETS}/coh2/artillery.webp`,canExecute:true,execute:scope=>record('Macro',scope.actor,scope.token.document.uuid)});
game.swadetools={
 async item(actor,id,operator,options){record('Tools item',id,options.token.document.uuid,options.damageOnly);},
 skill:(actor,id)=>record('Tools skill',id),attribute:(actor,id)=>record('Tools attribute',id),run:actor=>record('Tools run')
};
game.swade={swadetoolsAttack:(actor,item,dialog)=>record('Tools action',item.id,dialog)};
const main=await import('../scripts/main.mjs');Hooks.callAll('init');Hooks.callAll('ready');
const config=autoConfig(actor);
actor.flags[ID]={grid:config};
function hud(){Hooks.callAll('renderTokenHUD',{object:token},document.getElementById('token-hud'));}
function open(){main.grid.open(token,{force:true});}
document.getElementById('unit').addEventListener('contextmenu',event=>{event.preventDefault();hud();});document.getElementById('open-panel').addEventListener('click',open);
for(const [id,theme] of [['coh-theme','coh2'],['sc2-theme','sc2']])document.getElementById(id).addEventListener('click',async()=>{
 const current=main.grid.config ?? autoConfig(actor);current.theme=theme;current.portrait=theme==='sc2'?`${ASSETS}/sc2/marine.webp`:'';await actor.setFlag(ID,'grid',current);open();
});
globalThis.preview={main,actor,token,items,settings,calls,open,hud,callbacks};hud();
