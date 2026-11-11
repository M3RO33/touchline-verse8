import {sampleLocomotion,sampleIdle,sampleKick,sampleDribble,kickBallPosition,blendPose,fitKickReach,localPoint,yawFor,ease,clamp,vecLerp,BALL_RADIUS} from './motion.mjs';
import {selectPassOption,assessPassLane,pointSegmentDistance,tacticalTargets} from './tactics.mjs';
import {samplePassPhysics,sampleLooseBall,separatePlayers} from './physics.mjs';

export const MATCH_SECONDS=300;
export const CLOCK_RATE=90/MATCH_SECONDS;
export const directionFor=(team,half=1)=>(team==='home'?1:-1)*(half===2?-1:1);
const other=team=>team==='home'?'away':'home';
const xy=p=>[p[0],p[2]];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const field=p=>[clamp(p[0],-47.8,47.8),clamp(p[1],-29.5,29.5)];
const limit=(a,b,max)=>{const q=Math.min(1,max/Math.max(.001,distance(a,b)));return a.map((v,i)=>v+(b[i]-v)*q);};
const velocity=p=>[(p.speed||0)*Math.sin(p.yaw||0),(p.speed||0)*Math.cos(p.yaw||0)];
const locations=[[-49,0],[-32,-23],[-31,-8],[-31,8],[-32,23],[-12,-21],[-15,0],[-12,21],[5,-18],[12,0],[5,18]];

export function flowRoster(half=1,removed=[]){
  return ['home','away'].flatMap(team=>locations.map(([x,z],i)=>({id:`${team}-${i+1}`,team,number:i+1,base:{x:x*directionFor(team,half),z}}))).filter(p=>!removed.includes(p.id));
}
export function kickoffFrame(roster,team='home',half=1){
  const actors=new Map();
  for(const p of roster){const d=directionFor(p.team,half),root=p.number===1?[p.base.x,p.base.z]:[Math.min(-2,p.base.x*d)*d,p.base.z];actors.set(p.id,sampleIdle(root,d*Math.PI/2));}
  const active=roster.filter(p=>p.team===team&&p.number!==1),owner=active.find(p=>p.number===10)||active[0],d=directionFor(team,half);
  if(owner)actors.set(owner.id,sampleIdle([-.66*d,-.105*d],d*Math.PI/2));
  actors.set('ref-0',sampleIdle([-5*d,7],d*Math.PI/2));
  return {ball:[0,BALL_RADIUS,0],actors,team,owner:owner?.id};
}

// Cubic root routes retain velocity at pass/receive waypoints. The constraints
// are shared by the ball and kick poses, so role changes don't relocate players.
function route(keys,initialVelocity=[0,0],finalVelocity=[0,0]){
  keys.sort((a,b)=>a.t-b.t);
  const unique=keys.filter((k,i)=>!i||k.t-keys[i-1].t>1e-5);
  const tangents=unique.map((k,i)=>{
    if(k.velocity)return k.velocity;
    if(!i)return initialVelocity;if(i===unique.length-1)return finalVelocity;
    const a=unique[i-1],b=unique[i+1],v=k.p.map((_,j)=>(b.p[j]-a.p[j])/(b.t-a.t)),speed=Math.hypot(...v);
    return v.map(x=>x*Math.min(1,6/Math.max(.001,speed)));
  });
  return t=>{
    if(t<=unique[0].t)return unique[0].p.map((x,j)=>x+(t-unique[0].t)*tangents[0][j]);
    const last=unique.length-1;if(t>=unique[last].t)return unique[last].p.map((x,j)=>x+(t-unique[last].t)*tangents[last][j]);
    let i=0;while(unique[i+1].t<t)i++;
    const a=unique[i],b=unique[i+1],span=b.t-a.t,q=(t-a.t)/span;
    return a.p.map((x,j)=>(2*q**3-3*q*q+1)*x+(q**3-2*q*q+q)*span*tangents[i][j]+(-2*q**3+3*q*q)*b.p[j]+(q**3-q*q)*span*tangents[i+1][j]);
  };
}
function translated(p,root){
  const delta=[root[0]-p.hip[0],0,root[1]-p.hip[2]],move=v=>v.map((x,i)=>x+delta[i]),r={...p,hip:move(p.hip),feet:p.feet.map(move)};
  for(const key of ['handTargets','elbowHints','kneeHints'])if(p[key])r[key]=p[key].map(move);
  return r;
}
const seeded=seed=>{let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};

