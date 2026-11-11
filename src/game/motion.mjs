import {sampleAuthoredGait,sampleAuthoredSwing} from './locomotion-library.mjs';
import {sampleKickReference} from './kick-reference.mjs';
// Pure, time-addressable football motion. The same poses drive live play and VAR.
export const SHOULDER_LOCAL_Y=.105;
export const BALL_RADIUS=.115,BOOT_TOE=.245,GROUND_FOOT=.094;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,q)=>a+(b-a)*q;
export const smooth=(a,b,v)=>{const q=clamp((v-a)/(b-a));return q*q*(3-2*q);};
export const ease=(a,b,v)=>{const q=clamp((v-a)/(b-a));return q*q*q*(10+q*(-15+6*q));};
export const softMin=(a,b,r=.014)=>(a+b-Math.sqrt((a-b)**2+r*r))*.5;
export const recoil=(t,amplitude=1,decay=.20,period=.32)=>t<=0?0:amplitude*(1-Math.exp(-t/.028))**3*Math.exp(-t/decay)*Math.sin(t*Math.PI*2/period);
export const vecLerp=(a,b,q)=>a.map((v,i)=>lerp(v,b[i],q));
const fract=v=>v-Math.floor(v);
const hermite=(a,b,da,db,q)=>{const gap=b-a,c3=10*gap-6*da-4*db,c4=-15*gap+8*da+7*db,c5=6*gap-3*da-3*db;return a+da*q+c3*q**3+c4*q**4+c5*q**5;};
export const yawFor=(dx,dz)=>Math.atan2(dx,dz);
export function localPoint(root,yaw,forward,height,lateral=0){return [root[0]+Math.sin(yaw)*forward-Math.cos(yaw)*lateral,height,root[1]+Math.cos(yaw)*forward+Math.sin(yaw)*lateral];}
export const linearPath=(x,z,vx,vz)=>t=>[x+vx*t,z+vz*t];
const add3=(a,b)=>a.map((v,i)=>v+b[i]);
function rotate3(v,[x=0,y=0,z=0]){const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z),a=v[0]*cz-v[1]*sz,b=v[0]*sz+v[1]*cz,c=a*cy+v[2]*sy,d=-a*sy+v[2]*cy;return [c,b*cx-d*sx,b*sx+d*cx];}
// Resolve complete arm channels before blending. Semantic pose labels must not
// switch the rendered joints halfway through a transition.
export function resolveArms(s){
 const swing=Math.sin(s.armPhase||0)*(s.armSwing??.38),arms=s.armRotations?s.armRotations.map(a=>a.slice()):[[swing,0,.09],[-swing,0,-.09]],elbows=s.elbowAngles?s.elbowAngles.slice():[0,1].map(i=>-(s.elbowFlex?.[i]??s.elbow??.35));
 const overlay=(poses,angles,w)=>{for(let i=0;i<2;i++){arms[i]=vecLerp(arms[i],poses[i],w);elbows[i]=lerp(elbows[i],angles[i],w);}};
 const preset={kick:[[[.25,0,-.60],[-.36,0,.42]],[-.5,-.8]],brace:[[[-1.25,0,.5],[-1.35,0,-.4]],[-.15,-.15]],slide:[[[-.65,0,.55],[.5,0,-.48]],[-1.1,-1.1]],card:[[[-.25,0,.22],[-2.9,0,-.15]],[-.35,-.05]],save:[[[-1.8,0,.65],[-1.8,0,-.65]],[-.12,-.12]],whistle:[[[-1.85,0,.25],[-1.45,0,-.2]],[-.35,-1.3]]};
 if(!s.armRotations){if(preset[s.armPose])overlay(...preset[s.armPose],1);if(s.kickWeight)overlay(...preset.kick,s.kickWeight);}
 const gestures={appeal:[[-.5,0,.68],[-.68,0,-.55]],acknowledge:[[.25,0,.45],[-1.25,0,-.26]],whistle:[[-.25,0,.18],[-1.45,0,-.2]],observe:[[-.18,0,.12],[-.20,0,-.12]],ready:[[-.35,0,.20],[-.35,0,-.20]]};
 if(s.gesture)overlay(gestures[s.gesture]||gestures.observe,[-.85,s.gesture==='whistle'?-1.3:-.85],s.gestureWeight??1);
 return {arms,elbows};
}
function handFK(s,i,elbow=false){const r=resolveArms(s),fore=add3([0,-.29,0],elbow?[0,0,0]:rotate3([0,-.275,.01],[r.elbows[i],0,0])),chest=add3([(i?1:-1)*.226,SHOULDER_LOCAL_Y,0],rotate3(fore,r.arms[i])),spine=add3([0,.23,0],rotate3(chest,[s.chestPitch||0,s.chestYaw??-(s.twist||0)*.35,s.chestRoll||0])),body=add3([0,.18,0],rotate3(spine,[s.spinePitch||0,s.spineYaw??s.twist??0,s.spineRoll||0])),local=rotate3(body,[s.lean||0,s.pelvisYaw||0,s.roll||0]),world=rotate3(local,[0,s.yaw??s.heading*Math.PI/2,0]);return add3(s.hip,world);}
const groundHands=s=>s.handGroundWeight||[0,1].map(i=>s.handGround?.[i]?1:s.armPose==='slide'&&i===1?1:0);
export function blendPose(a,b,q){
 const dy=Math.atan2(Math.sin((b.yaw??b.heading*Math.PI/2)-(a.yaw??a.heading*Math.PI/2)),Math.cos((b.yaw??b.heading*Math.PI/2)-(a.yaw??a.heading*Math.PI/2)));
 const result={...(q<.5?a:b),hip:vecLerp(a.hip,b.hip,q),feet:a.feet.map((v,i)=>vecLerp(v,b.feet[i],q)),yaw:(a.yaw??a.heading*Math.PI/2)+dy*q,lean:lerp(a.lean||0,b.lean||0,q),roll:lerp(a.roll||0,b.roll||0,q),twist:lerp(a.twist||0,b.twist||0,q),armPhase:lerp(a.armPhase||0,b.armPhase||0,q),armSwing:lerp(a.armSwing??.35,b.armSwing??.35,q),footPitch:[0,1].map(i=>lerp(a.footPitch?.[i]||0,b.footPitch?.[i]||0,q))};
 for(const field of ['pelvisYaw','spineYaw','chestYaw','spinePitch','chestPitch','spineRoll','chestRoll','headPitch','headYaw','headRoll','handWeight','kickWeight','gestureWeight','pain','grip'])result[field]=lerp(a[field]||0,b[field]||0,q);
 result.footYaw=[0,1].map(i=>lerp(a.footYaw?.[i]||0,b.footYaw?.[i]||0,q));result.footRoll=[0,1].map(i=>lerp(a.footRoll?.[i]||0,b.footRoll?.[i]||0,q));
 if(a.kneeHints||b.kneeHints)result.kneeHints=[0,1].map(i=>vecLerp(a.kneeHints?.[i]||localPoint([a.hip[0],a.hip[2]],a.yaw??a.heading*Math.PI/2,.75,a.hip[1],i===0?.1:-.1),b.kneeHints?.[i]||localPoint([b.hip[0],b.hip[2]],b.yaw??b.heading*Math.PI/2,.75,b.hip[1],i===0?.1:-.1),q));
 if(a.handTargets||b.handTargets){result.handTargets=[0,1].map(i=>vecLerp(a.handTargets?.[i]||handFK(a,i),b.handTargets?.[i]||handFK(b,i),q));result.elbowHints=[0,1].map(i=>vecLerp(a.elbowHints?.[i]||handFK(a,i,true),b.elbowHints?.[i]||handFK(b,i,true),q));result.handWeight=lerp(a.handWeight??(a.handTargets?1:0),b.handWeight??(b.handTargets?1:0),q);}
 const aa=resolveArms(a),bb=resolveArms(b);result.armRotations=aa.arms.map((arm,i)=>vecLerp(arm,bb.arms[i],q));result.elbowAngles=aa.elbows.map((e,i)=>lerp(e,bb.elbows[i],q));result.handGroundWeight=vecLerp(groundHands(a),groundHands(b),q);
 // The gesture is now baked into these arm channels; later callers may add a
 // new whistle or appeal without applying the previous gesture a second time.
 result.gesture=undefined;result.gestureWeight=0;
 result.elbowFlex=[0,1].map(i=>lerp(a.elbowFlex?.[i]??a.elbow??.35,b.elbowFlex?.[i]??b.elbow??.35,q));
 const grip=s=>s.grip??(s.armPose==='slide'?.10:s.speed>6?.65:s.speed>2?.58:.17);result.grip=lerp(grip(a),grip(b),q);
 result.wristPitch=[0,1].map(i=>lerp(a.wristPitch?.[i]??-.08,b.wristPitch?.[i]??-.08,q));result.wristRoll=[0,1].map(i=>lerp(a.wristRoll?.[i]||0,b.wristRoll?.[i]||0,q));
 return result;
}
export function sampleIdle(root,yaw,t=0){
 const clip=sampleAuthoredGait('idle',t/2.5),arms=clip.arms.map(a=>[a[0]*.65,a[1]*.6,a[2]*.65]);
 return {hip:[root[0],.967+Math.sin(t*2)*.004,root[1]],yaw,feet:[localPoint(root,yaw,.06,GROUND_FOOT,.105),localPoint(root,yaw,-.02,GROUND_FOOT,-.105)],lean:.015,armPhase:t*.9,armSwing:.04,elbow:.2,footPitch:[0,0],footYaw:[0,0],armRotations:arms,elbowAngles:clip.elbows.map(x=>x*.65),time:t,action:'대기'};
}
export function sampleLocomotion(path,t,{pace=null,phase=0}={}){
 const root=path(t),before=path(t-.01),after=path(t+.01),vx=(after[0]-before[0])/.02,vz=(after[1]-before[1])/.02,speed=Math.hypot(vx,vz);
 // A stopped route keeps a continuous facing supplied by the deterministic
 // route planner. Fade tiny steps into this planted stance instead of jumping
 // between two unrelated sets of foot targets at an arbitrary speed threshold.
 const idleYawAt=at=>{if(typeof path.idleYaw==='function')return path.idleYaw(at);const a=path(at-.35),b=path(at+.35),dx=b[0]-a[0],dz=b[1]-a[1];return Math.hypot(dx,dz)>.015?yawFor(dx,dz):0;};
 const stableYaw=(dx,dz,at,delta=.02)=>{const v=Math.hypot(dx,dz)/delta,raw=yawFor(dx,dz);if(v>=.35)return raw;const idle=idleYawAt(at),q=ease(.02,.35,v);return idle+Math.atan2(Math.sin(raw-idle),Math.cos(raw-idle))*q;};
 const yaw=stableYaw(vx,vz,t,1),gaitWeight=ease(.02,.35,speed),idle=gaitWeight<1?sampleIdle(root,idleYawAt(t),t):null;
 // Cadence follows the actual root velocity. Running has a short support phase
 // and an aerial phase; the recovering heel folds before the knee drives ahead.
 const cadence=Math.max(.05,pace??speed),running=cadence>2.05,sprint=clamp((cadence-2.05)/5),effort=clamp(speed/cadence,.2,1),period=running?lerp(.73,.55,sprint):lerp(1.10,.84,clamp((cadence-.7)/1.35)),kind=running?(cadence>=6?'sprint':'jog'):'walk',authored=sampleAuthoredGait(kind,t/period+phase),stance=running?lerp(.28,.21,sprint):.62;
 if(gaitWeight===0)return {...idle,speed,acceleration:0,turnRate:0,period,stance,phases:[fract(t/period+phase),fract(t/period+phase+.5)],planted:[true,true]};
 const footPitch=[],footYaw=[],phases=[],planted=[],pivot=(anchor,heading,pitch)=>{const p=localPoint([anchor[0],anchor[2]],heading,.18*(1-Math.cos(pitch))+.06*Math.sin(pitch),anchor[1]+.18*Math.sin(pitch)-.06*(1-Math.cos(pitch)));return p;};
 const feet=[0,1].map(i=>{
   const clock=t/period+phase+i*.5,cycle=Math.floor(clock),p=fract(clock),touchTime=(cycle-phase-i*.5)*period;
   const touchdown=path(touchTime),touchNext=path(touchTime+period),rootPrev=path(touchTime-.01),rootNext=path(touchTime+.01),touchYaw=stableYaw(rootNext[0]-rootPrev[0],rootNext[1]-rootPrev[1],touchTime);
   const nextPrev=path(touchTime+period-.01),nextNext=path(touchTime+period+.01),nextYaw=stableYaw(nextNext[0]-nextPrev[0],nextNext[1]-nextPrev[1],touchTime+period);
   const stride=Math.hypot(rootNext[0]-rootPrev[0],rootNext[1]-rootPrev[1])/.02*period,nextStride=Math.hypot(nextNext[0]-nextPrev[0],nextNext[1]-nextPrev[1])/.02*period;
   const lateral=i===0?.105:-.105,anchor=localPoint(touchdown,touchYaw,stride*stance*.5,GROUND_FOOT,lateral),nextAnchor=localPoint(touchNext,nextYaw,nextStride*stance*.5,GROUND_FOOT,lateral);
   phases.push(p);planted.push(p<=stance);
   if(p<=stance){const toeOff=running?ease(stance*.62,stance,p):0,pitch=toeOff*.42;footPitch.push(pitch);footYaw.push(Math.atan2(Math.sin(touchYaw-yaw),Math.cos(touchYaw-yaw)));return pivot(anchor,touchYaw,pitch);}
   const q=(p-stance)/(1-stance);
   const swingYaw=touchYaw+Math.atan2(Math.sin(nextYaw-touchYaw),Math.cos(nextYaw-touchYaw))*smooth(0,1,q);footYaw.push(Math.atan2(Math.sin(swingYaw-yaw),Math.cos(swingYaw-yaw)));
   if(!running){const foot=vecLerp(anchor,nextAnchor,smooth(0,1,q));foot[1]+=Math.sin(q*Math.PI)**2*.14;footPitch.push(-(Math.sin(q*Math.PI)**2)*.28);return foot;}
   const authoredSwing=sampleAuthoredSwing(kind,i,q,stance),raised=pivot(anchor,touchYaw,.42),startHeight=raised[1],forwardStart=-(stride*stance*.5)+.18*(1-Math.cos(.42))+.06*Math.sin(.42),forwardEnd=nextStride*stance*.5,velocity=-speed*period*(1-stance),lift=lerp(.37,.49,sprint);
   let forward,height;
   if(q<.32){const s=q/.32;forward=hermite(forwardStart,-.30,velocity*.32,1.5*.32,s);height=hermite(startHeight,lift,0,0,s);}
   else if(q<.68){const s=(q-.32)/.36;forward=hermite(-.30,.20,1.5*.36,.2*.36,s);height=hermite(lift,.29,0,-.65*.36,s);}
   else{const s=(q-.68)/.32;forward=hermite(.20,forwardEnd,.2*.32,velocity*.32,s);height=hermite(.29,GROUND_FOOT,-.65*.32,0,s);}
   const authoredWeight=Math.sin(q*Math.PI)**2*.12;footPitch.push(.42*(1-ease(0,.18,q))+Math.sin(q*Math.PI)**2*(.95-1.10*ease(.35,.65,q))+authoredSwing.pitch*authoredWeight);
   // Curved routes must also leave the exact planted anchor, rather than a
   // new point computed from the athlete's changed heading at toe-off.
   height=lerp(GROUND_FOOT,height+authoredSwing.lift*Math.sin(q*Math.PI)**2*.08,effort);const liftTime=touchTime+period*stance,liftRoot=path(liftTime),liftPrev=path(liftTime-.01),liftNext=path(liftTime+.01),liftYaw=stableYaw(liftNext[0]-liftPrev[0],liftNext[1]-liftPrev[1],liftTime),rawStart=localPoint(liftRoot,liftYaw,forwardStart,lerp(GROUND_FOOT,startHeight,effort),lateral),raw=localPoint(root,yaw,forward,height,lateral),correction=1-ease(0,.32,q);
   return raw.map((v,j)=>v+(raised[j]-rawStart[j])*correction);
 });
 const clock=t/period+phase;
 // Compression and flight share the same height and velocity at their joins.
 const theta=clock*Math.PI*2,load=Math.exp(5*(Math.cos(theta*2-.55)-1));
 let hipHeight=(running?.938:.954)+authored.hip*(running?.26:.35);
 const past=path(t-.12),future=path(t+.12),pastVX=(root[0]-past[0])/.12,pastVZ=(root[1]-past[1])/.12,futureVX=(future[0]-root[0])/.12,futureVZ=(future[1]-root[1])/.12,acceleration=(Math.hypot(futureVX,futureVZ)-Math.hypot(pastVX,pastVZ))/.12,turnRate=Math.atan2(Math.sin(yawFor(futureVX,futureVZ)-yawFor(pastVX,pastVZ)),Math.cos(yawFor(futureVX,futureVZ)-yawFor(pastVX,pastVZ)))/.12,driveLean=clamp(acceleration*.012,-.065,.075),turnLean=clamp(-turnRate*speed*.016,-.10,.10);
 const amplitude=running?.10:.12,pelvisYaw=-authored.body[1]*(running?4.8:2.4),shoulderYaw=pelvisYaw+authored.spine[1]+authored.chest[1],lean=(running?.243+sprint*.083:.035)+authored.hip*.14+driveLean,roll=authored.body[2]*.65+turnLean,sway=authored.sway*.55,bodyRoot=localPoint(root,yaw,0,0,-sway);
 for(let i=0;i<2;i++){const hip=localPoint([bodyRoot[0],bodyRoot[2]],yaw,0,0,i===0?.104:-.104),dx=feet[i][0]-hip[0],dz=feet[i][2]-hip[2],reach=running?.850:.862;hipHeight=softMin(hipHeight,feet[i][1]+.026+Math.sqrt(Math.max(.04,reach*reach-dx*dx-dz*dz)),running?.052:.014);}
 const spinePitch=authored.spine[0]*amplitude,chestPitch=(authored.chest[0]-(running?.52:.14))*amplitude,armRotations=authored.arms.map(a=>[a[0]*(running?1.3:1)+(running?.64:.16),a[1]*.72,a[2]*.60]);
 const gait={hip:[bodyRoot[0],hipHeight,bodyRoot[2]],yaw,feet,footPitch,footYaw,lean,roll,pelvisYaw,spineYaw:authored.spine[1]*.32,chestYaw:authored.chest[1]*.40,spinePitch,chestPitch,spineRoll:authored.spine[2]*.28-turnLean*.3,chestRoll:authored.chest[2]*.28-turnLean*.2,headPitch:clamp(authored.head[0]*.5-lean*.45,-.4,.25),headYaw:authored.head[1]*.30+clamp(turnRate*.12,-.24,.24),headRoll:-roll*.3,armRotations,elbowAngles:authored.elbows,animationSource:authored.source,armPhase:theta-Math.PI/2-.12,armSwing:running?(.66+sprint*.12)*(.6+.4*effort):.34,elbow:running?1.38:.45,elbowFlex:[(running?1.38:.45)+Math.cos(theta-.38)*.18,(running?1.38:.45)-Math.cos(theta-.38)*.18],wristPitch:[-.08+.065*Math.sin(theta-.58),-.08-.065*Math.sin(theta-.58)],speed,acceleration,turnRate,load,phases,planted,period,stance,time:t,action:speed>6?'스프린트':speed>2.05?'달리기':'걷기'};
 if(gaitWeight>=1)return gait;return {...blendPose(idle,gait,gaitWeight),speed,acceleration,turnRate,period,stance,phases,planted};
}

