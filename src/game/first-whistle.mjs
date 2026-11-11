import {makeMatch,evaluateDecision} from './mechanics.mjs';
export const FIRST_WHISTLE_KEY='touchline.first-whistle.v1';
export const ARRIVAL=[
 {speaker:'선배 심판',text:'오늘 친선경기 주심이 못 온대. 네가 맡아볼래?',button:'제가 맡아볼게요'},
 {speaker:'선배 심판',text:'첫 경기니까 내가 같이 볼게. 선수들 말보다, 네 눈으로 확인한 걸 믿어.',button:'피치로 나가기'}
];
export const LESSONS=[
 {type:'careless',title:'엇갈리는 주장',voices:'공격수 “발목부터 걸었어요!” · 수비수 “공 보고 들어갔어요!”',prompt:'말이 다르네. 접촉 순간을 네 눈으로 확인해 봐.',question:'공과 발목, 어느 쪽에 먼저 닿았지?',skill:'접촉 순서',success:'발목에 먼저 닿았지. 네가 확인한 근거로 경기를 다시 시작하면 돼.'},
 {type:'clean',title:'넘어졌다고 모두 반칙일까',voices:'공격수 “넘어졌잖아요!” · 수비수 “이번엔 공을 먼저 건드렸어요.”',prompt:'이번엔 네가 찾아봐. 넘어졌다는 사실만으로 결정하진 말고.',question:'공을 처리한 순서와, 그 뒤 접촉도 함께 보자.',skill:'정상적인 경합',success:'좋아. 공을 먼저 처리했고 뒤의 접촉도 위험하지 않았어. 플레이를 이어가자.'},
 {type:'offside',title:'마지막 침투',voices:'수비수 “오프사이드!” · 공격수 “패스할 때는 아니었어요!”',prompt:'이번엔 공이 발을 떠난 순간이 중요해. 패스 시점으로 돌아가 봐.',question:'공과 두 번째로 뒤에 있는 상대, 공격수의 위치를 비교해 봐.',skill:'패스 시점과 위치',success:'패스 순간 위치를 확인했고, 그 선수가 공을 받아 관여했어. 상대 팀 간접 프리킥이야.'}
];
export function readFirstWhistle(storage){try{const v=JSON.parse((storage??globalThis.localStorage)?.getItem(FIRST_WHISTLE_KEY)||'null');return {seen:!!v?.seen,completed:!!v?.completed};}catch{return {seen:false,completed:false};}}
export function saveFirstWhistle(progress,storage){try{const target=storage??globalThis.localStorage;if(!target?.setItem)return false;target.setItem(FIRST_WHISTLE_KEY,JSON.stringify({seen:!!progress.seen,completed:!!progress.completed}));return true;}catch{return false;}}
export function createFirstWhistle(){return {index:0,phase:'arrival',arrival:0,contact:false,angle:false,defenderLine:false,attackerLine:false,attempts:0,results:[],retry:''};}
export function lessonMatch(){
 const match=makeMatch(1),source=match.incidents;
 match.incidents=LESSONS.map((lesson,i)=>({...source.find(e=>e.type===lesson.type),id:i+1,minute:[5,15,25][i]}));
 return {...match,stageId:'lot',basePay:0,pay:0,reviewSeconds:null,careerId:'practice-first-whistle'};
}
export function observeLesson(story,action){
 if(story.phase!=='review')return false;
 if(action==='contact')story.contact=true;
 if(action==='angle'&&story.contact)story.angle=true;
 if(action==='defenderLine'&&story.contact)story.defenderLine=true;
 if(action==='attackerLine'&&story.contact)story.attackerLine=true;
 return lessonReady(story);
}
export function lessonReady(story){return story.phase==='review'&&story.contact&&(story.index===2?story.defenderLine&&story.attackerLine:story.angle);}
export function lessonInstruction(story){
 const lesson=LESSONS[story.index];
 if(story.phase==='arrival')return {...ARRIVAL[story.arrival],action:'arrival'};
 if(story.phase==='live')return {speaker:'선배 심판',text:story.index===0?'첫 배정이네. 일단 경기를 보자. 의심스러운 순간이 오면 같이 확인하자.':'경기가 다시 이어진다. 다음 장면은 네가 먼저 판단해 봐.',button:'',action:null};
 if(story.phase==='result')return {speaker:'선배 심판',text:lesson.success,button:'',action:null};
 if(story.phase==='resume')return {speaker:'선배 심판',text:'네 판정대로 경기가 이어지는 걸 봐. 이제 다음 장면으로 가자.',button:'',action:null};
 if(!story.contact)return {speaker:'선배 심판',text:story.retry||lesson.prompt,button:story.index===2?'패스 순간 보기':'접촉 순간 보기',action:'contact'};
 if(story.index<2&&!story.angle)return {speaker:'선배 심판',text:'한쪽에서만 보지 말자. 다른 각도에서도 한번 확인해 봐.',button:'다른 각도에서 보기',action:'angle'};
 if(story.index===2&&(!story.defenderLine||!story.attackerLine))return {speaker:'선배 심판',text:!story.defenderLine?'파란 선을 두 번째로 뒤에 있는 상대 위치에 놓아봐. 손과 팔은 제외하고.':'이제 주황 선을 공격수의 득점 가능한 신체 부위에 놓아봐. 공의 위치도 같이 확인해.',button:'기준선 도구 열기',action:'lines'};
 return {speaker:'선배 심판',text:story.retry||lesson.question,button:'판정 선택하기',action:'judge'};
}
export function attemptLesson(story,event,decision){
 if(!lessonReady(story))return {accepted:false,correct:false};
 const result=evaluateDecision(event,decision);story.attempts++;
 if(!result.correct){story.retry='다시 한번 보자. '+event.explanation;return {accepted:true,correct:false};}
 story.results.push({index:story.index,attempts:story.attempts,skill:LESSONS[story.index].skill});story.phase='result';story.retry='';return {accepted:true,correct:true};
}
export function nextLesson(story){
 if(story.phase!=='resume')return false;
 if(story.index===LESSONS.length-1){story.phase='complete';return false;}
 story.index++;story.phase='live';story.contact=false;story.angle=false;story.defenderLine=false;story.attackerLine=false;story.attempts=0;story.retry='';return true;
}
