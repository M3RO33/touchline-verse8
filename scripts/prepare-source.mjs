import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const source = path.resolve(root, '../touchline/dist');
const destination = path.join(root, 'src/game');
await fs.mkdir(destination, { recursive: true });
const provenance = { gameVersion: '1.14.0', baseline: 'Touchline v16 fixture lobby, bottom VAR console, rebuilt athlete and sourced motion', files: {}, assets: {} };
for (const name of (await fs.readdir(source)).filter(name => /\.(js|mjs)$/.test(name))) {
  const original = await fs.readFile(path.join(source, name), 'utf8');
  const content = original.replaceAll("from './vendor/three.module.js'", "from 'three'");
  await fs.writeFile(path.join(destination, name), content);
  provenance.files[name] = createHash('sha256').update(content).digest('hex');
}
const html = await fs.readFile(path.join(source,'index.html'),'utf8');
// Keep the wrapper's theme, title and favicon aligned while preserving Vite's entry.
const wrapperFile=path.join(root,'index.html');
let wrapper=await fs.readFile(wrapperFile,'utf8');
for(const pattern of [/<meta name="theme-color"[^>]*>/,/<meta name="description"[^>]*>/,/<title>[\s\S]*?<\/title>/,/<link rel="icon"[^>]*>/]){
 const canonicalTag=html.match(pattern)?.[0];if(canonicalTag)wrapper=wrapper.replace(pattern,()=>canonicalTag);
}
await fs.writeFile(wrapperFile,wrapper);
const markup = html.match(/<body[^>]*>([\s\S]*?)<script type="module" src="\.\/app\.js"><\/script>\s*<\/body>/)?.[1];
if(!markup) throw new Error('Game markup not found');
await fs.writeFile(path.join(destination,'markup.html'),markup);
const css = await fs.readFile(path.join(source,'style.css'),'utf8');
if(/@import|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(css))throw new Error('The v16 game theme must be self-contained.');
await fs.writeFile(path.join(destination,'style.css'),css);
await fs.mkdir(path.join(root,'public/assets'),{recursive:true});
for(const name of await fs.readdir(path.join(source,'assets'))){
 const content=await fs.readFile(path.join(source,'assets',name));
 await fs.writeFile(path.join(root,'public/assets',name),content);
 provenance.assets[name]={bytes:content.length,sha256:createHash('sha256').update(content).digest('hex')};
}
await fs.writeFile(path.join(root,'SOURCE-PROVENANCE.json'),JSON.stringify(provenance,null,2)+'\n');
await fs.mkdir(path.join(root,'licenses'),{recursive:true});
await fs.copyFile(path.join(source,'vendor/LICENSE-three.txt'),path.join(root,'licenses/LICENSE-three.txt'));
await fs.copyFile(path.join(source,'ASSET-CREDITS.txt'),path.join(root,'licenses/ASSET-CREDITS.txt'));
for(const name of await fs.readdir(path.join(source,'licenses'))){await fs.copyFile(path.join(source,'licenses',name),path.join(root,'licenses',name));}
await fs.copyFile(path.join(source,'SHIPPED-SOURCES.txt'),path.join(root,'licenses/SHIPPED-SOURCES.txt'));
console.log('Prepared current game for Vite/React; gameplay logic preserved.');
