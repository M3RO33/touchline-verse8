import * as THREE from 'three';
import {sampleLocomotion,linearPath} from './motion.mjs';
import {bindAthleteModel,athleteTexture,updateClothContacts} from './athlete-model.mjs';
const V=THREE.Vector3,DOWN=new V(0,-1,0),UPPER=.45,LOWER=.43,kitCache=new Map();
function surfaceNoise(kind){const size=128,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const seed=Math.sin(x*127.1+y*311.7)*43758.5453,n=seed-Math.floor(seed),v=kind==='cloth'?128+14*Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)+n*9:128+n*12;const i=(y*size+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;}const tex=new THREE.DataTexture(data,size,size);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(kind==='cloth'?9:2,kind==='cloth'?9:2);tex.needsUpdate=true;return tex;}
const fabric=surfaceNoise('cloth'),pores=surfaceNoise('skin');
function cloth(team,number){
 const key=team+number;if(kitCache.has(key))return kitCache.get(key);const home=team==='home',c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),navy='#173448',ink=home?navy:'#fff5e6';
 x.fillStyle=home?'#f5f4ec':'#dd6b42';x.fillRect(0,0,512,512);x.fillStyle=navy;for(const u of [112,368])x.fillRect(u,0,30,512);x.fillRect(0,0,512,13);x.fillRect(0,501,512,11);
 x.fillStyle=ink;x.textAlign='center';x.font='bold 156px Arial';x.fillText(String(number),256,349);x.font='bold 19px Arial';x.fillText(home?'NORTH FC':'EAST UTD',256,110);
 for(const center of [0,512]){x.font='bold 26px Arial';x.fillText(home?'NORTH':'EAST',center,270);x.font='bold 12px Arial';x.fillText('TOUCHLINE',center,308);x.fillStyle=navy;x.beginPath();x.moveTo(center+28,130);x.lineTo(center+51,130);x.lineTo(center+48,159);x.lineTo(center+39,167);x.lineTo(center+31,159);x.closePath();x.fill();x.fillStyle='#f8f5e6';x.font='bold 14px Arial';x.fillText(home?'N':'E',center+39,151);x.fillStyle=ink;}
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;kitCache.set(key,tex);return tex;
}
export function createFootballer(scene,team,number,{textures=true}={}){
 const group=new THREE.Group(),body=new THREE.Bone();group.add(body);body.position.y=.94;
 const spine=new THREE.Bone(),chest=new THREE.Bone(),neck=new THREE.Bone(),headPivot=new THREE.Bone();spine.position.y=.18;chest.position.y=.23;neck.position.y=.16;headPivot.position.y=.09;body.add(spine);spine.add(chest);chest.add(neck);neck.add(headPivot);
 const home=team==='home',ref=team==='ref',keeper=number===1,kit=ref?'#2477bc':keeper?(home?'#7195b0':'#af9f3b'):home?'#e1e8df':'#dd7045',skin=['#fff5ed','#e5b696','#ba8968','#f6d5b9','#d0a182'][number%5];
 const materials=[new THREE.MeshStandardMaterial({vertexColors:true,roughness:.64}),new THREE.MeshStandardMaterial({color:textures&&!keeper&&!ref?'#ffffff':kit,map:textures&&!keeper&&!ref?cloth(team,number):null,vertexColors:true,roughness:.91,bumpMap:fabric,bumpScale:.0005}),new THREE.MeshStandardMaterial({color:textures?'#fffaf4':'#bc947c',map:textures?athleteTexture(number%3===1?'skinLight':'skin'):null,vertexColors:true,roughness:.76,bumpMap:pores,bumpScale:.00012}),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.94,bumpMap:fabric,bumpScale:.001}),new THREE.MeshStandardMaterial({color:textures?'#33231c':'#25231f',map:textures?athleteTexture('hair'):null,alphaTest:.38,side:THREE.DoubleSide,roughness:.94}),new THREE.MeshStandardMaterial({color:textures?'#ffffff':'#b7a897',map:textures?athleteTexture('eye'):null,roughness:.43})];
 const legs=[],knees=[],feet=[],arms=[],elbows=[],wrists=[],digits=[];
 for(const side of [-1,1]){
  const thigh=new THREE.Bone();thigh.position.set(side*.104,-.03,0);body.add(thigh);legs.push(thigh);const shin=new THREE.Bone();shin.position.y=-UPPER;thigh.add(shin);knees.push(shin);const foot=new THREE.Bone();foot.position.y=-LOWER;shin.add(foot);feet.push(foot);
  const arm=new THREE.Bone();arm.position.set(side*.226,.515,0);body.add(arm);arms.push(arm);const fore=new THREE.Bone();fore.position.y=-.29;arm.add(fore);elbows.push(fore);const wrist=new THREE.Bone();wrist.position.y=-.245;fore.add(wrist);wrists.push(wrist);const hand=[];
  for(let j=0;j<5;j++){const thumb=j===4,b=new THREE.Bone();b.position.set(thumb?-side*.030:-.021+j*.014,thumb?-.028:-.052,thumb?.009:.008);b.rotation.z=thumb?-side*.65:0;wrist.add(b);const distal=new THREE.Bone();distal.position.y=thumb?-.024:-.028;b.add(distal);hand.push({b,distal,thumb,side});}digits.push(hand);
 }
 const brows=[],lids=[];for(const side of [-1,1]){const b=new THREE.Bone();b.position.set(side*.039,.091,.098);headPivot.add(b);brows.push(b);const lid=new THREE.Bone();lid.position.set(side*.039,.083,.103);headPivot.add(lid);lids.push(lid);}const jaw=new THREE.Bone();jaw.position.set(0,-.009,.093);headPivot.add(jaw);
 group.updateMatrixWorld(true);arms.forEach(a=>chest.attach(a));
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(.40,28),new THREE.MeshBasicMaterial({color:'#152c1c',transparent:true,opacity:.17,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.018;group.add(shadow);const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.495,48),new THREE.MeshBasicMaterial({color:home?'#80e4f4':'#df9df1',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.035;ring.visible=false;group.add(ring);
 let labelTexture=null;if(textures){const c=document.createElement('canvas');c.width=192;c.height=72;const ctx=c.getContext('2d');ctx.fillStyle='#14231ddd';ctx.fillRect(25,12,142,47);ctx.fillStyle=home?'#cbf1f5':'#f9d0f7';ctx.textAlign='center';ctx.font='bold 32px Arial';ctx.fillText((home?'N':'E')+' #'+number,96,47);labelTexture=new THREE.CanvasTexture(c);}const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture,transparent:true,depthTest:false,opacity:.9}));sprite.position.y=2.0;sprite.scale.set(.78,.29,1);sprite.visible=false;group.add(sprite);
 const p={group,body,spine,chest,neck,headPivot,legs,knees,feet,arms,elbows,wrists,digits,brows,lids,jaw,shadow,ring,sprite,team,number,id:team+'-'+number,base:new V(),bootColor:ref?'#17272c':home?'#4bc4ce':'#ebc862',materials,build:1,faceWidth:1};bindAthleteModel(p);
 if(ref){
  const dark=new THREE.MeshStandardMaterial({color:'#23383c',roughness:.75}),badge=new THREE.MeshStandardMaterial({color:'#e4eddd',roughness:.7});
  const add=(geo,mat,pos,parent)=>{const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;parent.add(m);return m;};
  add(new THREE.BoxGeometry(.095,.008,.007),dark,[-.095,.40,.14],body);add(new THREE.BoxGeometry(.095,.008,.007),dark,[.095,.40,.14],body);add(new THREE.BoxGeometry(.042,.056,.006),badge,[-.095,.357,.139],body);
  add(new THREE.BoxGeometry(.038,.031,.013),dark,[0,.003,.027],wrists[0]);add(new THREE.BoxGeometry(.046,.073,.022),dark,[.17,.04,0],body);add(new THREE.SphereGeometry(.012,10,8),dark,[.092,.065,.002],headPivot);
 }
 scene.add(group);return p;
}
export function solveLeg(p,index,target,hint){
 const hip=p.legs[index].position.clone();const local=p.body.worldToLocal(new V(...target)),delta=local.clone().sub(hip);const raw=delta.length(),length=Math.min(UPPER+LOWER-.001,Math.max(.03,raw));const direction=delta.normalize();
 const along=(UPPER*UPPER-LOWER*LOWER+length*length)/(2*length),height=Math.sqrt(Math.max(0,UPPER*UPPER-along*along));
 let pole=hint?p.body.worldToLocal(new V(...hint)).sub(hip):new V(0,0,1);pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<.001)pole=new V(1,0,0);pole.normalize();
 const centre=hip.clone().addScaledVector(direction,along),up=new V(0,1,0).applyQuaternion(p.body.getWorldQuaternion(new THREE.Quaternion()).invert()),baseY=p.body.localToWorld(centre.clone()).y;
 // Keep the anatomical knee pole above the turf during a fall or a get-up.
 // This changes the bend direction, never the requested ankle contact point.
 if(height>.001&&baseY+height*pole.dot(up)<.080){const lift=up.clone().addScaledVector(direction,-up.dot(direction)),available=lift.length();if(available>.001){lift.normalize();const amount=Math.min(1,Math.max(-1,(.080-baseY)/(height*available))),side=pole.clone().addScaledVector(lift,-pole.dot(lift));if(side.lengthSq()<.001)side.crossVectors(direction,lift);side.normalize();pole.copy(lift.multiplyScalar(amount).addScaledVector(side,Math.sqrt(1-amount*amount)));}}
 const knee=centre.addScaledVector(pole,height),ankle=hip.clone().addScaledVector(direction,length);
 p.legs[index].quaternion.setFromUnitVectors(DOWN,knee.clone().sub(hip).normalize());
 const localShin=ankle.clone().sub(knee).applyQuaternion(p.legs[index].quaternion.clone().invert()).normalize();p.knees[index].quaternion.setFromUnitVectors(DOWN,localShin);
 return raw-(UPPER+LOWER);
}
function solveArm(p,index,target,hint,weight){
 const arm=p.arms[index],elbow=p.elbows[index],a=arm.quaternion.clone(),b=elbow.quaternion.clone(),hip=arm.position.clone(),local=p.chest.worldToLocal(new V(...target)),delta=local.clone().sub(hip),length=Math.min(.564,Math.max(.03,delta.length())),direction=delta.normalize(),along=(.29*.29-.275*.275+length*length)/(2*length),height=Math.sqrt(Math.max(0,.29*.29-along*along));
 let pole=p.chest.worldToLocal(new V(...hint)).sub(hip);pole.addScaledVector(direction,-pole.dot(direction));if(pole.lengthSq()<1e-12)pole=new V(index===0?-1:1,0,-1).addScaledVector(direction,-new V(index===0?-1:1,0,-1).dot(direction));pole.normalize();const knee=hip.clone().addScaledVector(direction,along).addScaledVector(pole,height),end=hip.clone().addScaledVector(direction,length);
 arm.quaternion.setFromUnitVectors(DOWN,knee.clone().sub(hip).normalize());elbow.quaternion.setFromUnitVectors(DOWN,end.clone().sub(knee).applyQuaternion(arm.quaternion.clone().invert()).normalize());arm.quaternion.copy(a.slerp(arm.quaternion.clone(),weight));elbow.quaternion.copy(b.slerp(elbow.quaternion.clone(),weight));
}
export function poseFootballer(p,state){
 p.group.position.set(state.hip[0],0,state.hip[2]);p.group.rotation.y=state.yaw??(state.heading>0?Math.PI/2:-Math.PI/2);p.body.position.set(0,state.hip[1],0);p.body.rotation.set(state.lean||0,state.pelvisYaw||0,state.roll||0);p.spine.rotation.set(state.spinePitch||0,state.spineYaw??state.twist??0,state.spineRoll||0);p.chest.rotation.set(state.chestPitch||0,state.chestYaw??-(state.twist||0)*.35,state.chestRoll||0);p.headPivot.rotation.set(state.headPitch??(state.armPose==='kick'?.13:-.025),state.headYaw??state.headTurn??0,state.headRoll||0);p.group.updateMatrixWorld(true);
 const pain=state.pain||0,effort=Math.min(1,(state.speed||0)/7.2),clock=((state.time||0)+p.number*.173)%4.2,blink=Math.sin(Math.min(1,Math.max(0,(clock-3.94)/.18))*Math.PI)**2;
 p.jaw.rotation.x=pain*.09+effort*.018;p.brows.forEach((b,i)=>{b.rotation.z=(i?1:-1)*(.015+pain*.20);b.position.y=.091-pain*.005;});p.lids.forEach(l=>{l.position.y=.083-(blink+pain*.25)*.007;l.scale.y=1+blink*.9+pain*.25;});
 const grip=state.grip??(state.armPose==='slide'?.10:state.speed>6?.65:state.speed>2?.58:.17);p.wrists.forEach((w,i)=>{w.rotation.set(state.wristPitch?.[i]??-.08,0,state.wristRoll?.[i]||0);p.digits[i].forEach(d=>{d.b.rotation.x=grip*(d.thumb?.75:.70);d.distal.rotation.x=grip*1.15;});});
 p.maxReachError=0;
 for(let i=0;i<2;i++){p.maxReachError=Math.max(p.maxReachError,solveLeg(p,i,state.feet[i],state.kneeHints?.[i]));p.group.updateMatrixWorld(true);const parentQ=p.knees[i].getWorldQuaternion(new THREE.Quaternion());const desired=p.group.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(state.footPitch?.[i]||0,state.footYaw?.[i]||0,state.footRoll?.[i]||0)));p.feet[i].quaternion.copy(parentQ.invert().multiply(desired));}
 const swing=Math.sin(state.armPhase||0)*(state.armSwing??.38);
 p.arms.forEach((a,i)=>{a.rotation.set((i?1:-1)*swing,0,(i===0?1:-1)*.09);p.elbows[i].rotation.set(-(state.elbowFlex?.[i]??state.elbow??.35),0,0);});
 if(state.armPose==='kick'){p.arms[0].rotation.set(.25,0,-.60);p.arms[1].rotation.set(-.36,0,.42);p.elbows[0].rotation.x=-.5;p.elbows[1].rotation.x=-.8;}
 if(state.kickWeight){const w=state.kickWeight;[[.25,0,-.60],[-.36,0,.42]].forEach((r,i)=>{p.arms[i].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),w);p.elbows[i].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(i?-.8:-.5,0,0)),w);});}
 if(state.armPose==='brace'){p.arms[0].rotation.set(-1.25,0,.5);p.arms[1].rotation.set(-1.35,0,-.4);p.elbows.forEach(a=>a.rotation.x=-.15);}
 if(state.armPose==='slide'){p.arms[0].rotation.set(-.65,0,.55);p.arms[1].rotation.set(.5,0,-.48);}
 if(state.armPose==='card'){p.arms[1].rotation.set(-2.9,0,-.15);p.elbows[1].rotation.x=-.05;p.arms[0].rotation.set(-.25,0,.22);}
 if(state.armPose==='save'){p.arms[0].rotation.set(-1.8,0,.65);p.arms[1].rotation.set(-1.8,0,-.65);p.elbows.forEach(a=>a.rotation.x=-.12);}
 if(state.armPose==='whistle'){p.arms[1].rotation.set(-1.45,0,-.2);p.elbows[1].rotation.x=-1.3;p.arms[0].rotation.set(-1.85,0,.25);}
 if(state.armRotations){p.arms.forEach((arm,i)=>arm.rotation.set(...state.armRotations[i]));p.elbows.forEach((elbow,i)=>elbow.rotation.set(state.elbowAngles[i],0,0));}
 if(state.gesture){const gestures={appeal:[[-.5,0,.68],[-.68,0,-.55]],acknowledge:[[.25,0,.45],[-1.25,0,-.26]],whistle:[[-.25,0,.18],[-1.45,0,-.2]],observe:[[-.18,0,.12],[-.20,0,-.12]],ready:[[-.35,0,.20],[-.35,0,-.20]]},pose=gestures[state.gesture]||gestures.observe,w=state.gestureWeight??1;pose.forEach((r,i)=>{p.arms[i].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),w);p.elbows[i].quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(state.gesture==='whistle'&&i===1?-1.3:-.85,0,0)),w);});}
 if(state.handTargets){p.group.updateMatrixWorld(true);for(let i=0;i<2;i++){solveArm(p,i,state.handTargets[i],state.elbowHints[i],state.handWeight??1);p.group.updateMatrixWorld(true);}}
 for(let i=0;i<2;i++){const groundWeight=state.handGroundWeight?.[i]??(state.handGround?.[i]||state.armPose==='slide'&&i===1?1:0);if(groundWeight>0){const parent=p.elbows[i].getWorldQuaternion(new THREE.Quaternion()),desired=p.group.getWorldQuaternion(new THREE.Quaternion()).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0)));p.wrists[i].quaternion.slerp(parent.invert().multiply(desired),groundWeight*(state.handWeight??1));}}
 p.group.updateMatrixWorld(true);updateClothContacts(p,state);
}
export function animateRunner(p,x,z,t,run=1,dir=1,fall=0){
 const speed=run*2.8,path=linearPath(x-speed*dir*t,z,speed*dir,0),state=sampleLocomotion(path,t,{pace:Math.max(.7,speed),phase:p.number*.13});
 if(fall){state.hip[1]-=fall*.55;state.lean+=fall*1.1;state.armPose='brace';state.armRotations=undefined;state.elbowAngles=undefined;}poseFootballer(p,state);
}