// Authored slide: the outer thigh supports the body, one leg reaches and the
// other folds beneath the pelvis. Contact targets still use the actual boot tip.
export function sampleSlideTackle(contact,yaw,t,contactTime,{pitch=0,reaction='careless'}={}){
 const u=t-contactTime,height=contact[1],toeFore=-BOOT_TOE*Math.cos(pitch),ankleY=height+BOOT_TOE*Math.sin(pitch),finalRoll=-1.15,finalLean=-.12,hipY=height>.4?.26:.24;
 // Anatomical hip offset after body roll, then pitch (Euler XYZ).
 const hipLocalX=-.104*Math.cos(finalRoll)+.03*Math.sin(finalRoll),hipLocalY=-.104*Math.sin(finalRoll)-.03*Math.cos(finalRoll),hipLocalFore=hipLocalY*Math.sin(finalLean),hipLocalH=hipLocalY*Math.cos(finalLean),lateral=-.24;
 const dy=ankleY-(hipY+hipLocalH),dl=0-(lateral-hipLocalX),reach=Math.sqrt(.865*.865-dy*dy-dl*dl),finalFore=toeFore-reach-hipLocalFore;
 const path=tt=>{const v=tt-contactTime,s=finalFore+(v<0?v*4.4:.56*(1-Math.exp(-v/(.56/4.4)))),l=lateral+.90*(1-smooth(-.8,-.04,v)),p=localPoint([contact[0],contact[2]],yaw,s,0,l);return [p[0],p[2]];};
 const run=sampleLocomotion(path,t,{pace:4.4,phase:.08}),root=path(t),lower=smooth(-.55,-.12,u),extend=smooth(-.48,-.015,u);
 const hipHeight=lerp(run.hip[1],hipY,lower),root2=[root[0],root[1]],leading=localPoint(root2,yaw,lerp(.09,toeFore-finalFore,extend),lerp(GROUND_FOOT,ankleY,smooth(-.25,0,u)),lerp(.105,-lateral,extend)),trailing=localPoint(root2,yaw,-.24,.115,-.20);
 const pose={hip:[root[0],hipHeight,root[1]],yaw,feet:[leading,trailing],footPitch:[pitch*smooth(-.25,0,u),-.18*lower],lean:lerp(run.lean,finalLean,lower),roll:finalRoll*lower,spineRoll:.12*lower,chestRoll:.12*lower,spinePitch:.08*lower,armPose:'slide',slide:lower,armPhase:run.armPhase,armSwing:.3,elbow:1.1,kneeHints:[localPoint(root2,yaw,.42,hipHeight+.21,.12),localPoint(root2,yaw,.29,.145,-.26)],handTargets:[localPoint(root2,yaw,.12,hipHeight+.77,.02),localPoint(root2,yaw,-.38,.085,-.52)],elbowHints:[localPoint(root2,yaw,.02,hipHeight+.60,.16),localPoint(root2,yaw,-.48,hipHeight+.24,-.68)],handWeight:smooth(.35,1,lower),headPitch:.10,headYaw:.23,headRoll:.14,action:u<-.55?'태클 접근':u<-.12?'골반 내리기':u<0?'다리 뻗기':u<.15?'태클 접촉':'슬라이드 감속'};
 pose.spinePitch+=recoil(u-.025,.085,.22,.36);pose.chestPitch=recoil(u-.060,-.07,.24,.36);pose.headPitch+=recoil(u-.09,.07,.28,.40);pose.roll+=recoil(u-.015,-.035,.20,.32);
 let result=blendPose(run,pose,ease(-.62,-.32,u));result.time=t;
 if(u>.40){
   const root3=path(contactTime+.9),kneel=sampleIdle(root3,yaw,t);kneel.hip[1]=.52;kneel.lean=.32;kneel.roll=-.16;kneel.feet=[localPoint(root3,yaw,.28,.10,.15),localPoint(root3,yaw,-.30,.10,-.15)];kneel.kneeHints=[localPoint(root3,yaw,.28,.35,.15),localPoint(root3,yaw,.05,.08,-.15)];kneel.handTargets=[localPoint(root3,yaw,.20,.78,.14),localPoint(root3,yaw,.48,.12,-.35)];kneel.elbowHints=[localPoint(root3,yaw,.10,.65,.25),localPoint(root3,yaw,.30,.30,-.4)];kneel.handWeight=1;kneel.handGround=[false,true];kneel.headYaw=.28;kneel.action='손을 짚고 무릎 세우기';
   result=blendPose(result,kneel,smooth(.40,.95,u));
   const stand=sampleIdle(root3,yaw,t);stand.gesture=reaction==='clean'?'observe':'appeal';stand.gestureWeight=smooth(1.15,1.7,u);stand.headYaw=reaction==='clean'?-.40:.40;stand.action=reaction==='clean'?'몸을 일으켜 공을 따라가기':'몸을 일으키며 주심 확인';result=blendPose(result,stand,smooth(.95,1.65,u));
   if(reaction==='clean'&&u>1.65){const chasePath=tt=>{const v=Math.max(0,tt-contactTime-1.65),move=3.5*(v-.25*(1-Math.exp(-v/.25))),p=localPoint(root3,yaw,move,0,-move*.22);return [p[0],p[2]];},chase=sampleLocomotion(chasePath,t,{pace:3.5,phase:.15});result=blendPose(result,chase,smooth(1.65,2.0,u));result.action='일어나 공을 따라가기';}
 }
 return result;
}

