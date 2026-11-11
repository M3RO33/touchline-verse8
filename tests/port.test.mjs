import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname,'..');
test('ported gameplay matches the packaged baseline with only Three import changes',async()=>{
  const manifest = JSON.parse(await fs.readFile(path.join(root,'SOURCE-PROVENANCE.json'),'utf8'));
  assert.equal(manifest.gameVersion,'1.14.0');
  for(const name of ['career.mjs','review-timer.mjs','venue.mjs','physics.mjs','tactics.mjs','athlete-model.mjs','athlete-data.mjs','athlete-resources.mjs','first-whistle.mjs','rulebook.mjs','locomotion-library.mjs','locomotion-clips.mjs','kick-reference.mjs'])assert.ok(manifest.files[name],name);
  const canonicalNames=(await fs.readdir(path.join(root,'../touchline/dist'))).filter(name=>/\.(js|mjs)$/.test(name)).sort();
  assert.deepEqual(Object.keys(manifest.files).sort(),canonicalNames,'all canonical game modules must be ported');
  for(const [name,hash] of Object.entries(manifest.files)) {
    const content=await fs.readFile(path.join(root,'src/game',name));
    assert.equal(createHash('sha256').update(content).digest('hex'),hash,name);
    const canonical=(await fs.readFile(path.join(root,'../touchline/dist',name),'utf8')).replaceAll("from './vendor/three.module.js'", "from 'three'");
    assert.equal(content.toString('utf8'),canonical,name);
  }
  assert.equal(Object.keys(manifest.assets).length,5);
  for(const [name,asset]of Object.entries(manifest.assets)){
   const bytes=await fs.readFile(path.join(root,'public/assets',name));
   assert.equal(bytes.length,asset.bytes,name);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,name);
   assert.deepEqual(bytes,await fs.readFile(path.join(root,'../touchline/dist/assets',name)),name);
  }
});
test('React mount includes all controls used by the existing simulation',async()=>{
  const app=await fs.readFile(path.join(root,'src/game/app.js'),'utf8');
  const markup=await fs.readFile(path.join(root,'src/game/markup.html'),'utf8');
  for(const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok((markup+app).includes(`id="${match[1]}"`),match[1]);
  const canonicalHtml=await fs.readFile(path.join(root,'../touchline/dist/index.html'),'utf8');
  const canonicalMarkup=canonicalHtml.match(/<body[^>]*>([\s\S]*?)<script type="module" src="\.\/app\.js"><\/script>\s*<\/body>/)?.[1];
  assert.equal(markup,canonicalMarkup,'complete mounted markup matches canonical source');
  assert.equal(await fs.readFile(path.join(root,'src/game/style.css'),'utf8'),await fs.readFile(path.join(root,'../touchline/dist/style.css'),'utf8'),'the complete game theme is retained');
  const wrapper=await fs.readFile(path.join(root,'index.html'),'utf8');
  assert.match(wrapper,/<body data-mode="lobby">/);
  for(const pattern of [/<meta name="theme-color"[^>]*>/,/<link rel="icon"[^>]*>/])assert.equal(wrapper.match(pattern)?.[0],canonicalHtml.match(pattern)?.[0]);
  assert.doesNotMatch(markup,/<script/);
  assert.doesNotMatch(await fs.readFile(path.join(root,'src/game/style.css'),'utf8'),/@import/);
});
