import * as THREE from 'three';
export function createPitchMaterial(stage='pro'){
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d'),data=ctx.createImageData(canvas.width,canvas.height);let seed=1701;
 const dirt=stage==='lot'||stage==='school',base=stage==='lot'?[136,115,83]:stage==='school'?[157,132,95]:stage==='amateur'?[48,104,56]:[39,91,54];
 for(let y=0;y<1024;y++)for(let x=0;x<2048;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=((seed>>>16)%23-11),stripe=dirt?0:Math.floor(x/(2048/14))%2?5:-2,edge=Math.min(x,2047-x,y*2,(1023-y)*2)/120,wear=(Math.abs(y-512)<150&&(x<110||x>1938))?8:0,i=(y*2048+x)*4,patch=dirt?Math.sin(x*.014)*Math.sin(y*.022)*5:stage==='amateur'?Math.sin(x*.021+y*.004)*Math.cos(y*.017)*4:0,grass=dirt&&stage==='lot'&&edge<.65&&Math.sin(x*.044)*Math.cos(y*.051)>.1?14:0;data.data[i]=base[0]+stripe+noise*(dirt?.75:.25)+wear+patch-grass;data.data[i+1]=base[1]+stripe+noise+Math.min(1,edge)*(dirt?2:7)+patch+grass*.3;data.data[i+2]=base[2]+stripe+noise*(dirt?.6:.45)+patch-grass*.3;data.data[i+3]=255;}ctx.putImageData(data,0,0);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=16;
 const bumpCanvas=document.createElement('canvas');bumpCanvas.width=512;bumpCanvas.height=512;const bumpCtx=bumpCanvas.getContext('2d'),grain=bumpCtx.createImageData(512,512);for(let i=0;i<grain.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=80+(seed>>>24)*.6;grain.data[i]=grain.data[i+1]=grain.data[i+2]=v;grain.data[i+3]=255;}bumpCtx.putImageData(grain,0,0);const bump=new THREE.CanvasTexture(bumpCanvas);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(28,18);bump.anisotropy=8;
 return new THREE.MeshStandardMaterial({map,bumpMap:bump,bumpScale:dirt?.027:.018,roughness:.96});
}
export function createMatchBall(){
 const group=new THREE.Group(),radius=.115;
 const ico=new THREE.IcosahedronGeometry(1,0),p=ico.getAttribute('position'),verts=[],faces=[];
 const vertex=(v)=>{let i=verts.findIndex(q=>q.distanceTo(v)<.0001);if(i<0){i=verts.length;verts.push(v);}return i;};
 for(let i=0;i<p.count;i+=3)faces.push([0,1,2].map(j=>vertex(new THREE.Vector3().fromBufferAttribute(p,i+j).normalize())));
 const neighbours=verts.map(()=>new Set());for(const f of faces)for(let j=0;j<3;j++){neighbours[f[j]].add(f[(j+1)%3]);neighbours[f[j]].add(f[(j+2)%3]);}
 const trunc=(i,j)=>verts[i].clone().multiplyScalar(2/3).addScaledVector(verts[j],1/3).normalize().multiplyScalar(radius);
 const polys=[];verts.forEach((v,i)=>polys.push({black:true,points:[...neighbours[i]].map(j=>trunc(i,j))}));faces.forEach(([a,b,c])=>polys.push({black:false,points:[trunc(a,b),trunc(b,a),trunc(b,c),trunc(c,b),trunc(c,a),trunc(a,c)]}));
 const position=[],normals=[],color=[],seams=[];
 for(const poly of polys){const center=poly.points.reduce((a,b)=>a.add(b),new THREE.Vector3()).normalize(),u=new THREE.Vector3().crossVectors(center,new THREE.Vector3(0,1,0));if(u.length()<.01)u.crossVectors(center,new THREE.Vector3(1,0,0));u.normalize();const v=new THREE.Vector3().crossVectors(center,u);poly.points.sort((a,b)=>Math.atan2(a.dot(v),a.dot(u))-Math.atan2(b.dot(v),b.dot(u)));const c=center.clone().multiplyScalar(radius),shade=new THREE.Color(poly.black?'#152232':'#ebeee7');
   for(let j=0;j<poly.points.length;j++){const a=poly.points[j].clone().lerp(c,.014).normalize().multiplyScalar(radius),b=poly.points[(j+1)%poly.points.length].clone().lerp(c,.014).normalize().multiplyScalar(radius);seams.push(a.clone().multiplyScalar(1.002),b.clone().multiplyScalar(1.002));
     const n=4,point=(r,s)=>c.clone().multiplyScalar(1-(r+s)/n).addScaledVector(a,r/n).addScaledVector(b,s/n).normalize().multiplyScalar(radius);
     const tri=(q0,q1,q2)=>{for(const q of [q0,q1,q2]){position.push(q.x,q.y,q.z);const norm=q.clone().normalize();normals.push(norm.x,norm.y,norm.z);color.push(shade.r,shade.g,shade.b);}};
     for(let r=0;r<n;r++)for(let s=0;s<n-r;s++){tri(point(r,s),point(r+1,s),point(r,s+1));if(r+s<n-1)tri(point(r+1,s),point(r+1,s+1),point(r,s+1));}
   }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));const panels=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.57,side:THREE.DoubleSide}));panels.castShadow=true;group.add(panels);group.add(new THREE.Mesh(new THREE.SphereGeometry(radius*.991,24,16),new THREE.MeshStandardMaterial({color:'#33434c',roughness:.7})));group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seams),new THREE.LineBasicMaterial({color:'#647473',transparent:true,opacity:.24})));return group;
}
export function createContactGrass(){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.005,0,0,.005,0,0,0,.042,.012],3));geometry.computeVertexNormals();const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshLambertMaterial({color:'#ffffff',side:THREE.DoubleSide}),6000),dummy=new THREE.Object3D();let seed=121;
 for(let i=0;i<6000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=(seed/4294967296-.5)*18;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const z=(seed/4294967296-.5)*14;dummy.position.set(x,.012,z);dummy.rotation.y=i*2.37;dummy.scale.setScalar(.45+(i%11)/14);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(i%3?'#407248':'#608753'));}mesh.receiveShadow=true;return mesh;
}