// Contact-driven reactions, shared by the match and the motion viewer. Ankle
// contact is fixed at u=0; upper-body protection begins within the next frames.
export function sampleFoulReaction(origin,yaw,t,contactTime,type='careless'){
 const u=t-contactTime,runPath=tt=>{const p=localPoint(origin,yaw,-.20+(tt-contactTime)*4.8,0);return [p[0],p[2]];},running=sampleLocomotion(runPath,t,{pace:4.8,phase:.2}),stride=ease(-.30,-.03,u),reaction=smooth(0,.09,u),impactAt=type==='serious'?.30:.38,fall=ease(0,impactAt,u),s=-.20+(u<0?u*4.8:1.15*(1-Math.exp(-u/(1.15/4.8)))),root=localPoint(origin,yaw,s,0),root2=[root[0],root[2]],side=type==='reckless'||type==='serious';
 const near=vecLerp(localPoint(origin,yaw,-.20+Math.min(0,u)*4.8+.18,.10,.13),localPoint(origin,yaw,0,.10,.13),stride),far=localPoint(root2,yaw,lerp(-.25,-.58,fall),lerp(.14,.10,fall),-.13);
 const released=smooth(.035,.27,u),nearEnd=localPoint(root2,yaw,-.24,.12,.13);for(let i=0;i<3;i++)near[i]=lerp(near[i],nearEnd[i],released);near[1]+=.16*Math.sin(fall*Math.PI);
 const pose={hip:[root[0],lerp(.88,side?.26:.30,fall),root[2]],yaw,feet:[near,far],footPitch:[0,0],footYaw:[0,0],lean:.07+reaction*(side?.32:.28)+fall*(side?.16:.92),roll:side?fall*(type==='serious'?-1.38:1.24):fall*.07,spinePitch:fall*.10,chestPitch:-fall*.03,headPitch:-fall*.18,headYaw:side?fall*.23:0,armSwing:.2,elbow:.8,pain:reaction*(type==='serious'?1:type==='reckless'?.75:.35),grip:0,time:t,fall,reactionType:type,action:u<0?'접촉 전 디딤':u<.09?'접촉 / 즉각 균형 반응':'손으로 충격을 받아내기'};
 pose.hip[1]+=recoil(u-impactAt,.027,.20,.34);pose.spinePitch+=recoil(u-.028,.10,.22,.34)+recoil(u-impactAt,.06,.22,.36);pose.chestPitch+=recoil(u-.065,-.075,.24,.36);pose.headPitch+=recoil(u-.095,.08,.26,.40);pose.headRoll=recoil(u-.08,side?.08:.04,.24,.36);
 pose.kneeHints=[0,1].map(i=>vecLerp(localPoint(root2,yaw,.75,.72,i===0?.13:-.13),localPoint(root2,yaw,.10,.32,i===0?.42:-.42),smooth(.09,.36,u)));
 pose.handTargets=[localPoint(root2,yaw,side?.20:.60,side?.30:.11,.22),localPoint(root2,yaw,side?.35:.58,.12,-.24)];pose.elbowHints=[localPoint(root2,yaw,.3,.45,.35),localPoint(root2,yaw,.30,.35,-.35)];pose.handWeight=smooth(.045,.27,u);pose.handGround=side?[false,true]:[true,true];
 let state=blendPose(running,pose,stride);
 if(type==='advantage'){
   const path=tt=>{const v=tt-contactTime,p=localPoint(origin,yaw,-.20+v*4.4,0);return [p[0],p[2]];},recover=sampleLocomotion(path,t,{pace:4.4,phase:.2});recover.lean+=.20*Math.sin(clamp(u/.44)*Math.PI);recover.roll+=.11*Math.sin(clamp(u/.44)*Math.PI);recover.armSwing+=.25*Math.sin(clamp(u/.44)*Math.PI);recover.action=u<.40?'발을 다시 딛고 균형 회복':'공격을 계속 이어가기';return fitKickReach(blendPose(state,recover,smooth(0,.12,u)));
 }
 if(u>.45&&side){state.action='옆으로 굴러 다리 보호';const q=ease(.45,.85,u),sign=type==='serious'?-1:1;state.handGroundWeight=[0,1-q];state.handTargets=[vecLerp(pose.handTargets[0],localPoint(root2,yaw,-.16,.18,sign*.12),q),vecLerp(pose.handTargets[1],localPoint(root2,yaw,-.28,.17,sign*.02),q)];state.elbowHints=[vecLerp(pose.elbowHints[0],localPoint(root2,yaw,.03,.36,sign*.42),q),vecLerp(pose.elbowHints[1],localPoint(root2,yaw,.15,.33,sign*.35),q)];state.headPitch=lerp(state.headPitch,.18,q);state.grip=q*.45;}
 if(!side&&u>.68){
   const kneel=sampleIdle(root2,yaw,t);kneel.hip[1]=.53;kneel.lean=.35;kneel.feet=[localPoint(root2,yaw,.20,.10,.13),localPoint(root2,yaw,-.35,.10,-.13)];kneel.kneeHints=[localPoint(root2,yaw,.25,.36,.13),localPoint(root2,yaw,.1,.08,-.13)];kneel.handTargets=[localPoint(root2,yaw,.43,.12,.23),localPoint(root2,yaw,.15,.66,-.23)];kneel.elbowHints=[localPoint(root2,yaw,.28,.32,.33),localPoint(root2,yaw,.10,.55,-.34)];kneel.handWeight=1;kneel.handGround=[true,false];kneel.pain=type==='clean'?.05:.18;kneel.action='손을 짚고 한쪽 발로 일어나기';state=blendPose(state,kneel,smooth(.68,1.15,u));
   const standing=sampleIdle(root2,yaw,t);standing.headYaw=.40;standing.gesture=type==='clean'?'observe':'appeal';standing.gestureWeight=smooth(1.25,1.9,u);standing.pain=type==='clean'?0:.1;standing.action='일어나 주심과 공의 위치 확인';state=blendPose(state,standing,smooth(1.15,1.9,u));
 }
 return fitKickReach(state);
}

