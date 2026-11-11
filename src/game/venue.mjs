import * as THREE from 'three';

// Every venue keeps regulation pitch coordinates. The environment is built once
// per selection and retained; changing careers never rebuilds match actors.
export const VENUE_SETTINGS=Object.freeze({
 lot:{sky:'#afc3bd',fog:'#afc3bd',exposure:1.04,key:'#fff0ce',keyPower:2.5,fillPower:.55,ground:'#787c57',grass:false},
 school:{sky:'#a1c8dc',fog:'#a1c8dc',exposure:1.08,key:'#fff5da',keyPower:2.7,fillPower:.65,ground:'#ab9270',grass:false},
 amateur:{sky:'#91b7bf',fog:'#91b7bf',exposure:1.04,key:'#fff3db',keyPower:2.5,fillPower:.70,ground:'#447447',grass:true},
 pro:{sky:'#354a61',fog:'#354a61',exposure:1.15,key:'#e2ecff',keyPower:3.0,fillPower:1.1,ground:'#253e38',grass:true},
 stadium:{sky:'#0c182c',fog:'#17253c',exposure:1.13,key:'#f0f4ff',keyPower:3.6,fillPower:1.3,ground:'#223b35',grass:true}
});

class Builder{
 constructor(){this.group=new THREE.Group();this.bins=new Map();this.materials=new Map();this.metrics={buildings:0,standRows:0,spectators:0,lightMasts:0};}
 part(geometry,color,position,rotation=[0,0,0],scale=[1,1,1]){const g=geometry.clone();g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale)));if(!this.bins.has(color))this.bins.set(color,[]);this.bins.get(color).push(g);geometry.dispose();}
 box(w,h,d,color,p,r){this.part(new THREE.BoxGeometry(w,h,d),color,p,r);}
 cylinder(radius,height,color,p,r){this.part(new THREE.CylinderGeometry(radius,radius,height,10),color,p,r);}
 tree(x,z,size=1){this.cylinder(.22*size,4*size,'#6d6650',[x,2*size,z]);for(let i=0;i<3;i++)this.part(new THREE.IcosahedronGeometry(1,1),i%2?'#426b48':'#52794e',[x+(i-1)*.8*size,(4.1+i*.45)*size,z+Math.sin(i*4)*.7*size],[],[2.1*size,2.5*size,2*size]);}
 bench(x,z,side=1){this.box(3.4,.12,.62,'#9f8160',[x,.52,z]);this.box(3.4,.53,.09,'#9f8160',[x,.89,z+side*.28]);for(const dx of [-1.35,1.35])this.box(.075,.5,.46,'#424c49',[x+dx,.25,z]);}
 building(x,z,w,d,h,color='#c8bd9f'){this.metrics.buildings++;this.box(w,h,d,color,[x,h*.5,z]);this.box(w+.5,.3,d+.5,'#62716b',[x,h+.15,z]);this.box(w,.65,d,'#797d70',[x,.325,z]);for(let row=0;row<Math.max(1,Math.floor(h/3));row++)for(let col=0;col<Math.floor(w/3.8);col++){const wx=x-w*.5+2.1+col*3.8;this.box(1.6,1.35,.08,'#66838a',[wx,2.1+row*2.8,z+d*.5+.05]);this.box(.06,1.45,.11,'#dad5bf',[wx,2.1+row*2.8,z+d*.5+.11]);this.box(1.68,.07,.12,'#dad5bf',[wx,2.1+row*2.8,z+d*.5+.11]);}}
 fence(x,z,w,d,height=2.2){const points=[];for(const sign of [-1,1]){for(let xx=-w*.5;xx<=w*.5;xx+=5)this.cylinder(.045,height,'#77857b',[x+xx,height*.5,z+sign*d*.5]);for(let zz=-d*.5;zz<=d*.5;zz+=5)this.cylinder(.045,height,'#77857b',[x+sign*w*.5,height*.5,z+zz]);for(const y of [.25,height*.5,height]){points.push(new THREE.Vector3(x-w*.5,y,z+sign*d*.5),new THREE.Vector3(x+w*.5,y,z+sign*d*.5));points.push(new THREE.Vector3(x+sign*w*.5,y,z-d*.5),new THREE.Vector3(x+sign*w*.5,y,z+d*.5));}}
  // Fine mesh is one line draw call, not thousands of transparent planes.
  for(const sign of [-1,1]){for(let xx=-w*.5;xx<w*.5;xx+=.7)points.push(new THREE.Vector3(x+xx,.2,z+sign*d*.5),new THREE.Vector3(x+xx,height,z+sign*d*.5));for(let zz=-d*.5;zz<d*.5;zz+=.7)points.push(new THREE.Vector3(x+sign*w*.5,.2,z+zz),new THREE.Vector3(x+sign*w*.5,height,z+zz));}
  this.group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9aafa3',transparent:true,opacity:.30})));
 }
 lights(x,z,height=18){this.metrics.lightMasts++;this.cylinder(.16,height,'#7f9395',[x,height*.5,z]);this.box(4.1,.8,.5,'#384d5b',[x,height,z]);for(let i=0;i<5;i++)this.box(.57,.52,.07,'lamp',[x-1.6+i*.8,height,z+.3]);}
 stand(sign,{rows=6,length=116,start=40,step=1.6,roof=false,end=false}={}){this.metrics.standRows+=rows;for(let r=0;r<rows;r++){const y=.6+r*.72,s=sign*(start+r*step);this.box(end?step:length,.62,end?length:step,r%2?'#586974':'#687a82',end?[s,y,0]:[0,y,s]);this.box(end?.45:length,.30,end?length:.45,'#375c69',end?[s,y+.42,0]:[0,y+.42,s+sign*.28]);}if(roof){const z=sign*(start+rows*step-2),h=rows*.72+5;this.box(end?rows*step+5:length+5,.45,end?length+5:rows*step+5,'#243d4b',end?[z,h,0]:[0,h,z]);for(let i=-2;i<=2;i++)this.box(.28,h,.28,'#81989f',end?[sign*(start+rows*step),h*.5,i*length/5]:[i*length/5,h*.5,sign*(start+rows*step)]);}}
 crowd(sign,{rows=6,length=112,start=40,step=1.6,end=false,density=1.7}={}){const columns=Math.floor(length/density),count=rows*columns;this.metrics.spectators+=count;const g=new THREE.SphereGeometry(.22,5,4),m=new THREE.MeshLambertMaterial({color:'#ffffff'}),mesh=new THREE.InstancedMesh(g,m,count),dummy=new THREE.Object3D(),palette=['#cfd8bf','#466c8a','#cb814f','#719376','#cfb89a','#395559','#8f6681'];let index=0;for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const across=-length*.5+c*density+(r%2)*.45,s=sign*(start+r*step),y=1.30+r*.72;dummy.position.set(...(end?[s,y,across]:[across,y,s]));dummy.scale.set(.84,1.65,.84);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);mesh.setColorAt(index,new THREE.Color(palette[(r*3+c*7+Math.floor(c/4))%palette.length]));index++;}mesh.instanceMatrix.needsUpdate=true;this.group.add(mesh);}
 sign(text,x,y,z,w=12,h=2,texture){this.box(w+.3,h+.3,.28,'#19333e',[x,y,z-.12]);if(texture){const material=new THREE.MeshBasicMaterial({map:texture(text,'#d9f5bf',h<2)}),p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);p.position.set(x,y,z+.04);this.group.add(p);}}
 finish(id){for(const [color,geometries]of this.bins){const positions=[],normals=[],indices=[];let offset=0;for(const g of geometries){const p=g.getAttribute('position'),n=g.getAttribute('normal');positions.push(...p.array);normals.push(...n.array);if(g.index)for(const index of g.index.array)indices.push(offset+index);else for(let i=0;i<p.count;i++)indices.push(offset+i);offset+=p.count;g.dispose();}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);const m=color==='lamp'?new THREE.MeshBasicMaterial({color:'#edf5ff'}):new THREE.MeshStandardMaterial({color,roughness:.88});const mesh=new THREE.Mesh(g,m);mesh.castShadow=color!=='lamp';mesh.receiveShadow=true;this.group.add(mesh);}this.group.name='venue-'+id;this.group.userData={id,...this.metrics};return this.group;}
}

