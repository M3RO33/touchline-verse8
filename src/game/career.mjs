// Saved locally. Cards are deliberately absent: callers grade only the restart/team.
export const CAREER_VERSION=1;
export const CAREER_STORAGE_KEY='touchline.career.v1';
export const MAX_JUDGMENT_IDS=1024;
export const MAX_SETTLED_MATCH_IDS=256;
export const STAGES=Object.freeze([
  {id:'lot',name:'동네 공터',level:1,threshold:0,basePay:30000,reviewSeconds:100,subtitle:'동네 축구의 첫 번째 휘슬'},
  {id:'school',name:'학교 운동장',level:2,threshold:100,basePay:80000,reviewSeconds:85,subtitle:'학교의 자존심을 건 한 경기'},
  {id:'amateur',name:'아마추어리그',level:3,threshold:260,basePay:200000,reviewSeconds:70,subtitle:'조직적인 압박과 치열한 경합'},
  {id:'pro',name:'프로리그 축구장',level:4,threshold:500,basePay:500000,reviewSeconds:55,subtitle:'빠른 전개 속에서 정확한 결정을'},
  {id:'stadium',name:'스타디움',level:5,threshold:800,basePay:1000000,reviewSeconds:40,subtitle:'가장 큰 무대, 가장 중요한 판정'},
].map(stage=>Object.freeze(stage)));

export const createCareer=()=>({version:CAREER_VERSION,reputation:0,level:1,funds:0,matches:0,decisions:0,correct:0,errors:0,judgmentIds:[],settledMatchIds:[]});
const nonnegativeInt=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const isId=value=>typeof value==='string'&&value.length>0&&value.length<=128&&value===value.trim();
const retainedIds=(value,limit,check=isId)=>Array.isArray(value)?[...new Set(value.filter(check))].slice(-limit):[];
const isJudgmentKey=value=>{
  if(typeof value!=='string'||value.length>1543)return false;
  try{const pair=JSON.parse(value);return Array.isArray(pair)&&pair.length===2&&pair.every(isId);}catch{return false;}
};

export function levelForReputation(reputation){
  const rep=nonnegativeInt(reputation);
  return STAGES.reduce((level,stage)=>rep>=stage.threshold?stage.level:level,1);
}
export const stageById=id=>STAGES.find(stage=>stage.id===id)??null;

export function normalizeCareer(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||(value.version!==undefined&&value.version!==CAREER_VERSION))return createCareer();
  const reputation=nonnegativeInt(value.reputation),savedLevel=Number.isInteger(value.level)&&value.level>=1&&value.level<=STAGES.length?value.level:1;
  // A completed career may lose reputation but never loses an unlocked venue.
  const correct=nonnegativeInt(value.correct),errors=nonnegativeInt(value.errors);
  const decisions=Math.min(Number.MAX_SAFE_INTEGER,Math.max(nonnegativeInt(value.decisions),correct+errors));
  const judgmentIds=Array.isArray(value.judgmentIds)?value.judgmentIds.filter(isJudgmentKey).map(key=>JSON.stringify(JSON.parse(key))):[];
  return {version:CAREER_VERSION,reputation,level:Math.max(savedLevel,levelForReputation(reputation)),funds:nonnegativeInt(value.funds),matches:nonnegativeInt(value.matches),decisions,correct:Math.min(correct,decisions),errors:Math.min(errors,Math.max(0,decisions-correct)),judgmentIds:retainedIds(judgmentIds,MAX_JUDGMENT_IDS,isJudgmentKey),settledMatchIds:retainedIds(value.settledMatchIds,MAX_SETTLED_MATCH_IDS)};
}

export function canEnterStage(profile,stageId){
  const stage=stageById(stageId);
  return Boolean(stage&&normalizeCareer(profile).level>=stage.level);
}

