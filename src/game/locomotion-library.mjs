import {LOCOMOTION_CLIPS} from './locomotion-clips.mjs';
const fract=x=>x-Math.floor(x),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t,smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
function curve(frames,phase,index,angle=false){const x=fract(phase)*frames.length,i=Math.floor(x),q=x-i,get=j=>frames[(j+frames.length)%frames.length][index],b=get(i),near=v=>angle?b+Math.atan2(Math.sin(v-b),Math.cos(v-b)):v,a=near(get(i-1)),c=near(get(i+1)),d=near(get(i+2));return b+.5*q*(c-a+q*(2*a-5*b+4*c-d+q*(3*(b-c)+d-a)));}
export function sampleAuthoredGait(kind,phase){
 const clip=LOCOMOTION_CLIPS[kind]||LOCOMOTION_CLIPS.jog,frames=clip.frames,group=(at,n=3)=>Array.from({length:n},(_,j)=>curve(frames,phase,at+j,true));
 return {source:clip.source,hip:(curve(frames,phase,0)-clip.meanHip),sway:curve(frames,phase,1)-clip.meanSway,body:group(2),spine:group(5),chest:group(8),head:group(11),arms:[group(14),group(17)],elbows:group(20,2),stance:clip.sourceStance.reduce((s,x)=>s+x,0)/2};
}
export function sampleAuthoredSwing(kind,foot,q,stance){
 const clip=LOCOMOTION_CLIPS[kind]||LOCOMOTION_CLIPS.jog,frames=clip.feet[foot],support=clip.sourceStance[foot],at=support+(1-support)*clamp(q),start=curve(frames,support,0),end=curve(frames,0,0),span=end-start;
 const forward=Math.abs(span)>.05?(curve(frames,at,0)-start)/span:q,progress=(1-stance)*q+stance*forward;
 const h0=curve(frames,support,1),h1=curve(frames,0,1),lift=Math.max(0,curve(frames,at,1)-lerp(h0,h1,smooth(q)))*smooth(q/.08)*smooth((1-q)/.08);
 return {progress,lift,pitch:clamp(curve(frames,at,2,true),-.55,1.05)};
}
