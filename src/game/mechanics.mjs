export const TEAMS={home:'노스 FC',away:'이스트 유나이티드'};
export const RESTARTS={play:'플레이 재개',advantage:'어드벤티지',free:'직접 프리킥',offside:'오프사이드 → 간접 프리킥',indirect:'간접 프리킥',penalty:'페널티킥',drop:'드롭볼'};
export const CARDS={none:'카드 없음',yellow:'옐로카드',red:'레드카드'};
export const BASE_PAY=1000000;
export const opposite=t=>t==='home'?'away':'home';
// Offside is an offence whose restart is an indirect free kick. Either UI entry
// expresses that same restart; disciplinary choices are independent of grading.
export const normalizeRestart=restart=>restart==='offside'?'indirect':restart;
export function selectRestart(event,restart,selection={}){
  const beneficiary=restart==='offside'?opposite(event.attack):normalizeRestart(restart)==='indirect'&&normalizeRestart(event.restart)==='indirect'?event.beneficiary:event.attack;
  return {...selection,restart,beneficiary};
}
export function chooseRestartStyle(event,decision){
  const restart=normalizeRestart(decision.restart),d=decision.beneficiary===event.attack?event.dir:-event.dir,distance=52.5-event.worldX*d,wide=Math.abs(event.worldZ),variant=event.variant??.5;
  if(restart==='penalty')return 'shot';
  if(restart==='indirect')return 'short';
  if(restart==='drop')return 'drop';
  if(restart==='free'){
    if(distance>36)return 'short';
    if(distance>25||wide>15)return variant<.4?'short':'cross';
    return variant<.25?'short':variant<.55?'cross':'shot';
  }
  return 'shot';
}
export function makeMatch(seed=Date.now(),{stage=null}={}){
  let n=seed>>>0; const rand=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
  let definitions=[
    {type:'careless',minute:9,x:21,z:5,attack:'home',jersey:4,restart:'free',card:'none',title:'공격수와 수비수가 경합했습니다.',detail:'발이 엉키며 공격수가 넘어졌습니다. 접촉 순서와 강도를 확인하세요.',explanation:'수비수가 공에 닿기 전에 공격수의 발목을 걸었습니다. 부주의한 태클은 직접 프리킥이며, 별도의 경고는 필요하지 않습니다.'},
    {type:'offside',minute:21,x:29,z:-5,attack:'home',jersey:5,restart:'offside',card:'none',offset:.85,title:'침투 패스가 공격수에게 연결됐습니다.',detail:'패스 순간의 위치를 확인하세요. 노스 FC는 오른쪽 골대로 공격합니다.',explanation:'동료가 공을 패스한 순간 공격수의 발이 공과 두 번째로 뒤에 있는 상대보다 골라인에 가까웠고, 공을 받아 플레이에 관여했습니다. 상대 팀의 간접 프리킥입니다.'},
    {type:'reckless',minute:34,x:39,z:4,attack:'away',jersey:3,restart:'penalty',card:'yellow',title:'페널티 지역 안에서 충돌이 발생했습니다.',detail:'태클의 위험성과 접촉 위치를 여러 각도에서 확인하세요.',explanation:'수비수가 페널티 지역 안에서 상대의 안전을 고려하지 않는 무모한 태클을 했습니다. 페널티킥과 옐로카드입니다.'},
    {type:'clean',minute:43,x:18,z:3,attack:'home',jersey:6,restart:'play',card:'none',title:'태클 뒤 공격수가 넘어졌습니다.',detail:'수비수가 공을 먼저 건드렸는지, 이후 접촉이 위험했는지 확인하세요.',explanation:'수비수는 공을 먼저 정확하게 건드렸고, 이어진 접촉도 부주의하거나 무모하지 않았습니다. 반칙 없이 플레이를 이어갑니다.'},
    {type:'advantage',minute:56,x:22,z:-3,attack:'away',jersey:4,restart:'advantage',card:'none',title:'접촉 직후 공격이 계속 연결됐습니다.',detail:'공을 가진 팀에 더 좋은 공격 기회가 남아 있는지 확인하세요.',explanation:'부주의한 접촉이 있었지만 공이 유리한 위치의 동료에게 연결되어 공격을 이어갈 수 있습니다. 어드벤티지가 최선이며, 프리킥으로 중단해도 규칙상 가능한 판정입니다.'},
    {type:'serious',minute:68,x:19,z:7,attack:'home',jersey:2,restart:'free',card:'red',title:'두 선수가 강하게 충돌했습니다.',detail:'발의 높이, 스터드 방향, 접촉 부위를 살펴보세요.',explanation:'수비수가 스터드를 드러낸 높은 태클로 상대의 다리를 가격하여 안전을 위협했습니다. 심한 반칙 플레이로 퇴장, 직접 프리킥입니다.'},
    {type:'referee',minute:77,x:8,z:0,attack:'away',jersey:7,restart:'drop',card:'none',title:'공이 주심에 맞은 뒤 방향을 바꿨습니다.',detail:'공이 심판에 맞은 뒤 어느 팀이 소유하게 됐는지 확인하세요.',explanation:'인플레이 상태에서 공이 주심에 맞아 상대 팀으로 소유권이 바뀌었습니다. 경기를 중단하고 원래 소유하던 팀에 드롭볼로 재개합니다.'},
    {type:'onside',minute:88,x:30,z:4,attack:'home',jersey:8,restart:'play',card:'none',offset:-.65,title:'막판 침투 패스가 연결됐습니다.',detail:'노스 FC는 왼쪽 골대로 공격합니다. 패스 시점에서 기준선을 비교하세요.',explanation:'패스 순간 공격수의 득점 가능한 신체 부위가 두 번째로 뒤에 있는 상대보다 골라인에 가깝지 않았습니다. 온사이드이므로 플레이를 이어갑니다.'}
  ];
  if(stage){
    const level=Math.max(1,Math.min(5,Math.floor(stage.level||1))),legacy=Object.fromEntries(definitions.map(e=>[e.type,e]));
    const extras={
      handball:{type:'handball',x:level>=3?39:25,z:5,attack:'away',jersey:4,restart:level>=3?'penalty':'free',card:'none',title:'공이 수비수의 팔에 맞았습니다.',detail:'팔의 위치, 움직임과 접촉 지점을 확인하세요.',explanation:'수비수가 몸을 부자연스럽게 크게 만드는 위치로 팔을 벌려 공을 막았습니다. 핸드볼 반칙이며, 접촉 지점이 페널티 지역 안이면 페널티킥, 밖이면 직접 프리킥입니다.'},
      holding:{type:'holding',x:24,z:-6,attack:'home',jersey:3,restart:'free',card:'none',title:'침투하던 공격수가 속도를 잃었습니다.',detail:'유니폼을 잡는 손과 공격수의 움직임을 확인하세요.',explanation:'수비수가 상대의 유니폼을 붙잡아 전진을 방해했습니다. 홀딩은 직접 프리킥 반칙입니다.'},
      dangerous:{type:'dangerous',x:23,z:2,attack:'away',jersey:6,restart:'indirect',card:'none',title:'경합 중 수비수의 발이 높이 올라갔습니다.',detail:'높은 발과 상대의 거리, 실제 신체 접촉 여부를 확인하세요.',explanation:'수비수가 접촉 없이 상대의 안전을 위협하는 높이로 발을 들어 상대가 플레이를 포기하게 했습니다. 접촉 없는 위험한 플레이는 간접 프리킥입니다.'},
      dive:{type:'dive',x:32,z:7,attack:'home',jersey:5,restart:'indirect',card:'yellow',title:'공격수가 페널티 지역 부근에서 넘어졌습니다.',detail:'수비수의 발과 공격수 사이에 실제 접촉이 있었는지 확인하세요.',explanation:'공격수가 접촉 없이 고의로 넘어져 주심을 속이려 했습니다. 시뮬레이션을 확인하고 중단한 경기는 상대 팀의 간접 프리킥으로 재개합니다. 경고 여부는 별도로 선택하며 판정 점수에 반영하지 않습니다.'}
    };
    const pools=[
      ['careless','offside','handball','clean','advantage','holding','referee','onside'],
      ['careless','onside','reckless','holding','handball','dangerous','referee','offside'],
      ['holding','offside','handball','clean','advantage','dangerous','dive','onside'],
      ['dive','offside','reckless','holding','handball','serious','dangerous','onside'],
      ['holding','offside','handball','dive','advantage','serious','dangerous','onside']
    ],minutes=definitions.map(e=>e.minute),margin=Math.max(.18,.95-level*.15);
    definitions=pools[level-1].map((type,i)=>{
      const e={...(extras[type]||legacy[type]),minute:minutes[i]};
      if(type==='offside'||type==='onside')e.offset=(type==='offside'?1:-1)*(margin+rand()*.10);
      if((type==='offside'||type==='onside')&&e.minute>=45)e.detail=`침투 패스가 나간 순간의 신체 위치와 공, 두 번째 수비수의 기준선을 비교하세요.`;
      return e;
    });
  }
  const whistleDelays={careless:1.05,offside:2.0,reckless:.85,clean:1.25,advantage:1.65,serious:.65,referee:.75,onside:1.8,handball:1,holding:1.25,dangerous:.95,dive:1.55};
  const incidents=definitions.map((e,i)=>{const delay=whistleDelays[e.type],whistleAt=5.2+delay,stoppageAt=whistleAt+.20;return {...e,id:i+1,worldX:e.x*(e.attack==='home'?1:-1)*(e.minute>=45?-1:1),worldZ:e.z,dir:(e.attack==='home'?1:-1)*(e.minute>=45?-1:1),moment:5.2,whistleDelay:delay,whistleAt,stoppageAt,clipLength:stoppageAt,offenderTeam:opposite(e.attack),offender:`${opposite(e.attack)}-${e.jersey}`,beneficiary:e.restart==='offside'?opposite(e.attack):e.attack,roll:rand(),variant:rand()};});
  // Subsequent matches vary positions and the final pass decision without hiding evidence.
  if(seed!==1){incidents.forEach(e=>{e.worldZ+=Math.round((rand()-.5)*6);});if(!stage&&rand()>.5){const e=incidents[7];e.type='offside';e.offset=.5+rand()*.7;e.restart='offside';e.beneficiary='away';e.explanation=incidents[1].explanation;}}
  for(const e of incidents)if(e.type==='dive'){e.offenderTeam=e.attack;e.offender=e.attack+'-9';e.beneficiary=opposite(e.attack);}
  const basePay=stage&&Number.isFinite(stage.basePay)?Math.max(0,Math.round(stage.basePay)):BASE_PAY;
  return {seed,stageId:stage?.id??null,basePay,reviewSeconds:stage?.reviewSeconds??null,incidents,index:0,score:{home:0,away:0},possession:'home',cards:{},sentOff:[],pay:basePay,errors:0,confidence:100,history:[],minute:0};
}
export function evaluateDecision(event,decision){
  if(decision.timedOut)return {correct:false,timedOut:true,failures:[{label:'판정 시간 초과',amount:200000}],loss:200000};
  const failures=[];const validRestart=normalizeRestart(decision.restart)===normalizeRestart(event.restart)||(event.type==='advantage'&&decision.restart==='free');
  if(!validRestart)failures.push({label:'재개 방식',amount:['indirect','penalty'].includes(normalizeRestart(event.restart))||['indirect','penalty'].includes(normalizeRestart(decision.restart))?150000:100000});
  if(decision.beneficiary!==event.beneficiary)failures.push({label:'공격권 팀',amount:50000});
  return {correct:failures.length===0,failures,loss:failures.reduce((s,f)=>s+f.amount,0)};
}
export function applyDecision(match,event,decision){
  // A deadline and a click can arrive in the same browser turn. Re-delivery of
  // that expiry cannot charge wages or accuracy twice; normal legacy calls can
  // still apply a second card independently.
  const previous=match.history.find(r=>r.event.id===event.id);
  if(previous&&(decision.timedOut||previous.decision.timedOut))return previous;
  const baseline=evaluateDecision(event,decision),scale=(match.basePay??BASE_PAY)/BASE_PAY,judgment={...baseline,baselineLoss:baseline.loss,loss:Math.round(baseline.loss*scale),failures:baseline.failures.map(f=>({...f,amount:Math.round(f.amount*scale)}))};
  match.pay=Math.max(0,match.pay-judgment.loss);match.errors+=judgment.correct?0:1;match.confidence=Math.max(0,match.confidence-(judgment.correct?0:12));
  let dismissal=null;
  if(['yellow','red'].includes(decision.card)&&/^(home|away)-(?:[1-9]|10|11)$/.test(decision.target)&&!match.sentOff.includes(decision.target)){
    const current=match.cards[decision.target]||0;
    if(decision.card==='red'||current===1){match.cards[decision.target]=2;match.sentOff.push(decision.target);dismissal=decision.target;}
    else match.cards[decision.target]=1;
  }
  match.possession=decision.beneficiary;
  const team=decision.beneficiary,other=opposite(team);
  const advantage=match.sentOff.filter(id=>id.startsWith(other)).length-match.sentOff.filter(id=>id.startsWith(team)).length;
  const style=chooseRestartStyle(event,decision),probabilities={penalty:.78,free:style==='shot'?.17:0,advantage:.55,play:.29,offside:0,indirect:0,drop:0};
  const chance=probabilities[decision.restart]+(probabilities[decision.restart]?advantage*.08:0);
  const goal=event.roll<chance;
  if(goal)match.score[team]++;
  const descriptions={penalty:`${TEAMS[team]}의 페널티킥`,free:`${TEAMS[team]}의 직접 프리킥`,advantage:`${TEAMS[team]}의 어드벤티지 공격`,play:`${TEAMS[team]}의 이어지는 공격`,offside:`${TEAMS[team]}의 간접 프리킥`,indirect:`${TEAMS[team]}의 간접 프리킥`,drop:`${TEAMS[team]}에 드롭볼`};
  let flow=descriptions[decision.restart];
  if(goal)flow+=' → 득점! 상대 팀 킥오프';else if(style==='shot')flow+=' → 골키퍼 선방 → 수비수가 세컨드 볼을 받아 공격 전개';else if(style==='cross')flow+=' → 크로스 → 동료가 받아 공격 연결';else flow+=style==='drop'?' → 볼 컨트롤 → 공격 연결':' → 짧은 패스 → 공격 연결';
  if(dismissal)flow+=` · ${TEAMS[dismissal.split('-')[0]]} #${dismissal.split('-')[1]} 퇴장`;
  const record={event,decision:{...decision},...judgment,style,goal,dismissal,flow,score:{...match.score},pay:match.pay};
  match.history.push(record);return record;
}
export function restartPosition(event,decision){
  const dir=decision.beneficiary===event.attack?event.dir:-event.dir;
  if(decision.restart==='penalty')return {x:41.5*dir,z:0,dir};
  if(decision.restart==='offside')return {x:event.worldX,z:event.worldZ,dir};
  if(decision.restart==='drop')return {x:event.worldX-1.3*event.dir,z:event.worldZ,dir};
  return {x:event.worldX,z:event.worldZ,dir};
}

