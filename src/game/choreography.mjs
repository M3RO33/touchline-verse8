export const CLIP_LENGTH=6.4;
import {JERSEY_GRIP_ANCHOR} from './athlete-anchors.mjs';
import {sampleLocomotion,sampleKick,sampleDribble,sampleIdle,blendPose,localPoint,yawFor,vecLerp,sampleBallFlight,sampleSlideTackle,sampleFoulReaction,fitKickReach,recoil,ease} from './motion.mjs';
export const LIVE_LEAD_IN=0;
export const TOE_LENGTH=.245;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,v)=>{const q=clamp((v-a)/(b-a));return q*q*(3-2*q);};
export const mix=(a,b,t)=>a+(b-a)*t;
const lerp3=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
export function playbackState(e,elapsed){
 const clipTime=clamp(elapsed-LIVE_LEAD_IN,0,e.stoppageAt);
 return {clipTime,contact:clipTime>=e.moment,whistled:clipTime>=e.whistleAt,stopped:elapsed>=LIVE_LEAD_IN+e.stoppageAt};
}
export function contactPoint(e){
 const height=e.type==='handball'?1.22:e.type==='holding'?1.20:e.type==='dangerous'?1.48:e.type==='serious'?.58:e.type==='reckless'?.33:.11;
 return [e.worldX,height,e.worldZ+.13];
}
// Integrate a smooth deceleration so an athlete never teleports when the whistle sounds.
const stoppedTravel=(v,stop,duration=.55)=>{if(v<=stop)return v;const q=clamp((v-stop)/duration);return stop+duration*(q-q**3+.5*q**4);};
export function sampleReferee(e,t,lateral=3.4){
 const stop=e.whistleAt-e.moment-.25,path=tt=>{const v=stoppedTravel(tt-e.moment,stop),p=localPoint([e.worldX,e.worldZ],e.dir*Math.PI/2,-4.3+v*3.3,0,-lateral*e.dir);return [p[0],p[2]];},root=path(t),run=sampleLocomotion(path,t,{pace:3.3,phase:.35}),standing=sampleIdle(root,e.dir*Math.PI/2,t),state=blendPose(run,standing,smooth(e.whistleAt-.25,e.whistleAt+.30,t));
 state.headYaw=.5;state.headPitch=-.08;state.gesture='whistle';state.gestureWeight=smooth(e.whistleAt-.22,e.whistleAt+.05,t);state.action=t<e.whistleAt?'플레이를 따라가는 주심':'휘슬 / 경기 중단 신호';return state;
}
export function sampleSupportingPlayer(e,player,t,ball){
 const {team,number,base}=player,attack=team===e.attack,d=e.dir,offside=['offside','onside'].includes(e.type),u=t-e.moment,w=e.whistleAt-e.moment;
 if(number===1){const root=[base.x,base.z+clamp(ball[2]-base.z,-3,3)*.35],yaw=yawFor(ball[0]-root[0],ball[2]-root[1]),p=sampleIdle(root,yaw,t);p.hip[1]=.80;p.lean=.18;p.gesture='ready';p.gestureWeight=1;p.action='골키퍼 준비 자세';return p;}
 const near=number===6||number===8||number===11,channel=number===11?6:number===8?-4:2.8,initial=offside?(attack?-12-(number%4)*4:-8-(number%4)*3):near?(attack?-5-(number%3)*3:4+(number%3)*3):base.x*d-e.worldX*d;
 const lateral=near?channel:base.z-e.worldZ,speed=near?(attack?3.4:2.6):1.4,stop=w+.10+(number%3)*.10;
 const path=tt=>{const v=tt-e.moment,travel=stoppedTravel(v,stop),approach=near&&!offside?1-Math.exp(-Math.max(0,v-stop-.55)/.8):0,s=initial+travel*speed+(attack?1.2:-.5)*approach,z=lateral+(attack?-1:1)*Math.sign(lateral)*Math.min(1.4,Math.abs(lateral)*.2)*approach;return [e.worldX+s*d,e.worldZ+z];};
 const root=path(t),run=sampleLocomotion(path,t,{pace:speed,phase:number*.137}),idle=sampleIdle(root,d*Math.PI/2,t),state=blendPose(run,idle,smooth(stop,stop+.65,u)),target=u>0?[e.worldX,e.worldZ]:[ball[0],ball[2]],look=yawFor(target[0]-root[0],target[1]-root[1]);state.headYaw=clamp(Math.atan2(Math.sin(look-state.yaw),Math.cos(look-state.yaw)),-.65,.65);state.headPitch=-.04;
 if(u<-.8&&attack)state.headYaw+=.24*Math.sin(t*3+number);
 state.role=attack?(number===11?'측면 침투':number===8?'패스 지원':'공격 대형 유지'):(near?'패스 경로 커버':'수비 대형 유지');
 if(u>w+.15&&near){state.gesture=attack&&number===6?'appeal':attack?'observe':number===8?'acknowledge':'observe';state.gestureWeight=smooth(w+.15,w+.70,u);state.action=attack&&number===6?'피해 선수와 주심을 보며 항의':'휘슬에 감속하며 상황 확인';}return state;
}
export function sampleFormationPlayer(player,t,team,sampleBall,half=1){
 const {number,base}=player,d=(team==='home'?1:-1)*(half===2?-1:1),attack=player.team===team;
 const path=tt=>{const b=sampleBall(tt),shift=clamp(b[0],-20,25)*(attack?.18:.12),zshift=clamp(b[2],-15,15)*.12;return [base.x+shift+(attack?d*3:0),base.z+zshift];},root=path(t),ball=sampleBall(t),yaw=yawFor(ball[0]-root[0],ball[2]-root[1]);
 if(number===1){const p=sampleIdle(root,yaw,t);p.hip[1]=.80;p.lean=.15;p.gesture='ready';p.gestureWeight=1;return p;}
 const p=sampleLocomotion(path,t,{pace:1.4,phase:number*.13}),idle=sampleIdle(root,yaw,t),q=1-smooth(.05,.65,p.speed||0),state=blendPose(p,idle,q);state.headYaw=clamp(yaw-state.yaw,-.6,.6);return state;
}
export function sampleIncident(e,t){
 if(['handball','holding','dangerous','dive'].includes(e.type))return sampleNewIncident(e,t);
 const u=t-e.moment,d=e.dir,x=e.worldX,z=e.worldZ;
 const point=(s,y,lateral)=>[x+s*d,y,z+lateral];
 const pose=(s,h,lateral,feet,lean=0)=>({hip:point(s,h,lateral),heading:d,feet:feet.map(v=>point(...v)),lean,armPhase:t*9,footPitch:[0,0]});
 const contact=contactPoint(e);
 const worldPath=fn=>tt=>{const p=fn(tt-e.moment);return [x+p[0]*d,z+p[1]];};
 const worldRoot=(s,lateral)=>[x+s*d,z+lateral];
 let attacker,defender,ball,passer=null,runner=null;
 if(['offside','onside'].includes(e.type)){
   const attackPath=worldPath(v=>[e.offset+v*5.6,0]);attacker=sampleLocomotion(attackPath,t,{pace:5.6,phase:.18});
   const defendPath=worldPath(v=>[v*2.8,3.5]);defender=sampleLocomotion(defendPath,t,{pace:2.8,phase:.3});
   const flight=1.45,p=-15,root=worldRoot(p,-7),target=localPoint(attackPath(e.moment+flight),d*Math.PI/2,.62,.115,.105),yaw=yawFor(target[0]-root[0],target[2]-root[1]),carryPath=tt=>[root[0]+Math.sin(yaw)*3.6*(tt-e.moment),root[1]+Math.cos(yaw)*3.6*(tt-e.moment)],kick=sampleKick(root,yaw,t,e.moment,{power:1.2,path:carryPath,technique:'loft'});passer=kick.pose;
   const carry=sampleDribble(carryPath,t,{pace:3.6});
   ball=u<0?vecLerp(carry.ball,kick.ball,smooth(-.60,-.07,u)):sampleBallFlight(kick.ball,target,u,flight,{loft:true});
   if(u>flight){const control=sampleDribble(attackPath,t,{pace:5.6,touchOffset:e.moment+flight});ball=vecLerp(target,control.ball,smooth(flight,flight+.18,u));}
   const referee=sampleReferee(e,t,6);return {attacker,defender,passer,runner,ball,contact:point(e.offset,.1,0),referee};
 }
 if(e.type==='referee'){
   const origin=worldRoot(-8,-2),hit=point(0,.30,0),yaw=yawFor(hit[0]-origin[0],hit[2]-origin[1]),kick=sampleKick(origin,yaw,t,e.moment-.55,{technique:'inside'});attacker=kick.pose;
   defender=sampleIdle(worldRoot(4,-3),-d*Math.PI/2,t);
   const q=clamp((u+.55)/.55);ball=u<-.55?kick.ball:u<=0?vecLerp(kick.ball,hit,q):point(u*5.6,.30+u*1.5-4.905*u*u,-u*3.3);ball[1]=Math.max(.115,ball[1]);
   const referee=pose(0,.94,0,[[.16,.1,.13],[-.25,.1,-.13]]);referee.armPose=t>=e.whistleAt-.15?'whistle':'observe';return {attacker,defender,passer,runner,ball,contact:point(0,.30,0),referee};
 }
 const isAdvantage=e.type==='advantage',attackPath=worldPath(v=>[-.20+Math.min(0,v)*4.8,0]);
 attacker=sampleFoulReaction([x,z],d*Math.PI/2,t,e.moment,e.type);
 const ballTouch=e.type==='clean'?-.32:0;
 const targetHeight=e.type==='serious'?.58:e.type==='reckless'?.33:.11;
 const pitch=e.type==='serious'?-1.05:e.type==='reckless'?-.35:0;
 const goalX=e.type==='clean'?.54-.115:0,goalZ=e.type==='clean'?-.22:.13;
 defender=sampleSlideTackle(point(goalX,targetHeight,goalZ),d*Math.PI/2,t,e.moment+ballTouch,{pitch,reaction:e.type});
 // A ball-first challenge moves the ball 320 ms before the leg contact; a foul leaves it untouched.
 const ballStart=[.54,.115,-.22];
 if(u<ballTouch)ball=point(ballStart[0]+Math.min(0,u+(e.type==='clean'?.32:.25))*1.45,.115,ballStart[2]);
 else if(e.type==='clean'){const q=u-ballTouch,h=.115+2.4*q-4.905*q*q;ball=point(.54+q*7.6,Math.max(.115,h),-.22-q*4.4);}
 else if(isAdvantage){const q=Math.max(0,u-.12);ball=point(.54+q*7.2,.115,-.22-Math.min(3,q*2.6));}
 else ball=point(.54+Math.max(0,u)*3.6,.115,-.22-Math.max(0,u)*.35);
 const receiveTime=e.moment-2.8,loft=e.type==='reckless'||e.type==='serious',passTime=receiveTime-(loft?1.42:.85),origin=worldRoot(-23,-7),receive=localPoint(attackPath(receiveTime),d*Math.PI/2,.62,.115,.105),yaw=yawFor(receive[0]-origin[0],receive[2]-origin[1]),kick=sampleKick(origin,yaw,t,passTime,{technique:loft?'loft':'inside'});passer=kick.pose;
 if(u<-2.8)ball=t<passTime?kick.ball:sampleBallFlight(kick.ball,receive,t-passTime,receiveTime-passTime,{loft});
 else if(u<-.12){const dribble=sampleDribble(attackPath,t,{pace:4.8,phase:.2,touchOffset:receiveTime});if(u<-.25)ball=vecLerp(dribble.ball,ball,e.type==='clean'?smooth(-.85,-.55,u):smooth(-.55,-.25,u));attacker=blendPose(dribble.pose,attacker,smooth(-.48,-.12,u));}
 if(isAdvantage){const runPath=worldPath(v=>[3+(v-.12)*6.2,-3]);runner=sampleLocomotion(runPath,t,{pace:6.2,phase:.25});}
 fitKickReach(attacker);const referee=sampleReferee(e,t,3.4);
 return {attacker,defender,passer,passerNumber:7,runner,ball,contact,referee};
}