/** A finite passage of football between referee reviews. It is sampled by time,
 * with real pass/shot trajectories, possession changes and an exact next-clip
 * endpoint. It doesn't decide infringements; the existing VAR clips do that. */
export function createMatchFlow({seed=1,id='flow',duration=25,half=1,roster=flowRoster(half),entry=kickoffFrame(roster,'home',half),target=null,targetVelocity=null,kickoff=false,allowGoal=true,continuation=false}={}){
  const rand=seeded(seed),finishRand=seeded(seed),tracks=new Map(),commands=[],events=[];
  // Finishing has its own deterministic stream. A tactical change need not
  // arbitrarily change the outcome of an otherwise identical shot.
  for(let i=0;i<8;i++)finishRand();
  for(const p of roster){const pose=entry.actors.get(p.id)||sampleIdle([p.base.x,p.base.z],directionFor(p.team,half)*Math.PI/2);tracks.set(p.id,[{t:0,p:xy(pose.hip),priority:2}]);}
  const active=team=>roster.filter(p=>p.team===team&&p.number!==1);
  const nearest=(team,point,excluded)=>active(team).filter(p=>p.id!==excluded).sort((a,b)=>distance(tracks.get(a.id).at(-1).p,point)-distance(tracks.get(b.id).at(-1).p,point))[0];
  const constrained=(who,t,p)=>{const prior=tracks.get(who).at(-1);let point=field(limit(prior.p,p,Math.max(.01,t-prior.t)*4.3));if(target&&target.actors.has(who))point=limit(xy(target.actors.get(who).hip),point,Math.max(0,duration-t)*4.4);return point;};
  const key=(who,t,p)=>{tracks.get(who).push({t,p:constrained(who,t,p),priority:2});};
  const reachable=(who,t,wanted)=>{const last=tracks.get(who).at(-1);return field(limit(last.p,wanted,Math.max(0,t-last.t)*4.3));};
  let team=entry.team||'home',owner=entry.owner||nearest(team,xy(entry.ball))?.id,root=xy(entry.ball),time=kickoff?1.25:continuation?.25:1.05,count=0,shot=null,reset=null,previousSender=null;
  const reserve=target?Math.min(9,Math.max(6,duration*.30)):continuation?0:2,normalEnd=Math.max(1.2,duration-reserve);
  const firstDirection=directionFor(team,half);
  let origin=xy(localPoint(root,firstDirection*Math.PI/2,-.66,0,-.105));
  key(owner,time,origin);
  while(time<normalEnd-(continuation?.7:2.2)&&count<10){
    const d=directionFor(team,half),last=tracks.get(owner).at(-1),shootingZone=last.p[0]*d>20&&Math.abs(last.p[1])<24||count>=5&&last.p[0]*d>13&&Math.abs(last.p[1])<15,canShoot=!shot&&count>=3&&time<normalEnd-3.2&&shootingZone;
    if(canShoot){
      const goalChance=.26+Math.max(-.12,Math.min(.20,(active(team).length-active(other(team)).length)*.06)),goal=allowGoal&&finishRand()<goalChance&&duration-time>10;
      const end=[(goal?53.5:50)*d,goal?.34:.62,(rand()-.5)*(goal?4:3)],at=time,flight=Math.max(.45,Math.hypot(end[0]-last.p[0],end[2]-last.p[1])/24),arrive=at+flight;
      shot={type:'shot',team,sender:owner,at,arrive,origin:last.p,end,goal,yaw:yawFor(end[0]-last.p[0],end[2]-last.p[1]),loft:true};commands.push(shot);events.push({id:id+'-shot',type:'shot',team,at});
      if(goal){events.push({id:id+'-goal',type:'goal',team,at:arrive});reset=arrive+2.6;break;}
      const defender=nearest(other(team),[end[0]-3*d,end[2]-2]),receiveAt=arrive+1.1,receive=reachable(defender.id,receiveAt,[end[0]-3.7*d,end[2]-2]);
      key(defender.id,receiveAt,receive);commands.push({type:'rebound',team:other(team),sender:owner,receiver:defender.id,at:arrive,arrive:receiveAt,origin:xy(end),receive,yaw:directionFor(other(team),half)*Math.PI/2,loft:true});
      team=other(team);owner=defender.id;root=receive;time=receiveAt+1.0;key(owner,time,field([root[0]+directionFor(team,half)*2,root[1]]));count++;shot.done=true;continue;
    }
    const variation=rand(),wide=variation>.48,desired=[last.p[0]+d*(kickoff&&count===0?-8:12+rand()*6),wide?(variation>.75?24:-24):(rand()-.5)*16];
    let travel=clamp(distance(last.p,desired)/16,.65,1.8),arrive=time+travel;
    const opponents=active(other(team)).map(p=>({id:p.id,position:tracks.get(p.id).at(-1).p}));
    const options=active(team).filter(p=>p.id!==owner).map(p=>{
      const current=tracks.get(p.id).at(-1).p,aim=field([desired[0]*.70+current[0]*.30,wide?p.base.z*.8+desired[1]*.2:current[1]*.45+desired[1]*.55]);
      return {id:p.id,receive:reachable(p.id,arrive,aim)};
    });
    const choice=selectPassOption({origin:last.p,options,opponents,direction:d,previousSender,variation})||options[0];
    if(!choice)break;
    const lane=assessPassLane(last.p,choice.receive,opponents),contestRoll=rand(),intercept=count>=1&&lane.clearance<6&&contestRoll<.50;
    const nextTeam=intercept?other(team):team,nextD=directionFor(nextTeam,half);
    const interceptor=intercept?opponents.slice().sort((a,b)=>pointSegmentDistance(a.position,last.p,choice.receive).distance-pointSegmentDistance(b.position,last.p,choice.receive).distance)[0]:null;
    const player=roster.find(p=>p.id===(interceptor?.id||choice.id));
    let receive=intercept?reachable(player.id,arrive,choice.receive):choice.receive;
    travel=clamp(distance(last.p,receive)/(wide?20:17),.55,2.25);arrive=time+travel;receive=reachable(player.id,arrive,receive);
    if(continuation&&arrive>duration-.12)break;
    const yaw=yawFor(receive[0]-last.p[0],receive[1]-last.p[1]),receiveYaw=nextD*Math.PI/2;
    key(player.id,arrive,receive);commands.push({type:intercept?'interception':Math.abs(receive[1]-last.p[1])>15?'switch':'pass',team,sender:owner,receiver:player.id,at:time,arrive,origin:last.p,receive,yaw,receiveYaw,loft:Math.abs(receive[1]-last.p[1])>15&&travel>1,tactic:choice.progress<0?'recycle':choice.id===previousSender?'one-two':wide?'width':'progress',laneClearance:lane.clearance,pressure:choice.pressure});
    if(intercept)events.push({id:id+'-turnover-'+count,type:'turnover',team:nextTeam,at:arrive});
    previousSender=owner;team=nextTeam;owner=player.id;const carry=.8+rand()*.55;time=arrive+carry;root=field([receive[0]+nextD*(1.9+rand()),receive[1]+(rand()-.5)*2]);key(owner,time,root);count++;
    if(shot?.done&&count>=6)break;
  }
  let future=null;
  if(reset){
    const nextEntry=kickoffFrame(roster,other(shot.team),half);
    future=createMatchFlow({seed:seed+7919,id:id+'-kickoff',duration:duration-reset,half,roster,entry:nextEntry,target,targetVelocity,kickoff:true,allowGoal:false});
    events.push(...future.events.map(e=>({...e,at:e.at+reset})));
  }else if(target){
    const arrive=duration-.55;let at=Math.max(time+.15,arrive-clamp(distance(root,xy(target.ball))/18,.65,2.4)),senderRoot;
    // The next clip starts with this player preparing the pass. Finish the
    // ordinary attack by feeding that same player, rather than cutting scenes.
    const nextTeam=target.team,targetOwner=target.owner||nearest(nextTeam,xy(target.ball))?.id,receivePose=target.actors.get(targetOwner),receive=xy(receivePose.hip);
    // Account for the sender's required exit location before timing this pass.
    // Using its old carry position could otherwise compress a 30m feed into a
    // sub-second flight while the whole team moves toward the next VAR clip.
    for(let i=0;i<5;i++){senderRoot=constrained(owner,at,field([root[0]+directionFor(team,half)*Math.min(7,Math.max(0,at-time)*2.8),root[1]]));at=Math.max(time+.15,arrive-clamp(distance(senderRoot,xy(target.ball))/22,.65,3.5));}
    senderRoot=constrained(owner,at,field([root[0]+directionFor(team,half)*Math.min(7,Math.max(0,at-time)*2.8),root[1]]));key(owner,at,senderRoot);key(targetOwner,arrive,receive);
    commands.push({type:nextTeam===team?'build':'interception',team,sender:owner,receiver:targetOwner,at,arrive,origin:senderRoot,receive,yaw:yawFor(target.ball[0]-senderRoot[0],target.ball[2]-senderRoot[1]),receiveYaw:receivePose.yaw??directionFor(nextTeam,half)*Math.PI/2,loft:distance(senderRoot,xy(target.ball))/(arrive-at)>10,end:target.ball,staging:true});
  }
  const endTime=reset||duration;
  for(const c of commands){
    if(c.type==='rebound')continue;
    const keys=tracks.get(c.sender),index=keys.findIndex(k=>Math.abs(k.t-c.at)<1e-6),a=keys[Math.max(0,index-1)],b=keys[Math.min(keys.length-1,index+1)];
    if(index<0||!a||!b)continue;
    const dx=b.p[0]-a.p[0],dz=b.p[1]-a.p[1],speed=Math.hypot(dx,dz),alignment=speed?(dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw))/speed:1;
    // A player feeding behind their running direction plants and pivots rather
    // than dragging the planted boot a metre behind a still-moving pelvis.
    if(alignment<-.35)keys[index].velocity=[0,0];
  }
  for(const p of roster){
    const keys=tracks.get(p.id);if(continuation)for(let i=keys.length-1;i>0;i--)if(keys[i].t>endTime)keys.splice(i,1);const start=keys[0].p;let desired=target&&!reset?xy(target.actors.get(p.id).hip):field([p.base.x+(team===p.team?directionFor(p.team,half)*5:0),p.base.z]);
    let exitVelocity=[0,0];
    if(continuation&&keys.length>1){const last=keys.at(-1),prior=keys.at(-2),span=Math.max(.01,last.t-prior.t);exitVelocity=last.p.map((v,i)=>(v-prior.p[i])/span);const speed=Math.hypot(...exitVelocity);exitVelocity=exitVelocity.map(v=>v*Math.min(1,5.4/Math.max(.001,speed)));desired=field(last.p.map((v,i)=>v+exitVelocity[i]*Math.max(0,endTime-last.t)));}
    else if(!target||reset){const last=keys.at(-1);desired=limit(last.p,desired,Math.max(0,endTime-last.t)*4.3);if(continuation)exitVelocity=desired.map((v,i)=>(v-start[i])/Math.max(.01,endTime));}
    if(!keys.some(k=>Math.abs(k.t-endTime)<.01))keys.push({t:endTime,p:desired,priority:2});
    // Fill off-ball runs, overlap and defensive cover between touch constraints.
    for(let t=4;t<endTime-2;t+=4){
      if(keys.some(k=>Math.abs(k.t-t)<2.4))continue;
      const c=commands.find(c=>c.at<=t&&c.arrive>=t)||commands.filter(c=>c.at<=t).at(-1)||commands[0],pos=c?.receive||c?.origin||root,own=p.team===(c?.team||team),d=directionFor(p.team,half);
      const positions=new Map(roster.map(a=>{const k=tracks.get(a.id);return [a.id,Array.isArray(k)?k.filter(v=>v.t<=t).sort((a,b)=>a.t-b.t).at(-1)?.p||[a.base.x,a.base.z]:k(t)];}));
      const possession=c&&t>=c.arrive&&c.receiver?c.receiver.split('-')[0]:c?.team||team,shape=tacticalTargets({roster,positions,ball:pos,team:possession,direction:directionFor(possession,half),owner:c?.receiver||c?.sender});
      let aim=shape.get(p.id)||[p.base.x,p.base.z];
      if(target&&!reset)aim=vecLerp(aim,desired,ease(duration-15,duration-5,t));
      const prior=keys.filter(k=>k.t<t).sort((a,b)=>a.t-b.t).at(-1),next=keys.filter(k=>k.t>t).sort((a,b)=>a.t-b.t)[0];
      aim=limit(prior.p,aim,(t-prior.t)*4.3);if(next)aim=limit(next.p,aim,(next.t-t)*4.4);
      keys.push({t,p:aim,priority:1});
    }
    const initial=entry.actors.get(p.id),lastVelocity=targetVelocity?.get(p.id)||exitVelocity;tracks.set(p.id,route(keys,initial?velocity(initial):[0,0],reset?[0,0]:lastVelocity));
  }
  for(const c of commands){
    c.path=tracks.get(c.sender);c.origin=c.path(c.at);c.pace=Math.max(2.8,Math.min(7,distance(c.path(c.at-.01),c.path(c.at+.01))/.02));c.start=c.type==='rebound'?shot.end:kickBallPosition(c.origin,c.yaw);
    if(c.receiver){c.receivePath=tracks.get(c.receiver);c.receive=c.receivePath(c.arrive);c.receivePace=Math.max(2.8,Math.min(7,distance(c.receivePath(c.arrive-.01),c.receivePath(c.arrive+.01))/.02));c.receiveYaw??=directionFor(c.receiver.split('-')[0],half)*Math.PI/2;c.end??=kickBallPosition(c.receive,c.receiveYaw);}
  }
  // Anticipate crossings from the complete routes. Each pair keeps one lateral
  // avoidance side through the encounter instead of exchanging push direction
  // after their centres cross, which would make a rendered player teleport.
  const collisionAxes=new Map(),collisionIds=roster.map(p=>p.id).sort();
  for(let i=0;i<collisionIds.length;i++)for(let j=i+1;j<collisionIds.length;j++){
    const a=tracks.get(collisionIds[i]),b=tracks.get(collisionIds[j]);let closest=Infinity,at=0;
    for(let t=.5;t<endTime-.5;t+=.2){const gap=distance(a(t),b(t));if(gap<closest){closest=gap;at=t;}}
    if(closest>1.0)continue;
    const ar=a(at),br=b(at),av=a(at+.025).map((v,k)=>v-a(at-.025)[k]),bv=b(at+.025).map((v,k)=>v-b(at-.025)[k]),relative=bv.map((v,k)=>v-av[k]),speed=Math.hypot(...relative);
    let axis=speed>.001?[-relative[1]/speed,relative[0]/speed]:[1,0];if((br[0]-ar[0])*axis[0]+(br[1]-ar[1])*axis[1]<0)axis=axis.map(v=>-v);
    collisionAxes.set(collisionIds[i]+'|'+collisionIds[j],axis);
  }
  const contactMobility=(id,t)=>1-commands.reduce((weight,c)=>Math.max(weight,c.sender===id?1-ease(.50,1.10,Math.abs(c.at-t)):0,c.receiver===id?1-ease(.50,1.10,Math.abs(c.arrive-t)):0),0);
  const avoidanceRate=30,avoidanceCount=Math.ceil(endTime*avoidanceRate)+1,rawAvoidance=new Map(collisionIds.map(id=>[id,[]])),avoidance=new Map();
  const idleHeadings=new Map();
  for(const p of roster){
    const path=tracks.get(p.id),angles=[];let heading=entry.actors.get(p.id)?.yaw??directionFor(p.team,half)*Math.PI/2;
    for(let frame=0;frame<avoidanceCount;frame++){
      const t=frame/avoidanceRate,a=path(t-.025),b=path(t+.025),dx=b[0]-a[0],dz=b[1]-a[1];
      if(Math.hypot(dx,dz)>.004){const desired=yawFor(dx,dz),delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));heading+=clamp(delta,-4.2/avoidanceRate,4.2/avoidanceRate);}
      angles.push(heading);
    }
    const idleYaw=t=>{const f=clamp(t*avoidanceRate,0,angles.length-1),i=Math.floor(f);return angles[i]+(angles[Math.min(i+1,angles.length-1)]-angles[i])*(f-i);};idleHeadings.set(p.id,idleYaw);path.idleYaw=idleYaw;
  }
  for(let frame=0;frame<avoidanceCount;frame++){
    const t=Math.min(endTime,frame/avoidanceRate),points=new Map(collisionIds.map(id=>[id,tracks.get(id)(t)])),mobility=new Map(roster.map(p=>[p.id,p.number===1?0:contactMobility(p.id,t)])),separated=separatePlayers(points,{mobility,axes:collisionAxes,onlyAxes:true,iterations:3});
    for(const id of collisionIds)rawAvoidance.get(id).push(separated.get(id).map((v,k)=>v-points.get(id)[k]));
  }
  // Anticipation and recovery spread contact response over a short symmetric
  // window. It is baked from route time, not accumulated by render frames.
  for(const id of collisionIds){const raw=rawAvoidance.get(id),smooth=raw.map((_,frame)=>{const out=[0,0];let total=0;for(let i=-5;i<=5;i++){const weight=6-Math.abs(i),p=raw[clamp(frame+i,0,raw.length-1)];out[0]+=p[0]*weight;out[1]+=p[1]*weight;total+=weight;}return out.map(v=>v/total);});avoidance.set(id,t=>{const frame=clamp(t*avoidanceRate,0,smooth.length-1),i=Math.floor(frame),a=smooth[i],b=smooth[Math.min(i+1,smooth.length-1)];return a.map((v,k)=>v+(b[k]-v)*(frame-i));});}
  const ballAt=t=>{
    if(future&&t>=reset)return future.sample(t-reset,{ballOnly:true}).ball;
    let c=commands.filter(c=>c.at<=t).at(-1),next=commands.find(c=>c.at>t);
    if(!c){const first=commands[0];return first?vecLerp(entry.ball,first.start,ease(0,first.at,t)):entry.ball.slice();}
    if(t<=c.arrive)return samplePassPhysics(c.start,c.end,t-c.at,c.arrive-c.at,{loft:c.loft,radius:BALL_RADIUS});
    if(c.type==='shot'&&c.goal)return sampleLooseBall(c.end,[0,0,0],t-c.arrive,{radius:BALL_RADIUS}).position;
    if(target&&!reset&&c===commands.at(-1))return vecLerp(c.end,target.ball,ease(c.arrive,duration,t));
    const receive=sampleKick(c.receive,c.receiveYaw,t,c.arrive,{receiving:true,path:c.receivePath,pace:c.receivePace}),carry=sampleDribble(c.receivePath,t,{touchOffset:c.arrive,pace:c.receivePace}),v=t-c.arrive;
    let ball=vecLerp(receive.ball,carry.ball,ease(.16,.48,v));if(next)ball=vecLerp(ball,next.start,ease(next.at-.55,next.at-.02,t));return ball;
  };
  const initialRef=entry.actors.get('ref-0'),endRef=target?.actors.get('ref-0'),refMiddle=ballAt(endTime*.5),refStart=initialRef?xy(initialRef.hip):[-5,7],middleAim=[refMiddle[0]*.48-5,clamp(refMiddle[2]*.45+6,-25,25)],refMid=continuation?limit(refStart,middleAim,endTime*.5*4.3):middleAim,endAim=endRef&&!reset?xy(endRef.hip):[root[0]*.48-5,6],refEnd=continuation?limit(refMid,endAim,endTime*.5*4.3):endAim;
  const refPath=route([{t:0,p:refStart},{t:endTime*.5,p:refMid},{t:endTime,p:refEnd}],initialRef?velocity(initialRef):[0,0],targetVelocity?.get('ref-0')||[0,0]);
  function sample(t,{ballOnly=false}={}){
    t=clamp(t,0,duration);
    if(future&&t>=reset){const p=future.sample(t-reset,{ballOnly});return {...p,fade:Math.max(p.fade,1-ease(reset,reset+.55,t)),phase:t<reset+1.25?'kickoff':p.phase};}
    const current=commands.filter(c=>c.at<=t).at(-1),next=commands.find(c=>c.at>t),ball=ballAt(t),actors=new Map();
    if(!ballOnly)for(const p of roster){
      const path=tracks.get(p.id),root=path(t),phase=p.number*.137,run=sampleLocomotion(path,t,{phase,pace:5.4}),walk=sampleLocomotion(path,t,{phase,pace:1.5}),speed=run.speed||0;let state=blendPose(sampleIdle(root,idleHeadings.get(p.id)(t),t),walk,ease(.08,.8,speed));state=blendPose(state,run,ease(1.6,3.1,speed));
      const out=commands.filter(c=>c.sender===p.id&&c.type!=='rebound'&&Math.abs(c.at-t)<.85).sort((a,b)=>Math.abs(a.at-t)-Math.abs(b.at-t))[0],incoming=commands.filter(c=>c.receiver===p.id&&Math.abs(c.arrive-t)<.8).sort((a,b)=>Math.abs(a.arrive-t)-Math.abs(b.arrive-t))[0];
      if(current?.receiver===p.id&&!current.staging&&t>current.arrive+.15){const carryWeight=ease(current.arrive+.15,current.arrive+.5,t)*(next?1-ease(next.at-.65,next.at-.45,t):1);state=blendPose(state,sampleDribble(path,t,{touchOffset:current.arrive,phase,pace:current.receivePace}).pose,carryWeight);}
      if(incoming&&!incoming.staging&&Math.abs(t-incoming.arrive)<.8){const kick=sampleKick(incoming.receive,incoming.receiveYaw,t,incoming.arrive,{receiving:true,path,phase:p.number*.137,pace:incoming.receivePace});state=blendPose(state,kick.pose,ease(incoming.arrive-.8,incoming.arrive-.5,t)*(1-ease(incoming.arrive+.45,incoming.arrive+.8,t)));}
      if(out&&Math.abs(t-out.at)<.85){const kick=sampleKick(out.origin,out.yaw,t,out.at,{path,pace:out.pace,phase:p.number*.137,technique:out.type==='shot'?'drive':out.loft?'loft':'inside',power:out.type==='shot'?1.2:1});state=blendPose(state,kick.pose,ease(out.at-.85,out.at-.55,t)*(1-ease(out.at+.45,out.at+.85,t)));}
      if(shot&&p.team!==shot.team&&p.number===1&&t>shot.at-.3&&t<shot.arrive+2.4){const q=ease(shot.at,shot.arrive+.08,t),d=directionFor(shot.team,half),save=sampleIdle([49.3*d,shot.end[2]*q],-d*Math.PI/2,t);save.hip[1]=.88-.53*q;save.roll=-q*1.1;save.lean=.15;save.armPose='save';state=blendPose(state,save,ease(shot.at-.3,shot.at+.05,t)*(1-ease(shot.arrive+.7,shot.arrive+2.4,t)));}
      const initial=entry.actors.get(p.id);if(initial&&t<.8)state=blendPose(translated(initial,root),state,ease(0,.8,t));
      if(target&&!reset&&t>duration-.85){const final=target.actors.get(p.id);state=blendPose(state,translated(final,root),ease(duration-.85,duration,t));}
      fitKickReach(state);actors.set(p.id,state);
    }
    if(!ballOnly){
      const weight=ease(.8,1.6,t)*(1-ease(endTime-1.6,endTime-.8,t));
      for(const [id,pose] of actors){const before=xy(pose.hip),delta=avoidance.get(id)(t),root=before.map((v,i)=>v+delta[i]*weight*contactMobility(id,t));actors.set(id,translated(pose,root));}
      let ref=sampleLocomotion(refPath,t,{phase:.35,pace:3.8});const initial=entry.actors.get('ref-0');if(initial&&t<.8)ref=blendPose(translated(initial,refPath(t)),ref,ease(0,.8,t));if(target&&!reset&&t>duration-.85)ref=blendPose(ref,translated(target.actors.get('ref-0'),refPath(t)),ease(duration-.85,duration,t));actors.set('ref-0',ref);
    }
    let ownerTeam=current?(t>=current.arrive&&current.receiver?current.receiver.split('-')[0]:current.team):entry.team;
    const phase=current?.type==='shot'?(t<current.arrive?'shot':current.goal?'goal':'save'):current&&t<current.arrive?current.type:next?'carry':'build';
    const labels={shot:'슈팅',goal:'득점',save:'골키퍼 선방',rebound:'세컨드 볼 · 역습 전개',interception:t>=current?.arrive?'패스 차단 · 역습':'패스 경합',switch:'측면 전환',pass:'패스 전개',carry:'볼 컨트롤 · 동료 지원',build:'공격 전개'};
    if(!ballOnly&&t===0)for(const [who,pose] of entry.actors)if(actors.has(who))actors.set(who,pose);
    if(!ballOnly&&target&&!reset&&t===duration)for(const [who,pose] of target.actors)actors.set(who,pose);
    return {ball,actors,team:ownerTeam,phase,action:kickoff&&t<1.25?'킥오프':labels[phase]||'공격 전개',inPlay:phase!=='goal'&&!(kickoff&&t<1.25),fade:reset?ease(reset-.45,reset,t):0,goal:phase==='goal'?shot.team:null,done:t>=duration};
  }
  return {id,duration,commands,events,sample,paths:tracks};
}

export function applyFlowEvents(match,flow,time){
  match.flowEventIds??=[];match.openPlayStats??={shots:{home:0,away:0},goals:{home:0,away:0},turnovers:0};
  const fresh=[];
  for(const e of flow.events){if(e.at>time||match.flowEventIds.includes(e.id))continue;match.flowEventIds.push(e.id);fresh.push(e);if(e.type==='goal'){match.score[e.team]++;match.openPlayStats.goals[e.team]++;}else if(e.type==='shot')match.openPlayStats.shots[e.team]++;else if(e.type==='turnover')match.openPlayStats.turnovers++;}
  return fresh;
}
