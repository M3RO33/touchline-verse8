const bound=(v,a,b)=>Math.max(a,Math.min(b,v));
const gap=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function pointSegmentDistance(point,start,end){
  const dx=end[0]-start[0],dz=end[1]-start[1],span=dx*dx+dz*dz,q=span?bound(((point[0]-start[0])*dx+(point[1]-start[1])*dz)/span,0,1):0;
  return {distance:gap(point,[start[0]+dx*q,start[1]+dz*q]),fraction:q};
}
/** Evaluate the actual corridor rather than choosing a numbered team mate. */
export function assessPassLane(start,end,opponents=[]){
  const lane=opponents.map(p=>({id:p.id,...pointSegmentDistance(p.position,start,end)})).filter(p=>p.fraction>.04&&p.fraction<.98).sort((a,b)=>a.distance-b.distance||String(a.id).localeCompare(String(b.id)));
  const closest=lane[0],clearance=closest?.distance??20;
  return {clearance,blocked:clearance<1.65,interceptor:closest?.id??null,risk:lane.reduce((sum,p)=>sum+bound((3.5-p.distance)/3.5,0,1)*(1-.3*Math.abs(.5-p.fraction)),0)};
}
export function selectPassOption({origin,options=[],opponents=[],direction=1,pressure=null,previousSender=null,variation=.5}={}){
  pressure??=Math.max(0,4-Math.min(20,...opponents.map(p=>gap(p.position,origin))));
  const ranked=options.filter(p=>gap(origin,p.receive)>2.7).map((p,i)=>{
    const lane=assessPassLane(origin,p.receive,opponents),space=Math.min(12,...opponents.map(o=>gap(o.position,p.receive))),progress=(p.receive[0]-origin[0])*direction,range=gap(origin,p.receive),width=Math.abs(p.receive[1]-origin[1]);
    const support=progress<0&&progress>-13?pressure*1.8:0,oneTwo=p.id===previousSender&&range<20?2.4:0;
    const score=progress*.26+space*.52+support+oneTwo+Math.min(25,width)*.055-range*.075-lane.risk*13-(range>36?(range-36)*.45:0)+Math.sin((i+1)*2.4+variation*6)*.12;
    return {...p,...lane,score,pressure,progress,space};
  }).sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id)));
  return ranked[0]??null;
}
/** Team shape follows possession: diagonal outlets, width, runs beyond the
 * carrier, a covering player and goal-side, distinct defensive assignments. */
export function tacticalTargets({roster,positions,ball,team,direction,owner=null}={}){
  const targets=new Map(),own=roster.filter(p=>p.team===team&&p.number!==1),defenders=roster.filter(p=>p.team!==team&&p.number!==1),used=new Set();
  const position=p=>positions.get(p.id)||[p.base.x,p.base.z],field=p=>[bound(p[0],-47.8,47.8),bound(p[1],-29,29)];
  const outlets=own.filter(p=>p.id!==owner).sort((a,b)=>gap(position(a),ball)-gap(position(b),ball));
  for(const p of own){
    const depth=p.base.x*direction,wide=Math.abs(p.base.z)>17,z=p.base.z*(wide?.92:.70)+ball[1]*(wide?.08:.24);
    let aim=[ball[0]+direction*(depth>0?10:depth>-20?2.5:-14),z];
    if(p.id===outlets[0]?.id)aim=[ball[0]-direction*6,ball[1]+(ball[1]>0?-6:6)];
    else if(p.id===outlets[1]?.id)aim=[ball[0]+direction*5,ball[1]+(ball[1]>0?-10:10)];
    if(depth<-25)aim[0]=bound(aim[0]*direction,-36,12)*direction;
    targets.set(p.id,field(aim));
  }
  const pressure=defenders.slice().sort((a,b)=>gap(position(a),ball)-gap(position(b),ball))[0];
  for(const p of defenders){
    if(p.id===pressure?.id){targets.set(p.id,field([ball[0]+direction*1.8,ball[1]+(position(p)[1]>ball[1]?1:-1)]));continue;}
    const choices=own.filter(a=>a.id!==owner&&!used.has(a.id)).sort((a,b)=>gap(position(a),position(p))-gap(position(b),position(p)));
    const mark=choices[0];if(mark)used.add(mark.id);
    const markPos=mark?(targets.get(mark.id)||position(mark)):[ball[0]+direction*9,p.base.z];
    const aim=[markPos[0]+direction*2.0,markPos[1]*.8+ball[1]*.2],backLine=ball[0]+direction*6;
    if(p.base.x*(-direction)<-25)aim[0]=Math.max(aim[0]*direction,backLine*direction)*direction;
    targets.set(p.id,field(aim));
  }
  for(const p of roster.filter(p=>p.number===1))targets.set(p.id,[p.base.x,bound(ball[1]*.12,-2.5,2.5)]);
  return targets;
}