export function createVenue(id='lot',{textTexture}={}){
 if(!VENUE_SETTINGS[id])id='lot';const b=new Builder();
 if(id==='lot'){
  b.box(200,.12,155,'#7f865e',[0,-.35,0]);b.box(175,.06,9,'#696f69',[0,-.24,-64]);b.fence(0,0,119,82,1.8);
  for(let i=0;i<7;i++)b.building(-72+i*23,-84,17+(i%3)*3,12,7+(i%4)*3,['#c9b697','#a8ad9a','#b4a895'][i%3]);
  b.building(69,9,12,19,5,'#a6b4a3');b.building(-65,-23,9,11,3.4,'#847b65');
  for(const [x,z,s]of [[-65,43,1.2],[67,43,.9],[60,-47,1.3],[-77,-58,1.1],[-35,-71,1]])b.tree(x,z,s);
  b.bench(-10,39);b.bench(9,39);for(let i=0;i<5;i++)b.part(new THREE.ConeGeometry(.22,.65,12),'#c97b39',[-17+i*2,.325,38]);
  for(const x of [-70,0,70])b.cylinder(.11,12,'#6d6955',[x,6,-69]);const cable=[-70,0,70].map(x=>new THREE.Vector3(x,11.3,-69));b.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cable),new THREE.LineBasicMaterial({color:'#424d45'})));b.sign('COMMUNITY GROUND',0,2.1,-41,10,1,textTexture);
 }else if(id==='school'){
  b.box(185,.10,144,'#afa085',[0,-.32,0]);
  // Rectangular athletics lanes sit outside the playable area.
  for(let i=0;i<4;i++){const w=115+i*2,d=77+i*2;b.box(w,.04,.75,'#b75b43',[0,-.15,-d*.5]);b.box(w,.04,.75,'#b75b43',[0,-.15,d*.5]);b.box(.75,.04,d,'#b75b43',[-w*.5,-.15,0]);b.box(.75,.04,d,'#b75b43',[w*.5,-.15,0]);}
  b.building(0,-72,101,15,11.2,'#e0d6bc');b.box(8,2.4,2,'#758a88',[0,1.2,-63]);b.sign('TOUCHLINE SCHOOL',0,9.7,-64.3,20,1.5,textTexture);b.building(-70,-32,17,29,8,'#c3c3a5');b.fence(0,0,134,99,2.5);
  for(const x of [-40,-15,15,40])b.tree(x,52,.8);b.bench(-20,47);b.bench(20,47);b.box(16,.05,25,'#738d89',[77,.01,9]);for(const z of [-1,19]){b.cylinder(.07,3.1,'#788b8c',[77,1.55,z]);b.box(1.8,1.05,.08,'#d2d6c4',[77,3.1,z]);b.part(new THREE.TorusGeometry(.23,.025,6,20),'#bd7449',[77,2.7,z+.22],[Math.PI/2,0,0]);}
  b.cylinder(.075,11,'#b7c4bf',[-46,5.5,-52]);b.box(2.3,1.4,.04,'#e9e8d7',[-44.8,9.9,-52]);
 }else if(id==='amateur'){
  b.box(190,.12,145,'#547547',[0,-.32,0]);b.fence(0,0,129,91,2);b.stand(-1,{rows:4,length:86,start:40,step:1.5});b.crowd(-1,{rows:3,length:80,start:40,step:1.5,density:2.4});b.building(21,-62,44,12,5.6,'#c8c4a6');b.sign('LOCAL LEAGUE',21,4.7,-55.8,18,1.2,textTexture);b.building(-45,46,14,8,3.3,'#7a9486');b.bench(-18,38);b.bench(18,38);
  for(const x of [-61,61])for(const z of [-42,42])b.lights(x,z,13);for(const [x,z]of [[-75,-58],[70,-56],[-70,53],[70,53]])b.tree(x,z,1.4);b.sign('TOUCHLINE • AMATEUR',0,1.0,-36.8,30,1.2,textTexture);
 }else{
  const stadium=id==='stadium',rows=stadium?16:8,start=40,step=1.6;
  b.box(205,.18,170,'#304a45',[0,-.35,0]);for(const sign of [-1,1]){b.stand(sign,{rows,length:126,start,step,roof:true});b.crowd(sign,{rows:stadium?14:7,length:120,start,step,density:stadium?1.5:2.0});b.box(108,.9,.35,'#172f36',[0,.62,sign*36.7]);if(sign===-1)b.sign(stadium?'TOUCHLINE CHAMPIONSHIP':'TOUCHLINE PROFESSIONAL',0,1.0,-36.45,68,.9,textTexture);}
  for(const x of [-65,65])for(const z of [-44,44])b.lights(x,z,stadium?33:23);
  b.box(8,3.5,5,'#152a32',[0,1.6,-39]);b.box(7,3,5.1,'#07131b',[0,1.5,-38.9]);b.bench(-17,38);b.bench(17,38);
  if(stadium){for(const sign of [-1,1]){b.stand(sign,{rows:12,length:79,start:61,step,roof:true,end:true});b.crowd(sign,{rows:10,length:72,start:61,step,end:true,density:1.7});b.box(135,1.0,3,'#344e5c',[0,rows*.72+2.1,sign*61]);}b.sign('TOUCHLINE',0,17.6,-67,20,7,textTexture);b.box(165,.7,14,'#273e50',[0,25,-75]);for(const x of [-65,-32,0,32,65])b.box(.28,15,.28,'#8196a6',[x,18,-77]);}
  else{b.building(-50,-63,24,12,6,'#6e888d');b.sign('MATCHDAY',-50,5,-56.8,16,1.5,textTexture);for(const sign of [-1,1])b.stand(sign,{rows:4,length:73,start:61,step,end:true});}
 }
 return b.finish(id);
}
