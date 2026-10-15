import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {autoConfig,COMMANDS,ATTRIBUTES,THEMES} from '../scripts/core.mjs';

test('default pages, themes and built-in commands are English',()=>{
  const config=autoConfig({items:[]});
  assert.deepEqual(config.pages.map(page=>page.name),['Base']);
  assert.equal(THEMES.coh2,'CoH II · Frontline');
  assert.equal(COMMANDS.run,'Run');
  assert.equal(COMMANDS.sheet,'Character Sheet');
  assert.equal(ATTRIBUTES.spirit,'Spirit');
});

test('all shipped interface strings and icon library names exclude Turkish text',()=>{
  const root=new URL('../',import.meta.url);
  const files=['module.json','README.md','assets/catalog.json',...fs.readdirSync(new URL('scripts/',root)).map(file=>`scripts/${file}`)];
  const turkish=/(?:[\u00e7\u011f\u0131\u00f6\u015f\u00fc\u00c7\u011e\u0130\u00d6\u015e\u00dc]|\b(?:Silahlar|Buton|Kapat|Hasar|Sayfa|sayfa|Kaydet|Vazgec)\b)/;
  for(const file of files)assert.doesNotMatch(fs.readFileSync(new URL(file,root),'utf8'),turkish,file);
  assert.match(fs.readFileSync(new URL('module.json',root),'utf8'),/An RTS command grid for SWADE/);
});
