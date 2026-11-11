import * as THREE from 'three';
import {ATHLETE_DATA} from './athlete-data.mjs';
import {ATHLETE_TEXTURES} from './athlete-textures.mjs';
const decoded=new Map(),geometryCache=new Map(),textureCache=new Map();
const palettes={home:{shorts:'#19313d',socks:'#e1e8df',boot:'#4bc4ce'},away:{shorts:'#24322f',socks:'#dd7045',boot:'#ebc862'},ref:{shorts:'#17282b',socks:'#1c292c',boot:'#17272c'}};
function array(text,Type){if(ArrayBuffer.isView(text))return text;const bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Type(bytes.buffer);}
function base(lod){
 if(decoded.has(lod))return decoded.get(lod);const d=ATHLETE_DATA[lod],g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(array(d.position,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(array(d.normal,Int16Array),3,true));g.setAttribute('uv',new THREE.BufferAttribute(array(d.uv,Float32Array),2));g.setAttribute('skinIndex',new THREE.BufferAttribute(array(d.skinIndex,Uint8Array),4));
 const w=array(d.skinWeight,Uint16Array),weights=new Float32Array(w.length);for(let i=0;i<w.length;i+=4){const total=w[i]+w[i+1]+w[i+2]+w[i+3];for(let j=0;j<4;j++)weights[i+j]=w[i+j]/total;}g.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));g.setIndex(new THREE.BufferAttribute(array(d.index,Uint16Array),1));d.groups.forEach(x=>g.addGroup(x.start,x.count,x.materialIndex));
 const kinds=array(d.kind,Uint8Array),colors=array(d.color,Uint16Array);decoded.set(lod,{g,kinds,colors});return decoded.get(lod);
}
export function athleteGeometry(lod,team){
 const key=lod+'/'+team;if(geometryCache.has(key))return geometryCache.get(key);const {g:template,kinds,colors}=base(lod),g=new THREE.BufferGeometry();for(const [key,value]of Object.entries(template.attributes))g.setAttribute(key,value);g.setIndex(template.index);template.groups.forEach(x=>g.addGroup(x.start,x.count,x.materialIndex));
 const palette=palettes[team],shorts=new THREE.Color(palette.shorts),socks=new THREE.Color(palette.socks),boot=new THREE.Color(palette.boot),oldBoot=new THREE.Color('#4bc4ce'),rgb=new Float32Array(colors.length);
 for(let i=0;i<kinds.length;i++){const c=kinds[i]===3||kinds[i]===5?shorts:kinds[i]===4?socks:null;if(c){rgb.set(c.toArray(),i*3);}else{for(let j=0;j<3;j++)rgb[i*3+j]=colors[i*3+j]/65535;if(kinds[i]===6&&Math.abs(rgb[i*3]-oldBoot.r)+Math.abs(rgb[i*3+1]-oldBoot.g)+Math.abs(rgb[i*3+2]-oldBoot.b)<.015)rgb.set(boot.toArray(),i*3);}}
 g.setAttribute('color',new THREE.BufferAttribute(rgb,3));g.computeBoundingSphere();g.userData.source='Quaternius' ;g.userData.lod=lod;geometryCache.set(key,g);return g;
}
export function athleteTexture(name){
 if(textureCache.has(name))return textureCache.get(name);
 let resolve,reject;const ready=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const tex=new THREE.TextureLoader().load(ATHLETE_TEXTURES[name],resolve,undefined,reject);
 tex.userData.ready=ready;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;textureCache.set(name,tex);return tex;
}
export function waitForAthleteTextures(){return Promise.all([...textureCache.values()].map(tex=>tex.userData.ready));}
function withClothContactGeometry(baseGeometry,lod){
 const g=new THREE.BufferGeometry();for(const [name,attribute]of Object.entries(baseGeometry.attributes))g.setAttribute(name,attribute);g.setIndex(baseGeometry.index);baseGeometry.groups.forEach(x=>g.addGroup(x.start,x.count,x.materialIndex));g.userData={...baseGeometry.userData};
 g.morphTargetsRelative=true;g.morphAttributes.position=[new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3),3)];g.morphAttributes.position[0].name='clothGroundContact';g.userData.clothVertices=Array.from(base(lod).kinds.entries()).filter(([,kind])=>kind===3).map(([i])=>i);return g;
}
export function bindAthleteModel(p){
 const bones=[p.body,p.spine,p.chest,p.neck,p.headPivot,...p.legs.flatMap((b,i)=>[b,p.knees[i],p.feet[i]]),...p.arms.flatMap((b,i)=>[b,p.elbows[i],p.wrists[i],...p.digits[i].flatMap(d=>[d.b,d.distal])]),...p.brows,...p.lids,p.jaw],skeleton=new THREE.Skeleton(bones),lod=new THREE.LOD();
 p.skin=new THREE.SkinnedMesh(withClothContactGeometry(athleteGeometry('near',p.team),'near'),p.materials);p.farSkin=new THREE.SkinnedMesh(withClothContactGeometry(athleteGeometry('far',p.team),'far'),p.materials);p.modelLOD=lod;
 for(const mesh of [p.skin,p.farSkin]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;}
 lod.addLevel(p.skin,0);lod.addLevel(p.farSkin,16);p.group.add(lod);p.group.updateMatrixWorld(true);p.skin.bind(skeleton);p.farSkin.bind(skeleton,p.skin.bindMatrix);p.head=p.skin;p.shirt=p.skin;
}
const skinnedMatrix=new THREE.Matrix4(),inverseLinear=new THREE.Matrix3(),worldPoint=new THREE.Vector3(),delta=new THREE.Vector3(),meshUp=new THREE.Vector3();
export function updateClothContacts(p,state){
 const active=state.hip[1]<.60;
 for(const mesh of [p.skin,p.farSkin]){
  mesh.morphTargetInfluences[0]=0;if(!active)continue;
  const geometry=mesh.geometry,offset=geometry.morphAttributes.position[0],data=offset.array,skinIndex=geometry.attributes.skinIndex,skinWeight=geometry.attributes.skinWeight;data.fill(0);mesh.skeleton.update();const matrices=mesh.skeleton.boneMatrices;
  meshUp.set(0,1,0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld).invert());
  let corrected=false;
  for(const i of geometry.userData.clothVertices){
   mesh.getVertexPosition(i,worldPoint);mesh.localToWorld(worldPoint);const penetration=.004-worldPoint.y;if(penetration<=0)continue;
   skinnedMatrix.elements.fill(0);for(let k=0;k<4;k++){const weight=skinWeight.array[i*4+k],index=skinIndex.array[i*4+k];if(!weight)continue;for(let j=0;j<16;j++)skinnedMatrix.elements[j]+=matrices[index*16+j]*weight;}
   skinnedMatrix.premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix);inverseLinear.setFromMatrix4(skinnedMatrix);if(Math.abs(inverseLinear.determinant())<.00001)continue;inverseLinear.invert();delta.copy(meshUp).multiplyScalar(penetration).applyMatrix3(inverseLinear);data.set(delta.toArray(),i*3);corrected=true;
  }
  if(corrected){offset.needsUpdate=true;mesh.morphTargetInfluences[0]=1;}
 }
}