// Evidence-first clips: arm contact, a shirt pull, a high boot with no body
// contact, and a separated defender. None reuse a sliding-tackle offender.
function rotateXYZPoint(point,x=0,y=0,z=0){
 let [a,b,c]=point;[a,b]=[a*Math.cos(z)-b*Math.sin(z),a*Math.sin(z)+b*Math.cos(z)];[a,c]=[a*Math.cos(y)+c*Math.sin(y),-a*Math.sin(y)+c*Math.cos(y)];[b,c]=[b*Math.cos(x)-c*Math.sin(x),b*Math.sin(x)+c*Math.cos(x)];return [a,b,c];
}
function jerseyGripPoint(p){
 // The jersey follows the leaning, twisting spine rather than a hip-only offset.
 const point=[0,0,0];
 for(const term of JERSEY_GRIP_ANCHOR){let local=term.local.slice();if(term.bone===2){local=rotateXYZPoint(local,p.chestPitch||0,p.chestYaw??-(p.twist||0)*.35,p.chestRoll||0);local[1]+=.23;}if(term.bone>=1){local=rotateXYZPoint(local,p.spinePitch||0,p.spineYaw??p.twist??0,p.spineRoll||0);local[1]+=.18;}const body=rotateXYZPoint(local,p.lean||0,p.pelvisYaw||0,p.roll||0),world=rotateXYZPoint(body,0,p.yaw||0,0);for(let i=0;i<3;i++)point[i]+=(world[i]+p.hip[i])*term.weight;}
 return point;
}
export function sampleNewIncident(e,t){
 const u=t-e.moment,d=e.dir,x=e.worldX,z=e.worldZ,yaw=d*Math.PI/2,point=(s,h,l=0)=>[x+s*d,h,z+l],root=(s,l=0)=>[x+s*d,z+l],path=fn=>tt=>{const p=fn(tt-e.moment);return root(p[0],p[1]);};
 let attacker,defender,ball,contact,evidence;
 if(e.type==='handball'){
  contact=point(0,1.22,.13);const target=point(-.115,1.22,.13),origin=root(-12,-4.5),kickYaw=yawFor(target[0]-origin[0],target[2]-origin[1]),kick=sampleKick(origin,kickYaw,t,e.moment-.82,{technique:'loft',power:1.05});attacker=kick.pose;
  defender=sampleIdle(root(.25,.60),-yaw,t);defender.lean=.055;defender.chestYaw=-.08;defender.headYaw=.28;defender.armRotations=[[-.45,0,.5],[-.75,0,-.7]];defender.elbowAngles=[-.75,-.22];
  const raised=smooth(-.55,-.08,u)*(1-smooth(.18,.65,u)),hand=d===1?0:1;defender.handTargets=hand===0?[contact,point(.22,1.12,1.05)]:[point(.22,1.12,1.05),contact];defender.elbowHints=hand===0?[point(.32,1.35,.20),point(.40,1.30,.99)]:[point(.40,1.30,.99),point(.32,1.35,.20)];defender.handWeight=raised;defender.grip=.06;defender.spinePitch=recoil(u,.065,.22,.35);defender.headPitch=-.06+recoil(u-.07,.07,.27,.40);defender.action=u<0?'크로스를 막으며 팔을 벌림':u<.18?'손에 맞아 공이 굴절됨':'팔을 내리며 주심 확인';
  ball=u<-.82?kick.ball:u<=0?sampleBallFlight(kick.ball,target,u+.82,.82,{loft:true}):point(-.115-u*3.8,Math.max(.115,1.22+.8*u-4.905*u*u),.13+u*5.5);
  const palmPitch=-.08-(Math.PI/2-.08)*raised;defender.wristPitch=hand===0?[palmPitch,-.08]:[-.08,palmPitch];
  evidence={kind:'arm-ball',bodyContact:true,hand,handTarget:contact.slice()};
 }else if(e.type==='holding'){
  const travel=v=>v<=0?4.6*v:.52*(1-Math.exp(-v/(.52/4.6)))+1.35*(v-.22*(1-Math.exp(-v/.22))),attPath=path(v=>[travel(stoppedTravel(v,e.whistleAt-e.moment-.15,.6)),0]),defPath=tt=>{const p=attPath(tt);return [p[0]-.58*d,p[1]+.48];};
  attacker=sampleLocomotion(attPath,t,{pace:4.6,phase:.20});const tug=Math.sin(clamp(u/.62)*Math.PI),tension=smooth(-.16,-.02,u)*(1-smooth(.35,.62,u));attacker.lean-=tug*.17;attacker.spinePitch-=tug*.09;attacker.chestYaw+=tug*.14;attacker.roll+=tug*.09;attacker.hip[1]-=tug*.075;attacker.headYaw=.55*smooth(.06,.45,u);attacker.armSwing+=tug*.24;attacker.pain=tug*.12;attacker.shirtTug=tension;attacker.action=u<0?'수비수 옆으로 달리는 공격수':u<.30?'유니폼이 당겨져 즉시 뒤로 균형 이동':u<.65?'발을 다시 딛고 균형 회복':'주심을 돌아보며 항의';
  defender=sampleLocomotion(defPath,t,{pace:4.6,phase:.30});contact=jerseyGripPoint(attacker);const dr=[defender.hip[0],defender.hip[2]],hand=d===1?1:0,freeHand=localPoint(dr,yaw,.13,1.0,d*.36),freeElbow=localPoint(dr,yaw,.10,1.22,d*.44),holdingElbow=localPoint(dr,yaw,.25,1.25,-d*.20);defender.handTargets=hand===0?[contact,freeHand]:[freeHand,contact];defender.elbowHints=hand===0?[holdingElbow,freeElbow]:[freeElbow,holdingElbow];defender.handWeight=smooth(-.55,-.06,u)*(1-smooth(.36,.63,u));defender.grip=.95;defender.headYaw=-.30;defender.action=u<.36?'손으로 상대 유니폼을 잡아당김':'유니폼을 놓고 손을 거둠';
  const dribble=sampleDribble(attPath,t,{pace:4.6,phase:.2});ball=u<0?dribble.ball:point(.62+u*4.6,.115,-.20-u*.28);evidence={kind:'jersey-pull',bodyContact:true,hand,handTarget:contact.slice()};
 }else if(e.type==='dangerous'){
  const attPath=path(v=>[.62+stoppedTravel(v,-.07,.55)*3.7,-.05]);attacker=sampleLocomotion(attPath,t,{pace:3.7,phase:.20});const duck=smooth(-.11,.14,u)*(1-smooth(.35,.85,u));attacker.hip[1]-=duck*.10;attacker.lean-=duck*.14;attacker.chestPitch+=duck*.08;attacker.headPitch+=duck*.28;attacker.armSwing+=duck*.22;attacker.headYaw=-.28;attacker.action=u<-.10?'높은 공을 향해 접근':'머리 가까이 올라온 발을 피해 상체를 젖힘';
  const dr=root(0,.45),standing=sampleIdle(dr,yaw,t),lift=smooth(-.48,-.035,u)*(1-smooth(.10,.58,u));defender={...standing,hip:[dr[0],.87,dr[1]],feet:standing.feet.map(v=>v.slice())};defender.feet[0]=vecLerp(standing.feet[0],point(.50,1.48,.45),lift);defender.footPitch=[0,0];defender.lean=-.17*lift;defender.spinePitch=.05*lift;defender.armRotations=[[.05,0,.75*lift+.09],[-.5*lift,0,-.60*lift-.09]];defender.elbowAngles=[-.55,-.70];defender.kneeHints=[point(.52,1.30,.56),point(.25,.43,.34)];defender.headPitch=-.12*lift;defender.action=u<0?'골반 높이에서 발을 머리 높이로 올림':'상대와 접촉 없이 높은 발을 회수';
  contact=point(.745,1.48,.45);const target=point(.86,1.48,.45);ball=u<-.68?point(-3.1+(u+.68)*5.8,Math.max(.115,1.3-(u+.68)*.3),.45):u<=0?sampleBallFlight(point(-3.1,1.3,.45),target,u+.68,.68,{loft:true}):point(.86+u*6.5,Math.max(.115,1.48+u*2.2-4.905*u*u),.45+u*1.7);
  evidence={kind:'high-boot',bodyContact:false,raisedFoot:0};fitKickReach(defender);
 }else{
  attacker=sampleFoulReaction([x,z],yaw,t,e.moment,'careless');attacker.pain=0;attacker.action=u<0?'드리블 돌파':u<.38?'수비수와 닿지 않고 스스로 넘어짐':'손을 들고 주심에게 반칙을 주장';
  const defPath=path(v=>[-.15+stoppedTravel(v,-.10,.65)*3.5,1.6]);defender=sampleLocomotion(defPath,t,{pace:3.5,phase:.35});defender.gesture='appeal';defender.gestureWeight=smooth(-.05,.30,u);defender.headYaw=-.6;defender.action=u<0?'거리를 두고 공격수를 따라감':'접촉하지 않았음을 양손으로 표시';
  ball=point(.54+u*4.8,.115,-.20-u*.16);contact=point(-.20,.5,0);evidence={kind:'simulation',bodyContact:false};
 }
 fitKickReach(attacker);fitKickReach(defender);return {attacker,defender,ball,contact,referee:sampleReferee(e,t,3.4),evidence};
}
