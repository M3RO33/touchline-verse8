import {ATHLETE_LAYOUT} from './athlete-layout.mjs';
import {ATHLETE_RESOURCES} from './athlete-resources.mjs';
async function readGeometry(){
 if(typeof document==='undefined'){
  const nodeFileSystem='node:fs/promises';
  const fs=await import(/* @vite-ignore */ nodeFileSystem);
  const bytes=await fs.readFile(new URL(ATHLETE_RESOURCES.geometry,import.meta.url));
  return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 }
 const response=await fetch(new URL(ATHLETE_RESOURCES.geometry,document.baseURI));
 if(!response.ok)throw new Error('Athlete geometry could not load: '+response.status);
 return response.arrayBuffer();
}
const buffer=await readGeometry(),types={Float32Array,Int16Array,Uint8Array,Uint16Array};
export const ATHLETE_DATA=Object.fromEntries(Object.entries(ATHLETE_LAYOUT).map(([lod,layout])=>[
 lod,{vertexCount:layout.vertexCount,groups:layout.groups,...Object.fromEntries(Object.entries(layout.attributes).map(([name,field])=>[
  name,new types[field.type](buffer,field.offset,field.bytes/types[field.type].BYTES_PER_ELEMENT)
 ]))}
]));
