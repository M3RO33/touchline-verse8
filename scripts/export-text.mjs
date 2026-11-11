import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
async function walk(directory) {
  const entries=await fs.readdir(directory,{withFileTypes:true});
  const result=[];
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))) {
    if(['node_modules','.build-cache','dist','.git'].includes(entry.name)) continue;
    const file=path.join(directory,entry.name);
    if(entry.isDirectory()) result.push(...await walk(file)); else result.push(file);
  }
  return result;
}
const files=await walk(root);
let text='TOUCHLINE Verse8 migration source / game 1.14.0\nThis is source material, not a deployed Verse8 project.\nBinary models and textures must be imported from the accompanying ZIP public/assets folder.\n\n';
for(const file of files){
 const bytes=await fs.readFile(file),relative=path.relative(root,file).replaceAll('\\','/');
 const content=/\.(bin|jpg|png)$/i.test(file)?`BINARY ASSET: use ${relative} from the ZIP. ${bytes.length} bytes; SHA256 ${createHash('sha256').update(bytes).digest('hex')}`:bytes.toString('utf8');
 text+='\n=== FILE: '+relative+' ===\n'+content+'\n=== END FILE ===\n';
}
await fs.writeFile(path.resolve(root,'../../outputs/Touchline-Verse8-source.txt'),text);
console.log(`Exported ${files.length} text files.`);
