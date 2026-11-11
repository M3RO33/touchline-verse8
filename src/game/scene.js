import * as THREE from 'three';
import {createFootballer,poseFootballer,animateRunner} from './players.js';
import {sampleIncident,sampleSupportingPlayer,sampleFormationPlayer,contactPoint,smooth} from './choreography.mjs';
import {sampleLocomotion,sampleKick,sampleDribble,sampleIdle,sampleOpenPlay,linearPath,localPoint,yawFor,blendPose,sampleMotionStudio,sampleRestartBall,BallRotationTrack,ease} from './motion.mjs';
import {createPitchMaterial,createMatchBall,createContactGrass} from './visuals.js';
import {createVenue,VENUE_SETTINGS} from './venue.mjs';
const V=THREE.Vector3;
export class Stadium {
  constructor(container){
    this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#0a1425');this.scene.fog=new THREE.Fog('#142536',100,235);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;container.prepend(this.renderer.domElement);
    this.camera=new THREE.PerspectiveCamera(48,1,.1,320);this.focus=new V(12,0,0);this.camera.position.set(8,46,63);this.camera.lookAt(this.focus);this.cameraMode='broadcast';this.zoom=false;this.orbitYaw=0;this.orbitPitch=0;this.zoomFactor=1;
    this.hemisphere=new THREE.HemisphereLight('#d6e3f4','#293b24',1.0);this.scene.add(this.hemisphere);
    const key=new THREE.DirectionalLight('#fff4e3',2.7);key.position.set(-25,60,25);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-64;key.shadow.camera.right=64;key.shadow.camera.top=48;key.shadow.camera.bottom=-48;key.shadow.camera.far=130;key.shadow.normalBias=.025;this.scene.add(key);
    const fill=new THREE.DirectionalLight('#a8d0e5',.85);fill.position.set(40,35,-40);this.scene.add(fill);this.keyLight=key;this.fillLight=fill;
    this.inspectionLight=new THREE.DirectionalLight('#e2edfa',.75);this.inspectionLight.visible=false;this.scene.add(this.inspectionLight,this.inspectionLight.target);
    this.framePoses=new Map();this.half=1;this.materials=new Map();this.makeGround();this.makeStadium();this.makeGoals();this.players=[];this.makePlayers();this.makeBall();this.lines={};this.lineGroup=new THREE.Group();this.scene.add(this.lineGroup);
    this.raycaster=new THREE.Raycaster();this.groundPlane=new THREE.Plane(new V(0,1,0),0);this.event=null;this.removed=[];this.lastFocus=new V();this.cameraSnap=true;
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);this.resize();
  }
  mat(color,roughness=.85){if(!this.materials.has(color))this.materials.set(color,new THREE.MeshStandardMaterial({color,roughness}));return this.materials.get(color);}
  mesh(geo,color,pos,parent=this.scene){const m=new THREE.Mesh(geo,this.mat(color));if(pos)m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(w,h,d,color,pos,parent){return this.mesh(new THREE.BoxGeometry(w,h,d),color,pos,parent);}
  cylinder(r,h,color,pos,parent){return this.mesh(new THREE.CylinderGeometry(r,r,h,8),color,pos,parent);}
  fieldLine(points,color='#dbe6dd',opacity=1){const vertices=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(!length)continue;const nx=-dz/length*.05,nz=dx/length*.05,al=[a[0]+nx,.029,a[1]+nz],ar=[a[0]-nx,.029,a[1]-nz],bl=[b[0]+nx,.029,b[1]+nz],br=[b[0]-nx,.029,b[1]-nz];vertices.push(...al,...br,...ar,...al,...bl,...br);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,side:THREE.DoubleSide}));this.scene.add(m);return m;}
  rect(x,z,w,d){this.fieldLine([[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]]);}
  makeGround(){
    this.groundBase=this.box(155,.4,112,'#203d32',[0,-.25,0]);
    const field=new THREE.Mesh(new THREE.PlaneGeometry(105,68),createPitchMaterial('lot'));this.field=field;this.pitchMaterials=new Map([['lot',field.material]]);field.rotation.x=-Math.PI/2;field.receiveShadow=true;this.scene.add(field);this.contactGrass=createContactGrass();this.scene.add(this.contactGrass);
    this.rect(0,0,105,68);this.fieldLine([[0,-34],[0,34]]);
    const circle=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI*2;circle.push([Math.cos(a)*9.15,Math.sin(a)*9.15]);}this.fieldLine(circle);
    for(const sign of [-1,1]){this.rect(sign*44.25,0,16.5,40.32);this.rect(sign*49.75,0,5.5,18.32);const arc=[];for(let i=0;i<=40;i++){let a=-.91+i/40*1.82;arc.push([sign*(41.5-9.15*Math.cos(a)),9.15*Math.sin(a)]);}this.fieldLine(arc);for(const x of [41.5*sign,0]){const dot=new THREE.Mesh(new THREE.CircleGeometry(.14,16),new THREE.MeshBasicMaterial({color:'#d4e0b8'}));dot.rotation.x=-Math.PI/2;dot.position.set(x,.05,0);this.scene.add(dot);}}
    for(const x of [-52.5,52.5])for(const z of [-34,34]){this.cylinder(.055,1.65,'#efede0',[x,.825,z]);this.box(.6,.35,.015,'#eacb58',[x+.3,1.5,z]);}
  }
  makeStadium(){this.venues=new Map();this.setStage('lot');}
  setStage(id='lot'){
    if(!VENUE_SETTINGS[id])id='lot';if(this.stageId===id)return;this.stageId=id;
    if(!this.venues.has(id)){const venue=createVenue(id,{textTexture:(...args)=>this.textTexture(...args)});this.venues.set(id,venue);this.scene.add(venue);}
    for(const [key,venue]of this.venues)venue.visible=key===id;
    if(!this.pitchMaterials.has(id))this.pitchMaterials.set(id,createPitchMaterial(id));this.field.material=this.pitchMaterials.get(id);
    const settings=VENUE_SETTINGS[id];this.scene.background.set(settings.sky);this.scene.fog.color.set(settings.fog);this.scene.fog.near=id==='lot'||id==='school'?95:110;this.scene.fog.far=240;
    this.renderer.toneMappingExposure=settings.exposure;this.keyLight.color.set(settings.key);this.keyLight.intensity=settings.keyPower;this.fillLight.intensity=settings.fillPower;this.groundBase.material=this.mat(settings.ground);this.contactGrass.visible=settings.grass;this.cameraSnap=true;
  }
  leaveLobby(){if(!this.lobbyActive)return;this.lobbyActive=false;if(this.lobbyAvatar)this.lobbyAvatar.group.visible=false;this.inspectionLight.visible=false;this.cameraSnap=true;}
  lobby(t){
    this.lobbyActive=true;if(!this.lobbyAvatar)this.lobbyAvatar=createFootballer(this.scene,'ref',0);
    this.players.forEach(p=>{p.group.visible=false;p.ring.visible=false;p.sprite.visible=false;});this.ref.group.visible=false;this.ball.visible=false;this.ballShadow.visible=false;this.card.visible=false;this.lineGroup.visible=false;
    const avatar=this.lobbyAvatar,root=[0,25],state=sampleIdle(root,-.10,t),breathe=Math.sin(t*1.7);state.hip[0]+=.016*Math.sin(t*.7);state.lean=.018+breathe*.004;state.spineYaw=.018*Math.sin(t*.8);state.chestPitch=breathe*.006;state.headYaw=.11+.035*Math.sin(t*.52);state.headPitch=-.02;state.armSwing=.015;state.elbowFlex=[.15,.32];state.grip=.22;state.action='심판 대기';poseFootballer(avatar,state);avatar.group.visible=true;avatar.ring.visible=false;avatar.sprite.visible=false;
    this.camera.fov=32;this.camera.updateProjectionMatrix();const distance=3.85;this.camera.position.set(0,1.10,25+distance);this.camera.lookAt(0,.98,25);
    this.inspectionLight.visible=true;this.inspectionLight.intensity=.95;this.inspectionLight.position.set(2.8,3.2,29);this.inspectionLight.target.position.set(0,1,25);this.focus.set(0,.9,25);
  }
  textTexture(text,color='#fff',wide=false){const c=document.createElement('canvas');c.width=wide?1024:512;c.height=wide?64:256;const ctx=c.getContext('2d');ctx.fillStyle='#15271c';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${wide?36:55}px Arial`;ctx.fillText(text,c.width/2,c.height/2);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
  makeGoals(){for(const sign of [-1,1]){for(const z of [-3.66,3.66]){this.cylinder(.06,2.44,'#f0f2df',[sign*52.5,1.22,z]);this.fieldLine([[sign*52.5,z],[sign*55,z]],'#a8baa3');}const cross=this.cylinder(.06,7.32,'#f0f2df',[sign*52.5,2.44,0]);cross.rotation.x=Math.PI/2;const netMat=new THREE.LineBasicMaterial({color:'#a8bdad',transparent:true,opacity:.37});const pts=[];for(let i=0;i<=24;i++){const z=-3.66+i*.305;pts.push(new V(sign*55,0,z),new V(sign*55,2.44,z),new V(sign*52.5,2.44,z),new V(sign*55,2.44,z));}for(let i=0;i<=9;i++){let y=i*2.44/9;pts.push(new V(sign*55,y,-3.66),new V(sign*55,y,3.66));for(const z of [-3.66,3.66])pts.push(new V(sign*52.5,y,z),new V(sign*55,y,z));}const net=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),netMat);this.scene.add(net);}}
  makePlayer(team,number){return createFootballer(this.scene,team,number);}
  makePlayers(){const positions=[[-49,0],[-32,-23],[-31,-8],[-31,8],[-32,23],[-12,-21],[-15,0],[-12,21],[5,-18],[12,0],[5,18]];for(const team of ['home','away'])for(let i=0;i<11;i++){const p=this.makePlayer(team,i+1);p.base.set(positions[i][0]*(team==='home'?1:-1),0,positions[i][1]);p.group.position.copy(p.base);this.players.push(p);}this.ref=this.makePlayer('ref',0);this.ref.base.set(-5,0,10);}
  makeBall(){
    this.ball=createMatchBall();this.scene.add(this.ball);this.ball.position.set(0,.115,0);
    this.ballShadow=new THREE.Mesh(new THREE.CircleGeometry(.125,28),new THREE.MeshBasicMaterial({color:'#102817',transparent:true,opacity:.28,depthWrite:false}));this.ballShadow.rotation.x=-Math.PI/2;this.ballShadow.position.y=.021;this.scene.add(this.ballShadow);
    this.card=new THREE.Mesh(new THREE.BoxGeometry(.075,.115,.009),new THREE.MeshStandardMaterial({color:'#efd244',roughness:.7}));this.card.position.set(0,-.327,.026);this.ref.elbows[1].add(this.card);this.card.visible=false;
  }
  setEvent(e,removed=[]){this.leaveLobby();if(this.lineGroup)this.lineGroup.visible=true;this.event=e;this.sample=null;this.card.visible=false;this.contactGrass.position.set(e.worldX,0,e.worldZ);this.removed=removed;this.clearLines();this.zoom=false;this.orbitYaw=0;this.orbitPitch=0;this.zoomFactor=1;this.cameraSnap=true;this.players.forEach(p=>{p.ring.visible=false;p.sprite.visible=false;p.group.visible=!removed.includes(p.id);});this.ref.group.visible=true;}
  rotateBall(key,t,sampler,airSpin=10){if(this.ballTrackKey!==key){this.ballTrackKey=key;this.ballTrack=new BallRotationTrack(sampler,{airSpin});}this.ball.quaternion.fromArray(this.ballTrack.at(t));}
  animatePerson(p,x,z,t,run=1,fall=0,slide=0,dir=1){animateRunner(p,x,z,t,run,dir,fall);}
  applyPose(player,pose){this.framePoses??=new Map();this.framePoses.set(player.id,pose);poseFootballer(player,pose);}
  roster(){return this.players.filter(p=>!this.removed.includes(p.id)).map(p=>({id:p.id,team:p.team,number:p.number,base:{x:p.base.x,z:p.base.z}}));}
  useHalf(half){if(this.half===half)return;this.players.forEach(p=>p.base.x*=-1);this.half=half;}
  capture(team=this.possession||'home'){return {ball:this.ball.position.toArray(),actors:new Map([...this.framePoses].filter(([id])=>!this.removed.includes(id))),team};}
  incidentFrame(e,t){
    const sample=sampleIncident(e,t),actors=new Map(),active=this.players.filter(p=>!this.removed.includes(p.id));
    const attacker=active.find(p=>p.team===e.attack&&p.number===9)||active.find(p=>p.team===e.attack&&p.number!==1),defender=(e.type==='dive'?active.find(p=>p.team!==e.attack&&p.number===(e.jersey||4)):active.find(p=>p.id===e.offender))||active.find(p=>p.team!==e.attack&&p.number!==1);
    for(const p of active)actors.set(p.id,p===attacker?sample.attacker:p===defender?sample.defender:sampleSupportingPlayer(e,p,t,sample.ball));
    let owner=attacker;
    if(sample.passer){const passer=active.find(p=>p.team===e.attack&&p.number===(sample.passerNumber||10)&&p!==attacker)||active.find(p=>p.team===e.attack&&p!==attacker);actors.set(passer.id,sample.passer);owner=passer;}
    if(sample.runner){const runner=active.find(p=>p.team===e.attack&&p.number===10&&p!==attacker);if(runner)actors.set(runner.id,sample.runner);}
    actors.set(this.ref.id,sample.referee);return {ball:sample.ball,actors,team:e.attack,owner:owner.id,sample,attacker,defender};
  }
  pose(t,stage='review',ambient=0){
    this.ref.group.visible=true;this.ball.visible=true;this.ballShadow.visible=true;this.card.visible=false;const e=this.event;if(!e){this.ambient(ambient);return;}
    const frame=this.incidentFrame(e,t);this.attacker=frame.attacker;this.defender=frame.defender;this.sample=frame.sample;
    for(const p of this.players){p.group.visible=!this.removed.includes(p.id);p.ring.visible=false;p.sprite.visible=false;if(p.group.visible)this.applyPose(p,frame.actors.get(p.id));}
    this.applyPose(this.ref,frame.sample.referee);this.ball.position.set(...frame.ball);this.rotateBall(e,t,tt=>sampleIncident(e,tt).ball,['offside','onside'].includes(e.type)?-11:10);
    if(stage==='review'||stage==='result'){this.attacker.ring.visible=true;this.attacker.sprite.visible=!this.zoom;this.defender.ring.visible=true;this.defender.sprite.visible=!this.zoom;}
    if(stage==='live')this.focus.set(this.ball.position.x,.6,this.ball.position.z);else this.focus.set(e.worldX,.78,e.worldZ);this.updateCamera();
  }
  flow(sequence,t){
    this.leaveLobby();if(this.lineGroup)this.lineGroup.visible=true;const play=sequence.sample(t);this.inspectionLight.visible=false;this.sample=null;this.card.visible=false;this.ref.group.visible=true;this.ball.visible=true;this.ballShadow.visible=true;this.possession=play.team;
    for(const p of this.players){p.group.visible=!this.removed.includes(p.id);p.ring.visible=false;p.sprite.visible=false;if(p.group.visible)this.applyPose(p,play.actors.get(p.id));}
    this.applyPose(this.ref,play.actors.get(this.ref.id));this.ball.position.set(...play.ball);this.rotateBall(sequence,t,tt=>sequence.sample(tt,{ballOnly:true}).ball,-10);this.focus.set(this.ball.position.x,.55,this.ball.position.z);this.updateCamera();return play;
  }
  ambient(t){
    this.leaveLobby();if(this.lineGroup)this.lineGroup.visible=true;this.inspectionLight.visible=false;
    this.card.visible=false;this.ref.group.visible=true;this.ball.visible=true;this.ballShadow.visible=true;this.sample=null;const team=this.possession||'home',d=team==='home'?1:-1,play=sampleOpenPlay(t,team),ballCache=new Map([[t,play.ball]]),ballAt=tt=>{if(!ballCache.has(tt))ballCache.set(tt,sampleOpenPlay(tt,team,{ballOnly:true}).ball);return ballCache.get(tt);};
    this.players.forEach(p=>{p.group.visible=!this.removed.includes(p.id);p.ring.visible=false;p.sprite.visible=false;this.applyPose(p,p.team===team&&play.actors.has(p.number)?play.actors.get(p.number):sampleFormationPlayer(p,t,team,ballAt,this.half));});
    this.ball.position.set(...play.ball);this.rotateBall('ambient-'+team,t,ballAt,-10);const refPath=tt=>{const a=ballAt(tt),b=ballAt(tt-.30),c=ballAt(tt-.60);return [(a[0]*.2+b[0]*.3+c[0]*.5)*.38-5*d,(a[2]*.2+b[2]*.3+c[2]*.5)*.30+7];};const ref=sampleLocomotion(refPath,t,{pace:3});ref.headYaw=THREE.MathUtils.clamp(yawFor(play.ball[0]-ref.hip[0],play.ball[2]-ref.hip[2])-ref.yaw,-.6,.6);this.applyPose(this.ref,ref);this.focus.set(this.ball.position.x,.4,this.ball.position.z);this.updateCamera();
  }
  resume(t,record,start){
    this.leaveLobby();if(this.lineGroup)this.lineGroup.visible=true;this.inspectionLight.visible=false;this.sample=null;
    const flight=sampleRestartBall(t,record,start),team=flight.team,d=start.dir,kickAt=flight.kickAt,ballCache=new Map([[t,flight.ball]]),ballAt=tt=>{if(!ballCache.has(tt))ballCache.set(tt,sampleRestartBall(tt,record,start,{ballOnly:true}).ball);return ballCache.get(tt);};
    if(this.restartRecord!==record){
      this.restartRecord=record;this.restartRoles={};
      for(const club of ['home','away']){const active=this.players.filter(p=>p.team===club&&p.number!==1&&!this.removed.includes(p.id)),roles=new Map(),used=new Set(),preferred=[10,7,11,9,4];for(const number of preferred){const p=active.find(p=>p.number===number&&!used.has(p.id))||active.find(p=>!preferred.includes(p.number)&&!used.has(p.id))||active.find(p=>!used.has(p.id));if(p){roles.set(number,p);used.add(p.id);}}this.restartRoles[club]=roles;}
    }
    const assigned=new Map();
    for(const [club,actors] of [[team,flight.actors],[flight.otherTeam,flight.otherActors]])if(club&&actors)for(const [number,state] of actors){const p=this.restartRoles[club].get(number);if(p)assigned.set(p.id,state);}
    this.players.forEach(p=>{p.group.visible=!this.removed.includes(p.id);p.ring.visible=false;p.sprite.visible=false;let state=assigned.get(p.id);if(!state){state=sampleFormationPlayer(p,t,record.decision.beneficiary,ballAt,this.half);if(!record.goal&&record.style==='shot'&&t>kickAt+flight.duration)state=blendPose(state,sampleFormationPlayer(p,t,record.decision.beneficiary==='home'?'away':'home',ballAt,this.half),ease(kickAt+flight.duration+.8,kickAt+flight.duration+2.5,t));else if(record.goal&&flight.team!==record.decision.beneficiary)state=sampleFormationPlayer(p,t,team,ballAt,this.half);}this.applyPose(p,state);});
    // A save is live play: the keeper recovers while a defender gathers the
    // rebound and distributes it. No freeze, second whistle or kickoff here.
    if(flight.saveAt!==undefined){
      const keeper=this.players.find(p=>p.team!==record.decision.beneficiary&&p.number===1&&!this.removed.includes(p.id));
      if(keeper){const q=flight.q,dive=smooth(.45,.94,q),side=record.goal?1:-1,root=[50.1*d,side*dive*1.7],state=sampleIdle(root,-d*Math.PI/2,t);state.hip[1]=.86-dive*.53+Math.sin(dive*Math.PI)*.16;state.roll=side*dive*1.25;state.feet=[localPoint(root,-d*Math.PI/2,.18,.12+dive*.10,.11),localPoint(root,-d*Math.PI/2,-.12,.12+dive*.15,-.11)];state.armPose='save';state.armRotations=undefined;state.elbowAngles=undefined;const ready=sampleIdle([49.2*d,side*1.7],-d*Math.PI/2,t);ready.gesture='ready';ready.gestureWeight=1;this.applyPose(keeper,blendPose(state,ready,ease(flight.saveAt+.65,flight.saveAt+2.1,t)));}
    }
    this.card.visible=record.decision.card!=='none'&&t<1.55;this.card.material.color.set(record.decision.card==='red'?'#f05045':'#efd244');
    const refBall=ballAt(t),refPath=tt=>{const b=ballAt(tt);return [start.x-4*d+(b[0]-start.x)*.22,start.z+3.5+(b[2]-start.z)*.22];},ref=sampleLocomotion(refPath,t,{pace:2}),whistling=!['play','advantage'].includes(record.decision.restart)&&t>kickAt-.1&&t<kickAt+.25,indirect=['offside','indirect'].includes(record.decision.restart)&&t<flight.initialArrival;ref.headYaw=THREE.MathUtils.clamp(yawFor(refBall[0]-ref.hip[0],refBall[2]-ref.hip[2])-ref.yaw,-.6,.6);ref.gesture=this.card.visible||whistling||indirect?undefined:'observe';ref.armPose=this.card.visible||indirect?'card':whistling?'whistle':undefined;if(ref.armPose){ref.armRotations=undefined;ref.elbowAngles=undefined;}this.applyPose(this.ref,ref);
    this.ball.position.set(...flight.ball);this.focus.copy(this.ball.position);this.focus.y=.55;this.rotateBall(record,t,ballAt,9);this.updateCamera();return flight;
  }
  lab(t,type='run',variant='careless'){
    this.leaveLobby();if(this.lineGroup)this.lineGroup.visible=true;this.inspectionLight.visible=true;
    this.sample=null;this.card.visible=false;this.players.forEach(p=>{p.group.visible=false;p.ring.visible=false;p.sprite.visible=false;});this.ref.group.visible=false;const a=this.players.find(p=>p.id==='home-9'),b=this.players.find(p=>p.id==='away-4');a.group.visible=true;this.ball.visible=['dribble','pass','lob','shot','tackle','reaction'].includes(type);this.ballShadow.visible=this.ball.visible;
    const motion=sampleMotionStudio(t,type,variant),state=motion.pose;this.ball.position.set(...motion.ball);if(motion.receiver){b.group.visible=true;this.applyPose(b,motion.receiver);}
    this.applyPose(a,state);const passFocus=motion.receiver&&type!=='reaction'?smooth(1.95,2.45,t):0,baseY=['tackle','reaction'].includes(type)?.28:.52;this.focus.set(THREE.MathUtils.lerp(state.hip[0],this.ball.position.x,passFocus),THREE.MathUtils.lerp(baseY,Math.max(baseY,this.ball.position.y),passFocus),THREE.MathUtils.lerp(state.hip[2],this.ball.position.z,passFocus));this.contactGrass.position.set(state.hip[0],0,state.hip[2]);this.camera.fov=42;this.camera.updateProjectionMatrix();
    const views={broadcast:type==='tackle'?[-.8,1.05,3.6]:[2.6,1.0,3.5],side:[.05,.9,4.2],goal:[4.3,.95,.15],top:[.02,6,.02],referee:[-3,1.1,3.1]},offset=new V(...(views[this.cameraMode]||views.broadcast)),r=Math.hypot(offset.x,offset.z),angle=Math.atan2(offset.x,offset.z)+this.orbitYaw;offset.x=Math.sin(angle)*r;offset.z=Math.cos(angle)*r;offset.y=Math.max(.25,offset.y+this.orbitPitch);offset.multiplyScalar(this.zoomFactor*(type==='model'?.64:1));this.camera.position.copy(this.focus.clone().add(offset));this.camera.lookAt(this.focus);this.inspectionLight.position.copy(this.camera.position);this.inspectionLight.target.position.copy(this.focus);this.rotateBall('lab-'+type+'-'+variant,t,tt=>sampleMotionStudio(tt,type,variant).ball,type==='lob'?-12:10);return motion.action;
  }
  setCamera(mode){this.cameraMode=mode;this.orbitYaw=0;this.orbitPitch=0;this.zoomFactor=1;this.cameraSnap=true;}
  updateCamera(){
    const f=this.focus.clone(),e=this.event,d=e?.dir||1;let offset;
    if(this.zoom&&e){const point=this.sample?.contact||contactPoint(e);f.set(...point);offset=new V(-1.25*d,1.0,2.55);this.camera.fov=40;}
    else{this.camera.fov=48;switch(this.cameraMode){case'side':f.y=.73;offset=new V(-1.7*d,1.9,6.4);break;case'goal':f.y=.72;offset=new V(7*d,1.6,1.5);break;case'top':f.y=0;offset=new V(0,48,.02);break;case'referee':f.y=.75;offset=new V(-4.3*d,1.15,3.4);break;default:offset=e&&this.sample?new V(-4*d,7.3,12.5):new V(-11,18,28);}}
    this.camera.updateProjectionMatrix();offset.multiplyScalar(this.zoomFactor);const r=Math.sqrt(offset.x*offset.x+offset.z*offset.z),a=Math.atan2(offset.x,offset.z)+this.orbitYaw;offset.x=Math.sin(a)*r;offset.z=Math.cos(a)*r;offset.y=Math.max(.25,offset.y+this.orbitPitch);
    this.camera.position.lerp(f.clone().add(offset),this.cameraSnap?1:.16);this.camera.lookAt(f);this.cameraSnap=false;this.inspectionLight.visible=!!this.zoom;this.inspectionLight.position.copy(this.camera.position);this.inspectionLight.target.position.copy(f);
  }
  rotate(dx,dy){this.orbitYaw-=dx*.008;this.orbitPitch=THREE.MathUtils.clamp(this.orbitPitch+dy*.1,-16,30);}
  groundAt(clientX,clientY){const r=this.container.getBoundingClientRect();this.raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),this.camera);const pt=new V();const hit=this.raycaster.ray.intersectPlane(this.groundPlane,pt);if(hit&&Math.abs(pt.x)<=52.5&&Math.abs(pt.z)<=34)return pt;return null;}
  drawLine(type,x){if(this.lines[type]){this.lineGroup.remove(this.lines[type].group);this.lines[type].group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}const group=new THREE.Group();const color=type==='defender'?'#55bcff':'#ff7960';const lineGeo=new THREE.BufferGeometry().setFromPoints([new V(x,.08,-34),new V(x,.08,34)]);group.add(new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color})));const wall=new THREE.Mesh(new THREE.PlaneGeometry(68,2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false}));wall.position.set(x,1,0);wall.rotation.y=Math.PI/2;group.add(wall);for(const z of [-34,34]){const post=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V(x,0,z),new V(x,2,z)]),new THREE.LineBasicMaterial({color}));group.add(post);}this.lineGroup.add(group);this.lines[type]={x,group};}
  clearLines(){if(this.lineGroup)for(const entry of Object.values(this.lines)){this.lineGroup.remove(entry.group);entry.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}this.lines={};}
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
  render(){this.ballShadow.position.x=this.ball.position.x;this.ballShadow.position.z=this.ball.position.z;this.ballShadow.scale.setScalar(1+Math.max(0,this.ball.position.y-.115)*.18);this.ballShadow.material.opacity=.28/(1+Math.max(0,this.ball.position.y-.115)*.65);this.renderer.render(this.scene,this.camera);}
}