// level is the highest unlocked level; reputationLevel follows the current rating.
// At the last stage the gauge measures reputation against its 800-point threshold.
export function careerProgress(value){
  const profile=normalizeCareer(value),currentStage=STAGES[profile.level-1],nextStage=STAGES[profile.level]??null;
  const floor=nextStage?currentStage.threshold:0,target=nextStage?nextStage.threshold-floor:currentStage.threshold;
  const current=Math.min(target,Math.max(0,profile.reputation-floor));
  return {level:profile.level,reputationLevel:levelForReputation(profile.reputation),currentStage,nextStage,current,target,ratio:target?current/target:1,remaining:nextStage?Math.max(0,nextStage.threshold-profile.reputation):0};
}

function validateMatchId(matchId){if(!isId(matchId))throw new TypeError('유효한 경기 ID가 필요합니다.');}
function validateStageId(stageId){if(!stageById(stageId))throw new RangeError('알 수 없는 스테이지입니다.');}
function addSafe(a,b){if(!Number.isSafeInteger(a+b))throw new RangeError('저장할 수 있는 수치 범위를 초과했습니다.');return a+b;}

/** Returns {profile, applied, reputationDelta, unlockedStages}; input stays unchanged. */
export function recordJudgment(value,{matchId,eventId,correct,stageId}={}){
  validateMatchId(matchId);validateStageId(stageId);
  // Existing incident definitions use numeric IDs; strings are also accepted.
  const normalizedEventId=Number.isSafeInteger(eventId)&&eventId>=0?String(eventId):eventId;
  if(!isId(normalizedEventId))throw new TypeError('유효한 판정 ID가 필요합니다.');
  if(typeof correct!=='boolean')throw new TypeError('판정 정확도는 true 또는 false여야 합니다.');
  const profile=normalizeCareer(value),key=JSON.stringify([matchId,normalizedEventId]);
  if(profile.judgmentIds.includes(key)||profile.settledMatchIds.includes(matchId))return {profile,applied:false,reputationDelta:0,unlockedStages:[]};
  const reputation=correct?addSafe(profile.reputation,15):Math.max(0,profile.reputation-20),level=Math.max(profile.level,levelForReputation(reputation));
  return {profile:{...profile,reputation,level,decisions:addSafe(profile.decisions,1),correct:addSafe(profile.correct,correct?1:0),errors:addSafe(profile.errors,correct?0:1),judgmentIds:[...profile.judgmentIds,key].slice(-MAX_JUDGMENT_IDS)},applied:true,reputationDelta:reputation-profile.reputation,unlockedStages:STAGES.filter(stage=>stage.level>profile.level&&stage.level<=level)};
}

/** Salary enters funds only here. Returns {profile, applied, pay}; no rating changes. */
export function settleCareerMatch(value,{matchId,pay,correct,total,stageId}={}){
  validateMatchId(matchId);validateStageId(stageId);
  if(!Number.isSafeInteger(pay)||pay<0||pay>stageById(stageId).basePay)throw new RangeError('수당은 스테이지 기본 수당 이내의 정수여야 합니다.');
  if(!Number.isSafeInteger(correct)||!Number.isSafeInteger(total)||correct<0||total<0||correct>total)throw new RangeError('올바른 경기 판정 집계가 필요합니다.');
  const profile=normalizeCareer(value);
  if(profile.settledMatchIds.includes(matchId))return {profile,applied:false,pay:0};
  return {profile:{...profile,funds:addSafe(profile.funds,pay),matches:addSafe(profile.matches,1),settledMatchIds:[...profile.settledMatchIds,matchId].slice(-MAX_SETTLED_MATCH_IDS)},applied:true,pay};
}

// Storage may be unavailable in private browsing or a restricted embedded frame.
export function loadCareer(storage){
  try{const raw=(storage??globalThis.localStorage)?.getItem(CAREER_STORAGE_KEY);if(!raw)return createCareer();const parsed=JSON.parse(raw);return parsed?.version===CAREER_VERSION?normalizeCareer(parsed):createCareer();}catch{return createCareer();}
}
export function saveCareer(profile,storage){
  try{const target=storage??globalThis.localStorage;if(!target?.setItem)return false;target.setItem(CAREER_STORAGE_KEY,JSON.stringify(normalizeCareer(profile)));return true;}catch{return false;}
}
