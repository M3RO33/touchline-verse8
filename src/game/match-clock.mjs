import {MATCH_SECONDS,CLOCK_RATE} from './flow.mjs';

export const HALF_SECONDS=MATCH_SECONDS/2;
export const MAX_ADDED_MINUTES=30;
export const createMatchClock=()=>({half:1,elapsed:0,addedMinutes:[null,null],status:'playing'});
export const regulationMinute=clock=>(clock.half-1)*45;
export const matchMinute=clock=>regulationMinute(clock)+clock.elapsed*CLOCK_RATE;
export const secondsUntilMinute=(clock,minute)=>(minute-regulationMinute(clock))/CLOCK_RATE-clock.elapsed;
export const periodEnded=clock=>clock.status==='half-ended'||clock.status==='match-ended';
export const remainingPeriodSeconds=clock=>Math.max(0,HALF_SECONDS+(clock.addedMinutes[clock.half-1]??0)/CLOCK_RATE-clock.elapsed);

function updateStatus(clock){
  const added=clock.addedMinutes[clock.half-1];
  if(clock.elapsed<HALF_SECONDS-1e-8)clock.status='playing';
  else if(added===null)clock.status='awaiting-added-time';
  else if(remainingPeriodSeconds(clock)<1e-8)clock.status=clock.half===1?'half-ended':'match-ended';
  else clock.status='added-time';
}
export function advanceMatchClock(clock,seconds){
  if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('경기 시간은 0 이상의 유한한 값이어야 합니다.');
  if(periodEnded(clock)||clock.status==='awaiting-added-time')return 0;
  const consumed=Math.min(seconds,remainingPeriodSeconds(clock));clock.elapsed+=consumed;updateStatus(clock);return consumed;
}
export function allocateAddedTime(clock,minutes){
  if(!Number.isInteger(minutes)||minutes<0||minutes>MAX_ADDED_MINUTES)throw new RangeError(`추가시간은 0–${MAX_ADDED_MINUTES}분의 정수로 입력하세요.`);
  if(periodEnded(clock))throw new Error('종료된 전·후반의 추가시간은 변경할 수 없습니다.');
  clock.addedMinutes[clock.half-1]=minutes;updateStatus(clock);return clock;
}
export function startSecondHalf(clock){
  if(clock.half!==1||clock.status!=='half-ended')throw new Error('전반이 종료된 뒤 후반을 시작할 수 있습니다.');
  clock.half=2;clock.elapsed=0;clock.status='playing';return clock;
}
export function clockReading(clock){
  const extraSeconds=Math.max(0,clock.elapsed-HALF_SECONDS)*CLOCK_RATE*60,added=clock.addedMinutes[clock.half-1],isAdded=clock.elapsed>=HALF_SECONDS-1e-8&&(added>0||extraSeconds>.001);
  const seconds=Math.floor((isAdded?extraSeconds:matchMinute(clock)*60)+1e-6),pad=v=>String(v).padStart(2,'0');
  return {text:`${isAdded?clock.half*45+'+':''}${pad(Math.floor(seconds/60))}:${pad(seconds%60)}`,isAdded,added,half:clock.half};
}
