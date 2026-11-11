const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const GRAVITY=9.81;
export const PLAYER_GAP=.76;
/** Analytic endpoint-constrained pass. Ground friction reduces pace throughout
 * the trip; airborne passes use downward gravity, with exact contact endpoints. */
export function samplePassPhysics(start,end,time,duration,{loft=false,friction=1.15,radius=.11}={}){
  const T=Math.max(.001,duration),q=clamp(time/T,0,1),distance=Math.hypot(end[0]-start[0],end[2]-start[2]),deceleration=loft?0:Math.min(.24,friction*T*T/(2*Math.max(.001,distance))),travel=q+deceleration*q*(1-q),point=start.map((v,i)=>v+(end[i]-v)*travel);
  point[1]=Math.max(radius,start[1]+(end[1]-start[1])*q+(loft?.5*GRAVITY*T*T*q*(1-q):0));
  return point;
}
/** Free-ball rebound is sampled from initial conditions, never integrated from
 * the previous render frame, so scrubbing cannot alter the result. */
export function sampleLooseBall(start,velocity,time,{radius=.11,restitution=.42,friction=1.15}={}){
  let t=Math.max(0,time),y=Math.max(radius,start[1]),vy=velocity[1],bounces=0;
  for(let i=0;i<16;i++){
    const impact=(vy+Math.sqrt(vy*vy+2*GRAVITY*Math.max(0,y-radius)))/GRAVITY;
    if(t<=impact||impact<1e-7&&Math.abs(vy)<.015){y=Math.max(radius,y+vy*t-.5*GRAVITY*t*t);break;}
    t-=impact;vy=Math.sqrt(vy*vy+2*GRAVITY*Math.max(0,y-radius))*restitution;y=radius;bounces++;
    if(vy<.015){y=radius;break;}
  }
  const horizontal=Math.hypot(velocity[0],velocity[2]),elapsed=Math.max(0,time),drag=Math.max(.001,friction),travel=horizontal?horizontal*Math.min(elapsed,horizontal/drag)-.5*drag*Math.min(elapsed,horizontal/drag)**2:0;
  return {position:[start[0]+(horizontal?velocity[0]/horizontal*travel:0),y,start[2]+(horizontal?velocity[2]/horizontal*travel:0)],bounces};
}
/** Deterministic two-dimensional contact solver. Pinned kickers/receivers have
 * zero mobility; the remaining players share separation by inverse mass. */
export function separatePlayers(points,{minimumGap=PLAYER_GAP,mobility=new Map(),axes=new Map(),onlyAxes=false,iterations=5}={}){
  const ids=[...points.keys()].sort(),result=new Map(ids.map(id=>[id,points.get(id).slice()]));
  for(let pass=0;pass<iterations;pass++)for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    if(onlyAxes&&!axes.has(ids[i]+'|'+ids[j]))continue;
    const a=result.get(ids[i]),b=result.get(ids[j]),dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz),wa=mobility.get(ids[i])??1,wb=mobility.get(ids[j])??1,total=wa+wb;
    if(distance>=minimumGap||total===0)continue;
    const axis=axes.get(ids[i]+'|'+ids[j]),nx=axis?.[0]??(distance>1e-7?dx/distance:1),nz=axis?.[1]??(distance>1e-7?dz/distance:0),tangent=dx*nz-dz*nx,penetration=axis?Math.min((minimumGap-distance)*1.5,Math.max(0,Math.sqrt(Math.max(0,minimumGap**2-tangent*tangent))-(dx*nx+dz*nz))):minimumGap-distance,denominator=Math.max(1,total);
    a[0]-=nx*penetration*wa/denominator;a[1]-=nz*penetration*wa/denominator;b[0]+=nx*penetration*wb/denominator;b[1]+=nz*penetration*wb/denominator;
  }
  return result;
}