// A lofted kick follows gravity, with a smaller rebound after its first landing.
// Ground passes stay on the turf instead of floating in a decorative sine wave.
export function sampleBallFlight(start,end,elapsed,duration,{loft=false,bounce=false}={}){
 const u=clamp(elapsed,0,duration),q=u/duration,ball=vecLerp(start,end,q);
 if(loft)ball[1]=start[1]+((end[1]-start[1])/duration+4.905*duration)*u-4.905*u*u;
 if(elapsed>duration&&bounce){const v=(4.905*duration-(end[1]-start[1])/duration)*.30,flight=2*v/9.81,s=clamp(elapsed-duration,0,flight),coast=s+Math.max(0,elapsed-duration-flight)*.35;ball[0]+=(end[0]-start[0])/duration*coast*.58;ball[2]+=(end[2]-start[2])/duration*coast*.58;ball[1]=Math.max(BALL_RADIUS,end[1]+v*s-4.905*s*s);}
 ball[1]=Math.max(BALL_RADIUS,ball[1]);return ball;
}
const quatMultiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
export class BallRotationTrack {
 constructor(sample,{step=1/120,airSpin=10}={}){this.sample=sample;this.step=step;this.airSpin=airSpin;this.frames=[[0,0,0,1]];this.last=sample(0);}
 increment(q,a,b,dt){const dx=b[0]-a[0],dz=b[2]-a[2],distance=Math.hypot(dx,dz);if(distance<1e-10)return q.slice();const airborne=(a[1]+b[1])*.5>BALL_RADIUS+.035,angle=airborne?this.airSpin*dt:distance/BALL_RADIUS,s=Math.sin(angle/2);return quatMultiply([dz/distance*s,0,-dx/distance*s,Math.cos(angle/2)],q);}
 at(time){const t=Math.max(0,time),index=Math.floor(t/this.step);while(this.frames.length<=index){const n=this.frames.length,p=this.sample(n*this.step);this.frames.push(this.increment(this.frames[n-1],this.last,p,this.step));this.last=p;}const q=this.frames[index],a=this.sample(index*this.step),b=this.sample(t);return this.increment(q,a,b,t-index*this.step);}
}
export function kickBallPosition(origin,yaw){return localPoint(origin,yaw,.66,BALL_RADIUS,.105);}
// Move the centre of mass through the kick; only the support boot plants.
// Quintic segments share velocity and acceleration at impact and recovery.
const curve3=(a,b,va,vb,elapsed,duration)=>a.map((v,i)=>hermite(v,b[i],va[i]*duration,vb[i]*duration,clamp(elapsed/duration)));
const pathVelocity=(path,t)=>{const a=path(t-.001),b=path(t+.001);return [(b[0]-a[0])/.002,0,(b[1]-a[1])/.002];};
export function fitKickReach(pose){
 const x=pose.lean||0,y=pose.pelvisYaw||0,z=pose.roll||0;
 for(let i=0;i<2;i++){
   // Hip attachment transformed by the same XYZ rotation as the rendered rig.
   const px=(i===0?-.104:.104),py=-.03,rzx=px*Math.cos(z)-py*Math.sin(z),rzy=px*Math.sin(z)+py*Math.cos(z),ryx=rzx*Math.cos(y),ryz=-rzx*Math.sin(y),ry=rzy*Math.cos(x)-ryz*Math.sin(x),rf=rzy*Math.sin(x)+ryz*Math.cos(x);
   const hx=pose.hip[0]+ryx*Math.cos(pose.yaw)+rf*Math.sin(pose.yaw),hz=pose.hip[2]-ryx*Math.sin(pose.yaw)+rf*Math.cos(pose.yaw),foot=pose.feet[i],horizontal=(foot[0]-hx)**2+(foot[2]-hz)**2;
   pose.hip[1]=softMin(pose.hip[1],foot[1]-ry+Math.sqrt(Math.max(.02,.859**2-horizontal)),.016);
 }
 return pose;
}
export function sampleKick(origin,yaw,t,contactTime=0,{power=1,receiving=false,technique='drive',path=null,phase=.2,pace=receiving?2.6:3.6}={}){
 const u=t-contactTime,travel=path||linearPath(origin[0]-Math.sin(yaw)*pace*contactTime,origin[1]-Math.cos(yaw)*pace*contactTime,Math.sin(yaw)*pace,Math.cos(yaw)*pace),root=travel(t),base=sampleLocomotion(travel,t,{phase,pace}),period=sampleLocomotion(travel,contactTime,{phase,pace}).period||.7;
 // Synchronise the approach stride to the support boot's touchdown. Pulling a
 // mid-swing boot to the ground in 80 ms was the old visible hitch.
 const plantAt=contactTime-.035,cycle=Math.round(plantAt/period+phase+.5),matchedPhase=cycle-.5-plantAt/period,gaitWeight=ease(-.80,-.42,u)*(1-ease(.34,.82,u)),matched=sampleLocomotion(travel,t,{phase:matchedPhase,pace}),run=blendPose(base,matched,gaitWeight);
 const inside=!receiving&&technique==='inside',loft=!receiving&&technique==='loft',weight=ease(-.46,-.28,u)*(1-ease(.22,.68,u)),supportWeight=ease(-.12,-.035,u)*(1-ease(.10,.27,u)),ball=kickBallPosition(origin,yaw),contactOffset=inside?[.052,0,.10]:[0,0,BOOT_TOE],impactPitch=receiving?0:loft?-.20:inside?.035:.12,impactYaw=inside?-1.03:0;
 // Open the hip for the inside surface; a driven kick presents the laces.
 // Rotate the actual mesh contact point, then solve the ankle around that point.
 const ox=contactOffset[0]*Math.cos(impactYaw)+contactOffset[2]*Math.sin(impactYaw),oz=-contactOffset[0]*Math.sin(impactYaw)+contactOffset[2]*Math.cos(impactYaw),oy=-oz*Math.sin(impactPitch),of=oz*Math.cos(impactPitch),vertical=loft?-.065:0,reach=Math.sqrt(BALL_RADIUS**2-vertical**2),hit=localPoint(origin,yaw,.66-reach-of,BALL_RADIUS+vertical-oy,.105+ox);
 const backTime=-.19,followTime=.13,back=localPoint(travel(contactTime+backTime),yaw,receiving?.12:inside?-.26:-.36,receiving?.16:inside?.24:.32,inside?.19:.105),end=localPoint(travel(contactTime+followTime),yaw,receiving?.17:inside?.61:.76,receiving?.15:(loft?.57:inside?.30:.48)*power,inside?.04:.105),impactVelocity=[Math.sin(yaw)*(receiving?pace:7.8*power),receiving?0:loft?2.5*power:.8*power,Math.cos(yaw)*(receiving?pace:7.8*power)],backVelocity=pathVelocity(travel,contactTime+backTime),endVelocity=pathVelocity(travel,contactTime+followTime);
 let foot;
 if(u<backTime)foot=localPoint(root,yaw,receiving?.12:lerp(-.08,inside?-.26:-.36,smooth(-.40,backTime,u)),receiving?.16:lerp(.44,inside?.24:.32,smooth(-.40,backTime,u)),inside?.19:.105);
 else if(u<0)foot=curve3(back,hit,backVelocity,impactVelocity,u-backTime,-backTime);
 else if(u<followTime)foot=curve3(hit,end,impactVelocity,endVelocity,u,followTime);
 else {const recoveryAt=.48,after=sampleLocomotion(travel,contactTime+recoveryAt,{phase:matchedPhase,pace}),a=sampleLocomotion(travel,contactTime+recoveryAt-.001,{phase:matchedPhase,pace}).feet[0],b=sampleLocomotion(travel,contactTime+recoveryAt+.001,{phase:matchedPhase,pace}).feet[0],velocity=b.map((v,i)=>(v-a[i])/.002);foot=u<recoveryAt?curve3(end,after.feet[0],endVelocity,velocity,u-followTime,recoveryAt-followTime):matched.feet[0];}
 const pose={...run,feet:run.feet.map(f=>f.slice()),footPitch:run.footPitch.slice(),footYaw:run.footYaw.slice(),hip:run.hip.slice(),contactOffset,technique};
 pose.feet[0]=vecLerp(run.feet[0],foot,weight);pose.feet[1]=vecLerp(run.feet[1],localPoint(origin,yaw,.27,GROUND_FOOT,-.14),supportWeight);
 const load=ease(-.44,-.14,u)*(1-ease(-.08,.12,u)),push=ease(-.02,.10,u)*(1-ease(.12,.30,u)),shift=localPoint(root,yaw,0,0,-.035*load),bounce=recoil(u-.018,receiving?.012:.055,.22,.32);
 pose.hip[0]=lerp(run.hip[0],shift[0],weight);pose.hip[2]=lerp(run.hip[2],shift[2],weight);pose.hip[1]=lerp(run.hip[1],.90-.036*load+.027*push+bounce*.12,weight);
 const turn=Math.atan2(Math.sin(yaw-run.yaw),Math.cos(yaw-run.yaw));pose.yaw=run.yaw+turn*weight;
 const presented=smooth(-.19,-.055,u)*(1-smooth(.045,.28,u));pose.footPitch[0]=lerp(run.footPitch[0],lerp(-.34,impactPitch,smooth(backTime,-.055,u))+(loft?.05:.16)*smooth(.045,.28,u),weight);pose.footPitch[1]*=1-supportWeight;pose.footYaw[0]=lerp(run.footYaw[0],impactYaw*presented,weight);pose.footYaw[1]=lerp(run.footYaw[1],yaw-run.yaw,supportWeight);
 pose.footPitch[0]=lerp(pose.footPitch[0],run.footPitch[0],ease(.13,.48,u));
 pose.lean=lerp(run.lean,receiving?.21:loft?lerp(-.055,.16,smooth(0,.18,u)):lerp(inside?.16:.17,inside?.24:.32,smooth(-.19,.13,u)),weight);pose.roll=lerp(run.roll,.035*Math.sin(smooth(-.28,.18,u)*Math.PI),weight);
 const wind=ease(-.46,-.19,u),pelvisRelease=ease(-.16,.055,u),spineRelease=ease(-.12,.095,u),chestRelease=ease(-.085,.14,u),strength=receiving?.35:inside?.70:power;
 pose.pelvisYaw=lerp(run.pelvisYaw,(-.18*wind+.34*pelvisRelease)*strength,weight);pose.spineYaw=lerp(run.spineYaw,(-.14*wind+.25*spineRelease)*strength,weight);pose.chestYaw=lerp(run.chestYaw,(-.28*wind+.48*chestRelease)*strength,weight);
 pose.spinePitch=lerp(run.spinePitch||0,-.075*load+bounce,weight);pose.chestPitch=lerp(run.chestPitch||0,-.025*load+recoil(u-.055,-.06,.25,.34),weight);
 pose.headPitch=lerp(run.headPitch,.08-pose.lean+recoil(u-.085,.045,.23,.34),weight);pose.headYaw=lerp(run.headYaw,-pose.pelvisYaw-pose.spineYaw-pose.chestYaw,weight);
 const arms=resolveArms(run),sweep=ease(-.09,.21,u),armCatch=recoil(u-.085,.11,.26,.38),targets=[[lerp(.20,-.48,sweep)+armCatch,-.08*load,-lerp(.68,.31,sweep)],[lerp(-.72,.42,sweep)-armCatch,.06*load,lerp(.33,.49,sweep)]];
 pose.armRotations=arms.arms.map((arm,i)=>vecLerp(arm,targets[i],weight));pose.elbowAngles=arms.elbows.map((e,i)=>lerp(e,i?lerp(-.90,-1.15,sweep):lerp(-.58,-1.05,sweep),weight));
 const reference=sampleKickReference(u),referenceWeight=reference.weights.blend*weight*(receiving?.14:.30);
 if(referenceWeight>0){
   pose.lean+=reference.pelvis[0]*.24*referenceWeight;
   pose.spinePitch+=reference.spine[0]*.24*referenceWeight;
   pose.chestPitch+=reference.chest[0]*.24*referenceWeight;
   pose.roll+=reference.pelvis[2]*referenceWeight*.20;
   pose.spineRoll=lerp(pose.spineRoll||0,reference.spine[2]*.25,referenceWeight);
   pose.chestRoll=lerp(pose.chestRoll||0,reference.chest[2]*.25,referenceWeight);
   for(let i=0;i<2;i++){const r=reference.arms[i],target=[r[0]*1.3+.18,r[1]*.45,r[2]*.55],armWeight=reference.weights.blend*weight*(receiving?.20:.90);pose.armRotations[i]=vecLerp(pose.armRotations[i],target,armWeight);pose.elbowAngles[i]=lerp(pose.elbowAngles[i],reference.elbows[i],armWeight);}
 }
 pose.animationSource='CMU 10_03 soccer kick + contact IK';
 if(receiving){pose.headYaw-=.42*smooth(-.46,-.28,u)*(1-smooth(-.20,-.06,u));pose.chestYaw+=.10*smooth(-.46,-.28,u)*(1-smooth(-.20,-.06,u));}pose.kickWeight=weight;
 pose.action=weight<.02?run.action:receiving?'달리며 트래핑':u<-.19?'달리며 킥 준비':u<0?'지지 발 디딤 / 타격':u<.16?'후속 스윙':'다음 보폭';fitKickReach(pose);
 if(receiving&&u>0){ball[0]=pose.feet[0][0]+(BOOT_TOE+BALL_RADIUS)*Math.sin(pose.yaw);ball[2]=pose.feet[0][2]+(BOOT_TOE+BALL_RADIUS)*Math.cos(pose.yaw);}
 return {pose,ball,contactTime,contactOffset};
}
export function sampleDribble(path,t,{pace=2.8,phase=0,interval=.64,touchOffset=0}={}){
 const pose=sampleLocomotion(path,t,{pace,phase}),clock=(t-touchOffset)/interval,cycle=Math.floor(clock),q=fract(clock),touchTime=cycle*interval+touchOffset,root=path(touchTime),next=path(touchTime+interval);
 const anchorYaw=at=>{const a=path(at-.01),b=path(at+.01),dx=b[0]-a[0],dz=b[1]-a[1],speed=Math.hypot(dx,dz)/.02,raw=yawFor(dx,dz);if(speed>=.35)return raw;let idle;if(typeof path.idleYaw==='function')idle=path.idleYaw(at);else{const past=path(at-.35),future=path(at+.35),vx=future[0]-past[0],vz=future[1]-past[1];idle=Math.hypot(vx,vz)>.015?yawFor(vx,vz):0;}return idle+Math.atan2(Math.sin(raw-idle),Math.cos(raw-idle))*ease(.02,.35,speed);};
 const yaw=anchorYaw(touchTime),i=((cycle%2)+2)%2,lateral=i===0?.105:-.105;
 const start=localPoint(root,yaw,.62,BALL_RADIUS,lateral),nextYaw=anchorYaw(touchTime+interval),end=localPoint(next,nextYaw,.62,BALL_RADIUS,-lateral);
 const ball=vecLerp(start,end,q+.16*q*(1-q));ball[1]=BALL_RADIUS;
 const since=t-touchTime,until=touchTime+interval-t,weight=Math.max(1-smooth(0,.16,since),1-smooth(0,.12,until));
 if(weight>.001){const active=since<.16?i:1-i,anchor=since<.16?start:end,face=since<.16?yaw:nextYaw,target=[anchor[0]-(BOOT_TOE+BALL_RADIUS)*Math.sin(face),BALL_RADIUS,anchor[2]-(BOOT_TOE+BALL_RADIUS)*Math.cos(face)];pose.feet[active]=vecLerp(pose.feet[active],target,weight);pose.footPitch[active]*=1-weight;const desired=Math.atan2(Math.sin(face-pose.yaw),Math.cos(face-pose.yaw)),prior=pose.footYaw[active]||0;pose.footYaw[active]=prior+Math.atan2(Math.sin(desired-prior),Math.cos(desired-prior))*weight;}
 pose.action='드리블';fitKickReach(pose);return {pose,ball,touchTime};
}
export function sampleOpenPlay(t,team='home',{ballOnly=false}={}){
 const d=team==='home'?1:-1,ids=[7,10,11,9],places=[[-12,7],[1,-5],[16,10],[25,-8]],cell=3.3,total=cell*4,mod=n=>((n%4)+4)%4;
 // Every athlete keeps one continuous route, including role changes between passes.
 const paths=places.map((point,j)=>{const next=places[(j+1)%4],yaw=yawFor((next[0]-point[0])*d,next[1]-point[1]);return tt=>{const a=(tt-(j*cell+.8))*Math.PI*2/(total*.5),p=localPoint([point[0]*d,point[1]],yaw,Math.sin(a)*5.2,0,(Math.cos(a)-1)*1.1);return [p[0],p[2]];};});
 const leg=n=>{
   const j=mod(n),k=(j+1)%4,kickAt=n*cell+.8,origin=paths[j](kickAt),loft=j===1||j===3,duration=loft?1.55:Math.hypot(places[k][0]-places[j][0],places[k][1]-places[j][1])/15,arrival=kickAt+duration,receiveOrigin=paths[k](arrival),v=pathVelocity(paths[k],arrival),receiveYaw=yawFor(v[0],v[2]),target=kickBallPosition(receiveOrigin,receiveYaw),yaw=yawFor(target[0]-origin[0],target[2]-origin[1]);
   return {j,k,kickAt,origin,loft,duration,arrival,receiveOrigin,receiveYaw,target,yaw,start:kickBallPosition(origin,yaw)};
 };
 const actors=new Map();
 for(let j=0;j<4&&!ballOnly;j++){
   const offset=j*cell+.8,n=j+4*Math.round((t-offset)/total),out=leg(n),incoming=leg(n-1),phase=j*.17;
   const carry=sampleDribble(paths[j],t,{pace:4,phase,touchOffset:incoming.arrival}),carryWeight=smooth(incoming.arrival+.16,incoming.arrival+.48,t)*(1-smooth(out.kickAt-.62,out.kickAt-.46,t));let state=blendPose(sampleLocomotion(paths[j],t,{pace:4,phase}),carry.pose,carryWeight);
   if(t>out.kickAt-.80&&t<out.kickAt+.82)state=blendPose(state,sampleKick(out.origin,out.yaw,t,out.kickAt,{path:paths[j],pace:4,phase,technique:out.loft?'loft':'inside'}).pose,ease(out.kickAt-.80,out.kickAt-.60,t));
   else if(t>incoming.arrival-.80&&t<incoming.arrival+.82)state=blendPose(state,blendPose(sampleKick(incoming.receiveOrigin,incoming.receiveYaw,t,incoming.arrival,{receiving:true,path:paths[j],pace:4,phase}).pose,carry.pose,carryWeight),ease(incoming.arrival-.80,incoming.arrival-.60,t));
   fitKickReach(state);actors.set(ids[j],state);
 }
 const flightIndex=Math.floor((t-.8)/cell+1e-10),flight=leg(flightIndex),v=t-flight.arrival;let ball;
 if(t<flight.arrival)ball=sampleBallFlight(flight.start,flight.target,t-flight.kickAt,flight.duration,{loft:flight.loft});
 else{
   const receiving=sampleKick(flight.receiveOrigin,flight.receiveYaw,t,flight.arrival,{receiving:true,path:paths[flight.k],pace:4,phase:flight.k*.17}),carry=sampleDribble(paths[flight.k],t,{pace:4,phase:flight.k*.17,touchOffset:flight.arrival}),next=leg(flightIndex+1);
   ball=vecLerp(receiving.ball,carry.ball,smooth(.16,.48,v));ball=vecLerp(ball,next.start,smooth(next.kickAt-.55,next.kickAt-.02,t));
 }
 return {actors,ball,sender:ids[flight.j],receiver:ids[flight.k],action:t<flight.arrival?(flight.loft?'로빙 패스':'빠른 패스'):'달리며 볼 컨트롤'};
}
export function sampleMotionStudio(t,type='run',variant='careless'){
 if(type==='model'){const pose=sampleIdle([0,0],Math.PI/2-t*.8,t);pose.headPitch=0;return {pose,ball:[0,BALL_RADIUS,0],action:'모델 보기 · 전신 / 재질 / 얼굴'};}
 if(type==='reaction'){const contactTime=1.4,height=variant==='serious'?.58:variant==='reckless'?.33:.11,early=variant==='clean'?-.32:0,pitch=variant==='serious'?-1.05:variant==='reckless'?-.35:0,pose=sampleFoulReaction([0,0],Math.PI/2,t,contactTime,variant),receiver=sampleSlideTackle([variant==='clean'?.425:0,height,variant==='clean'?-.22:.13],Math.PI/2,t,contactTime+early,{pitch,reaction:variant}),u=t-contactTime,ball=[.54+Math.max(0,u-early)*(variant==='clean'?7.6:3.6),BALL_RADIUS,-.22-Math.max(0,u-early)*.35];return {pose,receiver,ball,action:pose.action+' / '+receiver.action,contactTime};}
 if(type==='tackle'){const pose=sampleSlideTackle([0,.115,0],Math.PI/2,t,1.4),ball=t<1.4?[BALL_RADIUS,.115,0]:[BALL_RADIUS+(t-1.4)*7.6,.115,-(t-1.4)*4.4];return {pose,ball,action:'슬라이딩 태클 · '+pose.action,contactTime:1.4};}
 if(['walk','run','sprint','dribble'].includes(type)){
   const speed={walk:1.35,run:4.8,sprint:7.2,dribble:4.4}[type],path=linearPath(-speed*2,0,speed,0),carry=type==='dribble'?sampleDribble(path,t,{pace:speed}):null,pose=carry?.pose||sampleLocomotion(path,t,{pace:speed});
   return {pose,ball:carry?.ball||[0,BALL_RADIUS,0],action:pose.action+' · '+speed.toFixed(1)+' m/s'};
 }
 const loft=type==='lob',shot=type==='shot',distance=loft?21:shot?25:16,duration=loft?1.7:shot?1.1:.88,contactTime=1.4,arrival=contactTime+duration;
 const kick=sampleKick([0,0],Math.PI/2,t,contactTime,{power:shot?1.3:1,technique:shot?'drive':loft?'loft':'inside'}),receiver=sampleKick([distance,0],-Math.PI/2,t,arrival,{receiving:true}),ball=t<contactTime?kick.ball:sampleBallFlight(kick.ball,receiver.ball,t-contactTime,duration,{loft:loft||shot});
 return {pose:kick.pose,receiver:receiver.pose,ball,action:(loft?'로빙 패스':shot?'강한 슈팅':'빠른 패스')+' · '+kick.pose.action+(t<contactTime?'':t<arrival?' / 공 이동':' / 수신'),contactTime,arrival};
}
// One continuous route per player, including the switch from receiving to
// carrying to passing. These routes stay on the pitch for arbitrarily long play.
function passingSequence(mark,d,kickAt,{cross=false,ids=[10,7,11,9]}={}){
 const cell=3.6,total=cell*4,side=mark[2]>0?-1:1;
 const places=[[mark[0]-.66*d,mark[2]-.105*d],[mark[0]+(cross?19:8)*d,mark[2]+side*(cross?10:4)],[mark[0]+14*d,mark[2]-side*7],[mark[0]+4*d,mark[2]-side*10]].map(p=>[clamp(p[0],-43,43),clamp(p[1],-24,24)]);
 const orbit=(j,tt)=>{const a=(tt-kickAt-j*cell)*Math.PI*2/total;return [places[j][0]+d*Math.sin(a)*2.1,places[j][1]+Math.cos(a)*1.2];};
 const duration=n=>n===0&&cross?1.65:clamp(Math.hypot(places[(n+1)%4][0]-places[n%4][0],places[(n+1)%4][1]-places[n%4][1])/14,.58,1.8);
 const arrival=kickAt+duration(0),receiveRoot=orbit(1,arrival),v=pathVelocity(tt=>orbit(1,tt),arrival),receiveYaw=yawFor(v[0],v[2]),target=kickBallPosition(receiveRoot,receiveYaw),yaw=yawFor(target[0]-mark[0],target[2]-mark[2]),offset=localPoint([0,0],yaw,.66,0,.105),origin=[mark[0]-offset[0],mark[2]-offset[2]];
 const paths=places.map((_,j)=>tt=>{
   if(j)return orbit(j,tt);
   const u=tt-kickAt,q0=clamp((u+1.1)/.3),approach=u<-.8?-.95+.3*(q0**3-.5*q0**4):u>.8?.8+.5*(1-Math.exp(-(u-.8)/.5)):u,root=[origin[0]+Math.sin(yaw)*approach*3.6,origin[1]+Math.cos(yaw)*approach*3.6];
   const q=ease(kickAt+.8,kickAt+2.4,tt);return vecLerp(root,orbit(0,tt),q);
 });
 const leg=n=>{
   const j=n%4,k=(j+1)%4,at=kickAt+n*cell,flight=duration(n),arrive=at+flight,receiveOrigin=paths[k](arrive),velocity=pathVelocity(paths[k],arrive),receiveYaw=yawFor(velocity[0],velocity[2]),end=kickBallPosition(receiveOrigin,receiveYaw),root=paths[j](at),face=n===0?yaw:yawFor(end[0]-root[0],end[2]-root[1]);
   return {j,k,at,flight,arrive,receiveOrigin,receiveYaw,end,root,face,start:n===0?mark:kickBallPosition(root,face),loft:n===0?cross:j===2};
 };
 return (t,{ballOnly=false}={})=>{
   const n=Math.max(0,Math.floor((t-kickAt)/cell+1e-10)),flight=leg(n),actors=new Map();
   for(let j=0;j<4&&!ballOnly;j++){
     const cycle=Math.max(0,Math.round((t-kickAt-j*cell)/total)),out=leg(j+cycle*4),incoming=j+cycle*4>0?leg(j+cycle*4-1):null,phase=j*.17,path=paths[j];
     const run=sampleLocomotion(path,t,{pace:3.6,phase});let state=blendPose(sampleIdle(path(t),j===0?yaw:run.yaw,t),run,smooth(.04,1.0,run.speed||0));
     if(incoming){const carry=sampleDribble(path,t,{pace:3.6,phase,touchOffset:incoming.arrive}),weight=smooth(incoming.arrive+.16,incoming.arrive+.48,t)*(1-smooth(out.at-.62,out.at-.46,t));state=blendPose(state,carry.pose,weight);
       if(t>incoming.arrive-.80&&t<incoming.arrive+.82)state=blendPose(state,blendPose(sampleKick(incoming.receiveOrigin,incoming.receiveYaw,t,incoming.arrive,{receiving:true,path,phase}).pose,carry.pose,weight),ease(incoming.arrive-.80,incoming.arrive-.60,t));
     }
     if(t>out.at-.80&&t<out.at+.82)state=blendPose(state,sampleKick(out.root,out.face,t,out.at,{path,phase,technique:out.loft?'loft':'inside'}).pose,ease(out.at-.80,out.at-.60,t));
     actors.set(ids[j],state);
   }
   let ball;
   if(t<kickAt)ball=mark.slice();
   else if(t<flight.arrive)ball=sampleBallFlight(flight.start,flight.end,t-flight.at,flight.flight,{loft:flight.loft});
   else{
     const path=paths[flight.k],phase=flight.k*.17,receive=sampleKick(flight.receiveOrigin,flight.receiveYaw,t,flight.arrive,{receiving:true,path,phase}),carry=sampleDribble(path,t,{pace:3.6,phase,touchOffset:flight.arrive}),next=leg(n+1);
     ball=vecLerp(receive.ball,carry.ball,smooth(flight.arrive+.16,flight.arrive+.48,t));ball=vecLerp(ball,next.start,smooth(next.at-.55,next.at-.02,t));
   }
   return {ball,actors,passAt:flight.at,arrival:flight.arrive,initialArrival:arrival,sender:ids[flight.j],receiver:ids[flight.k],phase:t<kickAt?'setup':t<flight.arrive?'pass':'carry',action:t<kickAt?'프리킥 준비':t<flight.arrive?(flight.loft?'크로스 / 로빙 패스':'짧은 패스'):'볼 컨트롤 · 공격 연결'};
 };
}
const restartSequences=new WeakMap();
function restartSequence(record,start){
 const key=[start.x,start.z,start.dir,record.style,record.goal,record.decision.restart].join('|'),prior=restartSequences.get(record);
 if(prior?.key===key)return prior.sample;
 const restart=record.decision.restart,d=start.dir,team=record.decision.beneficiary,other=team==='home'?'away':'home',style=record.style||(['penalty','free','advantage','play'].includes(restart)?'shot':restart==='drop'?'drop':'short'),kickAt=['advantage','play'].includes(restart)?1.3:2.2;
 const mark=[start.x,BALL_RADIUS,start.z],origin=[start.x-.66*d,start.z-.105*d],yaw=d*Math.PI/2;
 const kickPath=tt=>{const u=tt-kickAt,q=clamp((u+1.1)/.3),s=u<-.8?-.95+.3*(q**3-.5*q**4):u>.8?.8+.6*(1-Math.exp(-(u-.8)/.6)):u;return [origin[0]+d*3.6*s,origin[1]];};
 const kickState=t=>{const kick=sampleKick(origin,yaw,t,kickAt,{power:1.1,technique:'drive',path:kickPath});return blendPose(sampleIdle(kickPath(t),yaw,t),kick.pose,smooth(.04,1,kick.pose.speed||0));};
 const end=[(record.goal?54:50)*d,record.goal?.26:.45,record.goal?1.7:-.9],duration=Math.max(.38,Math.hypot(end[0]-start.x,end[2]-start.z)/(restart==='penalty'?24:22)),saveAt=kickAt+duration;
 const rebound=s=>{const coast=1-Math.exp(-s*1.7);return [end[0]-d*3.2*coast,Math.max(BALL_RADIUS,end[1]+1.1*s-4.905*s*s),end[2]-1.5*coast];};
 const passing=passingSequence(mark,d,kickAt,{cross:style==='cross'}),defence=passingSequence(rebound(1.55),-d,saveAt+1.55,{ids:[4,7,11,9]}),kickoffAt=saveAt+4.1,kickoff=passingSequence([0,BALL_RADIUS,0],-d,kickoffAt),dropPath=linearPath(start.x-.62*d-3.4*d*1.92,start.z+.105*d,3.4*d,0),dropEnd=sampleDribble(dropPath,3,{pace:3.4}).ball,dropPass=passingSequence(dropEnd,d,3);
 const sample=(t,options={})=>{
   const base={kickAt,duration,q:clamp((t-kickAt)/duration),team,inPlay:t>=kickAt,canAdvance:t>=kickAt+7,fade:0};
   if(style==='short'||style==='cross')return {...base,...passing(t,options)};
   if(style==='drop'){
     if(t>=3)return {...base,...dropPass(t,options),inPlay:true};
     const elapsed=Math.max(0,t-.65),control=sampleDribble(dropPath,t,{pace:3.4}),carry=t>1.92?control:null,pose=blendPose(sampleLocomotion(dropPath,t,{pace:3.4}),control.pose,smooth(1.68,1.91,t)),future=dropPass(t,options).actors.get(10),weight=ease(2.25,3,t);
     return {...base,ball:carry?.ball||[start.x,t<.65?1.25:Math.max(BALL_RADIUS,1.25-4.905*elapsed*elapsed),start.z],actors:new Map([[10,future?blendPose(pose,future,weight):pose]]),phase:t<1.132?'drop':'carry',inPlay:t>=1.132,action:t<1.132?'드롭볼':'볼 컨트롤 · 공격 연결'};
   }
   if(record.goal&&t>=saveAt+2.6){const next=kickoff(t,options);return {...base,...next,team:other,phase:t<kickoffAt?'kickoff':next.phase,inPlay:t>=kickoffAt,action:t<kickoffAt?'득점 후 상대 팀 킥오프':next.action,fade:1-ease(saveAt+2.6,saveAt+3.1,t),canAdvance:t>=kickoffAt+4};}
   const actors=options.ballOnly?new Map():new Map([[10,kickState(t)]]);
   if(!record.goal&&t>=saveAt+1.55){const next=defence(t,options);return {...base,...next,team:other,otherTeam:team,otherActors:actors,saveAt,phase:next.phase,action:next.action,inPlay:true};}
   let ball=t<kickAt?mark:sampleBallFlight(mark,end,t-kickAt,duration,{loft:true});
   if(t>saveAt){const s=t-saveAt;ball=record.goal?[end[0]+d*.45*Math.sin(Math.min(1,s/.22)*Math.PI)*Math.exp(-s*2),Math.max(BALL_RADIUS,end[1]-4.905*s*s),end[2]+.12*(1-Math.exp(-s*3))]:rebound(s);}
   const extra=!record.goal?defence(t,options).actors:new Map();
   return {...base,ball,actors,otherActors:extra,otherTeam:other,shot:true,saveAt,phase:t<kickAt?'setup':t<saveAt?'shot':record.goal?'goal':'rebound',inPlay:t>=kickAt&&!(record.goal&&t>=saveAt),action:t<kickAt?'슈팅 준비':t<saveAt?'슈팅':record.goal?'득점 · 상대 팀 킥오프 준비':'선방 · 세컨드 볼 경합',fade:record.goal?ease(saveAt+2.1,saveAt+2.6,t):0};
 };
 restartSequences.set(record,{key,sample});return sample;
}
export function sampleRestartBall(t,record,start,options={}){return restartSequence(record,start)(t,options);}
