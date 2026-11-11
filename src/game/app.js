import {ARRIVAL,LESSONS,readFirstWhistle,saveFirstWhistle,createFirstWhistle,lessonMatch,observeLesson,lessonReady,lessonInstruction,attemptLesson,nextLesson} from './first-whistle.mjs';
import {RULEBOOK} from './rulebook.mjs';
import {Stadium} from './scene.js';
import {waitForAthleteTextures} from './athlete-model.mjs';
import {TEAMS,RESTARTS,CARDS,BASE_PAY,makeMatch,applyDecision,restartPosition,opposite,selectRestart} from './mechanics.mjs';
import {createMatchFlow,kickoffFrame,applyFlowEvents,CLOCK_RATE} from './flow.mjs';
import {createMatchClock,advanceMatchClock,allocateAddedTime,startSecondHalf,clockReading,matchMinute,secondsUntilMinute,remainingPeriodSeconds,periodEnded} from './match-clock.mjs';
import {STAGES,loadCareer,saveCareer,careerProgress,canEnterStage,stageById,recordJudgment,settleCareerMatch} from './career.mjs';
import {createReviewTimer,advanceReviewTimer,reviewTimerReading} from './review-timer.mjs';
const $=id=>document.getElementById(id),money=n=>Math.round(n).toLocaleString('ko-KR');
let stadium,match=makeMatch(1),mode='lobby',stageTime=0,ambientTime=0,replayTime=2.4,replayPlaying=false,replayDirection=1,replaySpeed=.5,matchSpeed=1,paused=false,drawEnabled=false,lineType='defender',selection={restart:null,card:'none',beneficiary:'home',target:'away-4'},record=null,last=0,sound=false,audioCtx,whistlePlayed=false,contactLoop=false,labType='run',labVariant='careless',labTime=0,labPlaying=true,labSpeed=1;
let matchClock=createMatchClock(),sequence=null,flowTime=0,livePhase='flow',flowCounter=0;
let career=loadCareer(),selectedStageId=STAGES[career.level-1].id,reviewTimer=null,careerStartReputation=career.reputation,toastUntil=0;
let story=null,storyProgress=readFirstWhistle();
const panels=['lobby','decisionForm','livePanel','resultPanel','endPanel'];
function panel(id){panels.forEach(p=>$(p).hidden=p!==id);document.body.dataset.mode=mode==='halftime'?'live':mode;$('decisionTitle').textContent=mode==='result'?'판정 결과':mode==='evidence'?'근거 다시 보기':'판정';$('pausedIndicator').hidden=true;$('reviewDeadline').hidden=mode!=='review';$('returnLobbyBtn').hidden=['lobby','lab','finished'].includes(mode);window.scrollTo(0,0);document.querySelector('.decision').scrollTop=0;syncStory();}
function event(){return match.incidents[match.index];}
function persistCareer(){const saved=saveCareer(career);$('careerStorageNote').textContent=saved?'진행 상황 자동 저장':'이 환경에서 저장할 수 없습니다 · 현재 세션에서 진행';return saved;}
function renderCareer(){
  const progress=careerProgress(career),stage=stageById(selectedStageId)||STAGES[0];
  $('careerFunds').innerHTML=money(career.funds)+'<small>원</small>';$('careerLevel').textContent='LV.'+String(career.level).padStart(2,'0');$('careerMatches').textContent='완료한 경기 '+career.matches;
  $('careerRepValue').textContent=career.reputation+' / '+(progress.nextStage?.threshold||800);$('careerRepFill').style.width=(progress.ratio*100)+'%';$('careerRepMeter').setAttribute('aria-valuemax',String(progress.target));$('careerRepMeter').setAttribute('aria-valuenow',String(progress.current));
  $('careerNextUnlock').textContent=progress.nextStage?`평판 ${progress.nextStage.threshold} · ${progress.nextStage.name} 해금까지 ${progress.remaining}`:'최고 라이선스 · 모든 경기장 해금';
  $('stageChoices').innerHTML=STAGES.map(s=>{const unlocked=canEnterStage(career,s.id),selected=s.id===selectedStageId;return `<button class="stage-choice ${selected?'selected':''}" data-stage="${s.id}" aria-pressed="${selected}" ${unlocked?'':'disabled'}><span class="stage-number">${unlocked?String(s.level).padStart(2,'0'):'◇'}</span><span class="stage-info"><strong>${s.name}</strong><small>${unlocked?money(s.basePay)+'원 · 판정 '+s.reviewSeconds+'초':'필요 평판 '+s.threshold}</small></span><span class="stage-status">${selected?'배정됨':unlocked?'선택':'잠김'}</span></button>`;}).join('');
  document.querySelectorAll('[data-stage]').forEach(button=>button.onclick=()=>{if(!canEnterStage(career,button.dataset.stage))return;selectedStageId=button.dataset.stage;stadium.setStage?.(selectedStageId);renderCareer();});
  $('stageName').textContent=stage.name;$('stageSubtitle').textContent=({lot:'흙구장 · 친선경기',school:'학교 운동장 · 지역대회',amateur:'아마추어리그 · 주말 경기',pro:'프로리그 · 정규 경기',stadium:'스타디움 · 주요 경기'})[stage.id]||stage.subtitle;$('stagePay').textContent=money(stage.basePay)+'원';$('stageReviewTime').textContent=stage.reviewSeconds+'초';$('stageDifficulty').textContent='배정 등급 '+String(stage.level).padStart(2,'0');$('careerAvatarRank').textContent=['지역 심판','학교리그 심판','아마추어리그 심판','프로리그 심판','국제 경기 심판'][career.level-1];
  $('careerStartBtn').disabled=!canEnterStage(career,selectedStageId);$('firstWhistleLabel').textContent=storyProgress.completed?'첫 휘슬 다시 플레이':'첫 휘슬 · 선배와 함께 시작';
}
function startCareerMatch(){
  const stage=stageById(selectedStageId);if(!stage||!canEnterStage(career,stage.id))return;story=null;syncStory();
  match=makeMatch(Date.now(),{stage});match.careerId=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;careerStartReputation=career.reputation;record=null;reviewTimer=null;stadium.removed=[];stadium.setStage?.(stage.id);$('matchVenue').textContent=stage.name;updateLog();whistle();startLive();
}
function returnToLobby(){
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());story=null;mode='lobby';paused=false;replayPlaying=false;reviewTimer=null;record=null;stadium.removed=[];stadium.useHalf(1);stadium.clearLines();turnDrawing(false);$('motionLab').hidden=true;$('motionLabBtn').disabled=false;panel('lobby');$('matchFade').style.opacity=0;stadium.setStage?.(selectedStageId);renderCareer();
}
function updateReviewTimer(){if(story){$('reviewTime').textContent='무제한';$('reviewTimeFill').style.width='100%';$('reviewDeadline').classList.remove('urgent');return;}const reading=reviewTimerReading(reviewTimer);$('reviewTime').textContent=reading.text;$('reviewTimeFill').style.width=reading.ratio*100+'%';$('reviewDeadline').classList.toggle('urgent',reading.urgent);}
function updateHUD(){
  $('score').innerHTML=`${match.score.home} <i>:</i> ${match.score.away}`;
  const basePay=match.basePay??BASE_PAY;$('salary').innerHTML=`${money(match.pay)}<span>원</span>`;$('payMeter').style.width=basePay?match.pay/basePay*100+'%':'0%';$('errors').textContent=`오심 ${match.errors}회`;$('deduction').textContent=`차감 ${money(basePay-match.pay)}원`;
  $('homeCount').textContent=11-match.sentOff.filter(id=>id.startsWith('home-')).length;$('awayCount').textContent=11-match.sentOff.filter(id=>id.startsWith('away-')).length;
  const reading=clockReading(matchClock);$('clock').textContent=reading.text;$('clock').parentElement.classList.toggle('added-clock',reading.isAdded);$('period').textContent=story?'친선경기':mode==='finished'?'경기 종료':mode==='halftime'?'하프타임':reading.isAdded?(matchClock.half===1?'전반 추가시간':'후반 추가시간'):(matchClock.half===1?'전반전':'후반전');
  $('addedTimeBadge').hidden=reading.added===null;$('addedTimeBadge').textContent=reading.added===null?'':`+${reading.added}′`;$('addedTimeBtn').textContent=reading.added===null?'추가시간 지정':`추가시간 +${reading.added}분 · 변경`;$('addedTimeBtn').disabled=mode==='halftime'||mode==='finished';$('caseNumber').textContent=`${String(mode==='lobby'?0:Math.min(match.incidents.length,match.index+1)).padStart(2,'0')} / ${String(match.incidents.length).padStart(2,'0')}`;$('addedTimeBtn').hidden=!!story;$('liveObjective').textContent=story?'친선경기 · 첫 배정을 끝까지 마치세요':`주요 장면 ${match.incidents.length}개를 판정하고 경기를 마치세요.`;

}
function feed(text,cls=''){const el=$('feedStatus');el.innerHTML=`<i></i> ${text}`;el.className='feed-status '+cls;}
function reviewControls(enabled){for(const id of ['timeline','reverseBtn','prevFrame','replayBtn','nextFrame','momentBtn','whistleBtn','loopBtn','lineTool','zoomTool'])$(id).disabled=!enabled;document.querySelectorAll('[data-speed]').forEach(b=>b.disabled=!enabled);}
function setCamera(camera){const changed=camera!==stadium.cameraMode;stadium.zoom=false;$('zoomTool').classList.remove('active');$('zoomTool').setAttribute('aria-pressed','false');$('cameraHint').textContent=drawEnabled?'기준선 모드 · 피치를 클릭/드래그해 배치':'우클릭 드래그 회전 · 휠 확대';stadium.setCamera(camera);if(story&&mode==='review'&&changed)observeLesson(story,'angle');syncStory();document.querySelectorAll('[data-camera]').forEach(b=>{b.classList.toggle('selected',b.dataset.camera===camera);b.setAttribute('aria-pressed',String(b.dataset.camera===camera));});const names={broadcast:'중계 카메라',side:'터치라인 카메라',goal:'골라인 카메라',top:'탑뷰 카메라',referee:'심판 카메라'};$('feedMeta').textContent=names[camera];}
function turnDrawing(on){drawEnabled=on;$('lineOptions').hidden=!on;$('drawInstruction').hidden=!on;$('lineTool').classList.toggle('active',on);$('lineTool').setAttribute('aria-pressed',String(on));$('cameraHint').textContent=on?'기준선 모드 · 피치를 클릭/드래그해 배치':'우클릭 드래그 회전 · 휠 확대';if(on){replayPlaying=false;updateReplay();setCamera('top');$('drawInstruction').textContent=`${lineType==='defender'?'파란 수비':'주황 공격'} 기준선을 그을 위치를 선택하세요`;$('lineOptions').scrollIntoView({block:'nearest'});}}
function updateLines(){const a=stadium.lines.attacker,b=stadium.lines.defender;if(a&&b){const dist=(a.x-b.x)*event().dir;$('lineReading').textContent=`내 기준선 차이: ${dist>=0?'+':''}${Math.round(dist*100)} cm`;}else $('lineReading').textContent=`${lineType==='defender'?'수비':'공격'} 기준선 · 피치에서 위치 선택`;const line=stadium.lines[lineType];if(line)$('linePosition').value=line.x;}
function placeLine(x){stadium.drawLine(lineType,x);$('linePosition').value=x;updateLines();if(story&&mode==='review'){observeLesson(story,lineType==='defender'?'defenderLine':'attackerLine');if(lineType==='defender'&&!story.attackerLine){lineType='attacker';document.querySelectorAll('[data-line]').forEach(b=>b.classList.toggle('selected',b.dataset.line===lineType));$('drawInstruction').textContent='주황 공격 기준선 · 공격수 위치에 배치';}syncStory();}}
function updateReplay(){const offset=replayTime-event().moment;$('timeline').value=replayTime;$('timecode').textContent=`${offset>=0?'+':'−'}${Math.abs(offset).toFixed(2)}s · F${String(Math.round(replayTime*60)).padStart(3,'0')}`;$('replayBtn').textContent=replayPlaying?'Ⅱ':'▶';$('replayBtn').setAttribute('aria-label',replayPlaying?'VAR 정지':'VAR 재생');$('replayStatus').textContent=replayPlaying?(contactLoop?'접촉 구간 반복':replayDirection<0?'역재생':'반복 재생')+` · ${replaySpeed}×`:Math.abs(replayTime-event().whistleAt)<.035?'휘슬 시점 · 일시정지':'일시정지 · 프레임 단위 검토';$('loopBtn').classList.toggle('selected',contactLoop);$('loopBtn').setAttribute('aria-pressed',String(contactLoop));}
function activeRoster(){return stadium.players.filter(p=>!match.sentOff.includes(p.id));}
function runHUD(){
  $('motionLab').hidden=true;$('motionLabBtn').disabled=true;paused=false;replayPlaying=false;whistlePlayed=false;contactLoop=false;turnDrawing(false);panel('livePanel');$('incidentToast').hidden=true;$('momentMarker').hidden=true;$('whistleMarker').hidden=true;reviewControls(false);$('pauseMatch').textContent='일시정지';$('pauseMatch').disabled=false;$('matchFade').style.opacity=0;feed('LIVE','live');
}
function startLive(){
  matchClock=createMatchClock();flowCounter=0;stadium.useHalf(1);stadium.removed=[...match.sentOff];
  beginFlow(kickoffFrame(stadium.roster(),'home',1),true);
}
function beginFlow(entry,kickoff=false){
  mode='live';livePhase='flow';stageTime=0;flowTime=0;runHUD();
  const e=event();if(match.sentOff.includes(e.offender)){const replacement=activeRoster().find(p=>p.team===e.offenderTeam&&p.number!==1);e.jersey=replacement.number;e.offender=replacement.id;}
  stadium.setEvent(e,match.sentOff);const target=stadium.incidentFrame(e,0),before=stadium.incidentFrame(e,-.01),after=stadium.incidentFrame(e,.01),targetVelocity=new Map([...target.actors].map(([id,p])=>[id,[0,2].map(i=>(after.actors.get(id).hip[i]-before.actors.get(id).hip[i])/.02)]));
  const duration=story?(kickoff?8:10):Math.max(5,secondsUntilMinute(matchClock,e.minute)-e.stoppageAt);
  sequence=createMatchFlow({seed:(match.seed+flowCounter*2654435761)>>>0,id:'passage-'+flowCounter++,duration,half:matchClock.half,roster:stadium.roster(),entry,target,targetVelocity,kickoff});
  match.possession=entry.team;stadium.possession=entry.team;$('liveTitle').textContent=kickoff?'킥오프':'플레이 진행 중';$('liveDescription').textContent='';$('flowText').textContent=TEAMS[entry.team]+' · 공격 전개';setCamera('broadcast');stadium.flow(sequence,0);updateHUD();
}
function clockForward(dt){const consumed=advanceMatchClock(matchClock,dt);match.minute=matchMinute(matchClock);if(matchClock.status==='awaiting-added-time')openAddedTime();return consumed;}
function openAddedTime(){
  if(!['live','resume'].includes(mode)||periodEnded(matchClock)||$('addedTimeDialog').open)return;
  const half=matchClock.half===1?'전반':'후반';$('addedTimeTitle').textContent=half+' 추가시간';$('addedTimeContext').textContent=matchClock.status==='awaiting-added-time'?`정규시간 ${matchClock.half*45}분 종료`:half+' 종료 후 적용할 시간을 지정하세요.';
  $('addedTimeInput').value=matchClock.addedMinutes[matchClock.half-1]??(matchClock.half===1?3:5);$('addedTimeInput').setCustomValidity('');$('addedTimeClose').hidden=matchClock.status==='awaiting-added-time';$('addedTimeDialog').showModal();$('addedTimeInput').focus();$('addedTimeInput').select();
}
function endPeriod(){if(matchClock.half===1)halfTime();else finish();}
function beginClosingFlow(entry){
  if(periodEnded(matchClock)){endPeriod();return;}
  const remaining=remainingPeriodSeconds(matchClock);if(remaining<=1e-8){openAddedTime();return;}
  const alreadyLive=mode==='live'&&livePhase==='closing';mode='live';livePhase='closing';flowTime=0;runHUD();
  sequence=createMatchFlow({seed:(match.seed+flowCounter*2654435761)>>>0,id:'added-passage-'+flowCounter++,duration:Math.max(3,Math.min(18,remaining)),half:matchClock.half,roster:stadium.roster(),entry,continuation:true,allowGoal:remaining>14});
  match.possession=entry.team;stadium.possession=entry.team;if(!alreadyLive)setCamera('broadcast');stadium.flow(sequence,0);updateHUD();
}
function halfTime(){
  mode='halftime';stageTime=0;panel('livePanel');feed('HALF TIME');$('liveTitle').textContent='하프타임';$('liveDescription').textContent='후반전 · 이스트 유나이티드 킥오프';$('flowText').textContent='하프타임';whistle();updateHUD();
}
function completeRestart(play){
  if(!play.canAdvance||play.phase!=='carry'||matchClock.status==='awaiting-added-time')return;
  if(story){if(nextLesson(story)){match.index=story.index;beginFlow(stadium.capture(play.team));syncStory();}else finishFirstWhistle();return;}
  const next=match.incidents[match.index+1],sameHalf=next&&(next.minute<45?1:2)===matchClock.half;
  if(sameHalf){const entry=stadium.capture(play.team);match.index++;beginFlow(entry);return;}
  if(periodEnded(matchClock))endPeriod();else beginClosingFlow(stadium.capture(play.team));
}
function enterReview(){
  lineType='defender';stadium.clearLines();document.querySelectorAll('[data-line]').forEach(b=>b.classList.toggle('selected',b.dataset.line==='defender'));
  if(story)story.phase='review';reviewTimer=story?null:createReviewTimer(match.reviewSeconds||stageById(selectedStageId).reviewSeconds);updateReviewTimer();
  mode='review';replayTime=event().stoppageAt;replayPlaying=false;contactLoop=false;feed('VAR 검토','review');panel('decisionForm');reviewControls(true);$('incidentToast').hidden=false;$('incidentToast').querySelector('small').textContent=`접촉 후 +${event().whistleDelay.toFixed(2)}초`;$('momentMarker').hidden=false;$('whistleMarker').hidden=false;const pass=['offside','onside'].includes(event().type);$('momentMarker').querySelector('span').textContent=pass?'패스':'접촉';$('momentMarker').style.left=event().moment/event().clipLength*100+'%';$('whistleMarker').style.left=event().whistleAt/event().clipLength*100+'%';$('timeline').max=event().clipLength;$('timelineStart').textContent='−'+event().moment.toFixed(2)+'s';$('timelineEnd').textContent='+'+(event().clipLength-event().moment).toFixed(2)+'s';$('reviewObjective').textContent='장면을 확인하고 경기 재개 방식과 팀을 결정하세요.';$('caseDescription').innerHTML=story?`<b>${LESSONS[story.index].title}</b><span class="player-voices">${LESSONS[story.index].voices}</span>`:`<b>${event().title}</b><br>${event().detail}`;setCamera('side');
  selection={restart:null,card:'none',beneficiary:event().attack,target:event().offender};$('beneficiary').value=selection.beneficiary;
  $('cardTarget').innerHTML=activeRoster().map(p=>`<option value="${p.id}">${TEAMS[p.team]} #${p.number}</option>`).join('');$('cardTarget').value=selection.target;$('targetLabel').hidden=true;document.querySelectorAll('[data-restart]').forEach(b=>{b.classList.remove('selected');b.setAttribute('aria-pressed','false');});document.querySelectorAll('[data-card]').forEach(b=>{const selected=b.dataset.card==='none';b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});$('confirmBtn').disabled=true;$('decisionHint').textContent='재개 방식을 선택하세요.';$('disciplineDetails').open=false;updateReplay();syncStory();
}
function confirm(timedOut=false){
  if(mode!=='review'||(!selection.restart&&!timedOut))return;if(timedOut&&!selection.restart)selection={...selection,restart:'play',card:'none',beneficiary:event().attack};else selection.beneficiary=$('beneficiary').value;selection.target=$('cardTarget').value;if(timedOut)selection.timedOut=true;
  if(story){const attempt=attemptLesson(story,event(),selection);if(!attempt.accepted)return;if(!attempt.correct){replayTime=event().moment;replayPlaying=false;updateReplay();syncStory();$('storyCoach').scrollIntoView({block:'nearest'});return;}}
  record=applyDecision(match,event(),selection);record.goalApplied=false;if(record.goal)match.score[record.decision.beneficiary]--;mode='result';replayPlaying=false;turnDrawing(false);reviewControls(false);$('incidentToast').hidden=true;panel('resultPanel');
  const rating=story?{profile:career,unlockedStages:[],reputationDelta:0}:recordJudgment(career,{matchId:match.careerId,eventId:event().id,correct:record.correct,stageId:match.stageId});if(!story){career=rating.profile;persistCareer();}
  if(rating.unlockedStages.length){$('careerToast').textContent=`LV.${career.level} · ${rating.unlockedStages.map(s=>s.name).join(', ')} 해금`;$('careerToast').hidden=false;toastUntil=performance.now()+5000;}
  const e=event(),truth=`${RESTARTS[e.restart]} · ${TEAMS[e.beneficiary]}`,preview=`${TEAMS[record.decision.beneficiary]} · ${{short:'짧은 패스로 공격 재개',cross:'크로스로 공격 재개',drop:'드롭볼 후 공격 재개',shot:'골문 앞 슈팅 기회'}[record.style]}`;
  $('resultPanel').innerHTML=`<span class="result-icon ${record.correct?'':'wrong'}">${record.correct?'✓':'!'}</span><h4>${record.correct?'정확한 판정':'오심'}</h4><p class="result-evidence">${e.explanation}</p><p class="result-truth">기준 판정<br><b>${truth}</b></p><div class="result-loss"><span>${record.correct?'봉급 차감 없음':record.failures.map(f=>f.label).join(' · ')}</span><b class="${record.correct?'':'negative'}">${record.loss?'-'+money(record.loss):'0'}원</b></div><p class="sanction-note">징계 · ${CARDS[record.decision.card]}${record.decision.card!=='none'?` / ${TEAMS[record.decision.target.split('-')[0]]} #${record.decision.target.split('-')[1]}`:''}</p><p>${preview}</p><button id="resultReplayBtn" class="secondary">근거 장면 다시 보기</button><button id="continueBtn" class="primary">경기 재개 <span>→</span></button>`;
  const reputationLine=document.createElement('p');reputationLine.className='reputation-result'+(record.correct?'':' negative');reputationLine.textContent=story?'첫 휘슬 · 연습 기록만 남습니다':`${timedOut?'판정 시간 초과 · ':''}평판 ${rating.reputationDelta>0?'+':''}${rating.reputationDelta} · 현재 ${career.reputation}`;$('resultPanel').insertBefore(reputationLine,$('continueBtn'));
  if(timedOut)$('resultPanel').querySelector('h4').textContent='판정 시간 초과';$('continueBtn').addEventListener('click',resume);$('resultReplayBtn').onclick=toggleEvidence;syncStory();$('flowText').textContent=preview;updateHUD();updateLog();feed(timedOut?'TIME OUT':record.correct?'판정 확정':'판정 오류','review');
}
function resume(){if(story)story.phase='resume';mode='resume';stageTime=0;panel('livePanel');$('liveTitle').textContent=RESTARTS[record.decision.restart];$('liveDescription').textContent=record.flow;$('pauseMatch').disabled=false;$('pauseMatch').textContent='일시정지';paused=false;feed('경기 재개','live');stadium.removed=[...match.sentOff];stadium.clearLines();setCamera('broadcast');}
function finish(){
 mode='finished';match.minute=matchMinute(matchClock);panel('endPanel');feed('경기 종료');reviewControls(false);
 const total=match.incidents.length,correct=total-match.errors,grade=correct/total>=.875?'A':correct/total>=.625?'B':correct/total>=.375?'C':'D';
 const settlement=settleCareerMatch(career,{matchId:match.careerId,pay:match.pay,correct,total,stageId:match.stageId});career=settlement.profile;persistCareer();
 const delta=career.reputation-careerStartReputation,highlight=match.history.find(r=>!r.correct)||match.history.at(-1),progress=careerProgress(career);
 $('endPanel').innerHTML=`<span class="report-kicker">주심 경기 보고서 · ${stageById(match.stageId).name}</span><h4>${total}개 장면 중<br>${correct}개 정확</h4><p class="final-score">노스 FC <b>${match.score.home} : ${match.score.away}</b> 이스트 UTD</p><div class="end-stats"><span>판정 등급<b>${grade}</b></span><span>수당 입금<b>${money(match.pay)}<small>원</small></b></span></div>${highlight?`<div class="report-highlight"><span>${highlight.correct?'기억할 판정':'다시 볼 판정'}</span><b>${highlight.event.minute}′ · ${RESTARTS[highlight.event.restart]}</b><p>${highlight.event.explanation}</p></div>`:''}<div class="career-result-summary">평판 ${delta>=0?'+':''}${delta} · 심판 LV.${career.level}<br>보유 자금 ${money(career.funds)}원</div><p class="next-assignment">${progress.nextStage?`다음 배정: ${progress.nextStage.name} · 평판 ${progress.remaining} 더 필요`:'모든 경기장에 배정받을 수 있습니다.'}</p><p class="result-small">추가시간 · 전반 +${matchClock.addedMinutes[0]??0}분 / 후반 +${matchClock.addedMinutes[1]??0}분<br>오심 차감 ${money((match.basePay??BASE_PAY)-match.pay)}원</p><div class="end-actions"><button class="primary" id="newMatchBtn">다음 경기 배정 →</button><button class="secondary" id="endReport">상세 판정 기록</button></div>`;
 $('newMatchBtn').onclick=returnToLobby;$('endReport').onclick=showReport;updateHUD();whistle();
}
function updateLog(){$('reportCount').textContent=`${match.history.length} / ${match.incidents.length}`;}
function showReport(){$('menuDialog').close();$('fullReport').innerHTML=match.history.length?match.history.map(r=>`<div class="report-row"><b>${r.event.minute}′ · ${RESTARTS[r.decision.restart]}</b><br>적용 징계: ${CARDS[r.decision.card]} · 평가 제외<br><span class="${r.correct?'report-correct':'bad'}">${r.correct?'정확한 판정':r.failures.map(f=>f.label).join(' · ')+' 오류 / −'+money(r.loss)+'원'}</span><br>${r.event.explanation}<br>${r.flow}</div>`).join(''):'<p>아직 판정 기록이 없습니다. 킥오프부터 시작하세요.</p>';$('reportDialog').showModal();}
function tone(f,duration=.1){if(!sound)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.09,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function whistle(){
 if(!sound)return;
 try{
  audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const now=audioCtx.currentTime;
  for(const delay of [0,.20]){
   const start=now+delay,envelope=audioCtx.createGain();envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(.055,start+.012);envelope.gain.setValueAtTime(.045,start+.085);envelope.gain.exponentialRampToValueAtTime(.001,start+.15);envelope.connect(audioCtx.destination);
   for(const frequency of [2440,3260]){const o=audioCtx.createOscillator();o.type='sine';o.frequency.setValueAtTime(frequency,start);o.frequency.linearRampToValueAtTime(frequency+90,start+.04);o.frequency.linearRampToValueAtTime(frequency-65,start+.15);o.connect(envelope);o.start(start);o.stop(start+.16);}
   const noise=audioCtx.createBuffer(1,Math.ceil(audioCtx.sampleRate*.16),audioCtx.sampleRate),samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.22;
   const breath=audioCtx.createBufferSource(),filter=audioCtx.createBiquadFilter();breath.buffer=noise;filter.type='bandpass';filter.frequency.value=2800;filter.Q.value=1.5;breath.connect(filter);filter.connect(envelope);breath.start(start);
  }
 }catch{}
}
function openMotionLab(){if(!['lobby','lab'].includes(mode))return;$('menuDialog').close();mode='lab';labTime=0;labPlaying=true;$('motionLab').hidden=false;$('incidentToast').hidden=true;panel('lobby');reviewControls(false);stadium.orbitYaw=0;stadium.zoomFactor=1;feed('동작 확인','review');$('feedMeta').textContent='선수 동작';$('cameraHint').textContent='드래그로 동작을 다른 각도에서 확인';$('labPlay').textContent='일시정지';}

function syncStory(){
 document.body.dataset.tutorial=String(!!story);$('storyArrival').hidden=mode!=='briefing';$('storyCoach').hidden=!(story&&['live','review','result','resume','evidence'].includes(mode));
 for(const id of ['menuStoryBtn','helpStoryBtn'])$(id).disabled=!['lobby','finished'].includes(mode);
 document.querySelectorAll('[data-coach-focus]').forEach(el=>el.removeAttribute('data-coach-focus'));
 if(!story)return;
 const instruction=lessonInstruction(story);
 if(mode==='briefing'){$('arrivalText').textContent=instruction.text;$('arrivalSpeaker').textContent=instruction.speaker;$('arrivalCount').textContent=(story.arrival+1)+' / '+ARRIVAL.length;$('arrivalNext').textContent=instruction.button+' →';return;}
 $('lessonTitle').textContent=LESSONS[story.index].title;$('lessonCounter').textContent=(story.index+1)+' / 3';$('coachText').textContent=instruction.text;$('coachAction').hidden=!instruction.action||(instruction.action==='lines'&&drawEnabled);$('coachAction').textContent=instruction.button||'';$('coachAction').dataset.action=instruction.action||'';
 if(mode==='review'){$('confirmBtn').disabled=!selection.restart||!lessonReady(story);$('reviewObjective').textContent=lessonReady(story)?'관찰한 근거로 재개 방식과 팀을 선택하세요.':'선배와 함께 장면을 먼저 확인하세요.';if(!lessonReady(story))$('decisionHint').textContent='강조된 도구로 장면부터 확인하세요.';const ids={contact:'momentBtn',angle:'coachAction',lines:drawEnabled?'lineOptions':'lineTool',judge:'restartChoices'};if(ids[instruction.action])$(ids[instruction.action]).setAttribute('data-coach-focus','true');}
}
function openFirstWhistle(){
 if(!['lobby','finished'].includes(mode))return;
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());story=createFirstWhistle();storyProgress={...storyProgress,seen:true};saveFirstWhistle(storyProgress);mode='briefing';stadium.removed=[];stadium.setStage?.('lot');$('motionLab').hidden=true;panel('lobby');$('matchFade').style.opacity=0;$('arrivalNext').focus();
}
function startFirstWhistle(){
 match=lessonMatch();match.practice=true;record=null;reviewTimer=null;story.phase='live';stadium.removed=[];stadium.setStage?.('lot');$('matchVenue').textContent='동네 친선경기';updateLog();whistle();startLive();syncStory();
}
function finishFirstWhistle(){
 story.phase='complete';storyProgress={seen:true,completed:true};saveFirstWhistle(storyProgress);mode='finished';panel('endPanel');reviewControls(false);feed('첫 배정 완료');
 $('endPanel').innerHTML=`<span class="report-kicker">첫 휘슬 · 친선경기 종료</span><h4>첫 배정을<br>마쳤다.</h4><blockquote>“첫 경기 끝났네. 생각보다 정신없지?<br>오늘 헷갈렸던 장면은 기억해 둬.”<cite>선배 심판</cite></blockquote><div class="lesson-results">${story.results.map(r=>`<p><b>${String(r.index+1).padStart(2,'0')} ${r.skill}</b><span>${r.attempts===1?'첫 판독에서 확인':'다시 보고 확인'}</span></p>`).join('')}</div><p class="result-small">연습은 평판과 자금에 영향을 주지 않습니다.<br>다음 배정부터 정식 경기 기록을 남깁니다.</p><div class="end-actions"><button id="newMatchBtn" class="primary">다음 경기 배정 →</button><button id="repeatStoryBtn" class="secondary">첫 휘슬 다시 하기</button></div>`;
 $('newMatchBtn').onclick=returnToLobby;$('repeatStoryBtn').onclick=openFirstWhistle;updateHUD();whistle();
}
function toggleEvidence(){
 if(!['result','evidence'].includes(mode))return;
 const opening=mode==='result';mode=opening?'evidence':'result';panel('resultPanel');reviewControls(opening);replayPlaying=false;replayTime=event().moment;setCamera('side');updateReplay();feed(opening?'근거 검토':record.correct?'판정 확정':'판정 오류','review');$('resultReplayBtn').textContent=opening?'판정 결과로 돌아가기':'근거 장면 다시 보기';
}
function openRule(key='offside'){
 const rule=RULEBOOK[key]||RULEBOOK.offside;$('ruleTitle').textContent=rule.title;$('ruleText').textContent=rule.text;document.querySelectorAll('.rule-tabs [data-rule]').forEach(b=>b.classList.toggle('selected',b.dataset.rule===key));if($('helpDialog').open)$('helpDialog').close();if(!$('rulesDialog').open)$('rulesDialog').showModal();
}

let perfFrames=0,perfSince=0;
function bind(){
 for(const id of ['firstWhistleBtn','lobbyStoryBtn','menuStoryBtn','helpStoryBtn'])$(id).onclick=openFirstWhistle;
 $('lobbyHelpBtn').onclick=()=>$('helpDialog').showModal();$('arrivalSkip').onclick=returnToLobby;$('storyExitBtn').onclick=returnToLobby;
 $('arrivalNext').onclick=()=>{if(story.arrival<ARRIVAL.length-1){story.arrival++;syncStory();}else startFirstWhistle();};
 $('coachAction').onclick=()=>{if(!story||mode!=='review')return;const action=$('coachAction').dataset.action;if(action==='contact')$('momentBtn').click();else if(action==='angle')setCamera(stadium.cameraMode==='goal'?'side':'goal');else if(action==='lines'){if(!drawEnabled)$('lineTool').click();}else if(action==='judge'){$('restartChoices').scrollIntoView({block:'nearest'});$('restartChoices').querySelector('button[data-restart]').focus();}};
 $('resetCameraBtn').onclick=()=>setCamera(stadium.cameraMode);$('rulesBtn').onclick=()=>openRule(selection.restart||'play');document.querySelectorAll('[data-rule]').forEach(b=>b.onclick=()=>openRule(b.dataset.rule));
  const localDev=['localhost','127.0.0.1','[::1]'].includes(location.hostname);$('devUnlockBtn').hidden=!localDev;$('devPerfBtn').hidden=!localDev;$('devPerfBtn').onclick=()=>{$('devPerformance').hidden=!$('devPerformance').hidden;$('menuDialog').close();};$('creditsBtn').onclick=()=>{$('menuDialog').close();$('creditsDialog').showModal();};$('devUnlockBtn').onclick=()=>{if(!localDev||mode!=='lobby')return;career={...career,reputation:800,level:5};selectedStageId='stadium';persistCareer();returnToLobby();};
  $('addedTimeBtn').onclick=openAddedTime;$('addedTimeClose').onclick=()=>$('addedTimeDialog').close();$('addedTimeDialog').addEventListener('cancel',e=>{if(matchClock.status==='awaiting-added-time')e.preventDefault();});
  $('addedTimeForm').onsubmit=e=>{e.preventDefault();const input=$('addedTimeInput');if(!input.reportValidity())return;try{allocateAddedTime(matchClock,input.valueAsNumber);}catch(error){input.setCustomValidity(error.message);input.reportValidity();return;}$('addedTimeDialog').close();updateHUD();};
  $('addedTimeInput').oninput=()=>$('addedTimeInput').setCustomValidity('');
  document.querySelectorAll('[data-added]').forEach(b=>b.onclick=()=>{$('addedTimeInput').value=b.dataset.added;$('addedTimeInput').setCustomValidity('');});
  $('addedTimeLess').onclick=()=>{$('addedTimeInput').stepDown();$('addedTimeInput').setCustomValidity('');};$('addedTimeMore').onclick=()=>{$('addedTimeInput').stepUp();$('addedTimeInput').setCustomValidity('');};

  $('motionLabBtn').onclick=openMotionLab;$('labClose').onclick=()=>{$('motionLab').hidden=true;mode='lobby';panel('lobby');stadium.players.forEach(p=>p.group.visible=true);stadium.ref.group.visible=true;stadium.ball.visible=true;stadium.ballShadow.visible=true;setCamera('broadcast');feed('경기 준비');};
  document.querySelectorAll('[data-motion]').forEach(b=>b.onclick=()=>{labType=b.dataset.motion;labTime=0;$('labReactionOptions').hidden=labType!=='reaction';$('labTimeline').max=labType==='reaction'?5.2:4;labPlaying=true;document.querySelectorAll('[data-motion]').forEach(a=>a.classList.toggle('selected',a===b));$('labPlay').textContent='일시정지';});
  $('labReaction').onchange=()=>{labVariant=$('labReaction').value;labTime=0;labPlaying=true;$('labPlay').textContent='일시정지';};
  $('labPlay').onclick=()=>{labPlaying=!labPlaying;$('labPlay').textContent=labPlaying?'일시정지':'동작 재생';};$('labJump').onclick=()=>{labTime=['pass','lob','shot','tackle','reaction'].includes(labType)?1.4:labType==='dribble'?1.28:.3;labPlaying=false;$('labPlay').textContent='동작 재생';};$('labNext').onclick=()=>{labTime=Math.min(labType==='reaction'?5.2:4,labTime+.2);labPlaying=false;$('labPlay').textContent='동작 재생';};$('labPrev').onclick=()=>{labTime=Math.max(0,labTime-.2);labPlaying=false;$('labPlay').textContent='동작 재생';};$('labTimeline').oninput=()=>{labTime=Number($('labTimeline').value);labPlaying=false;$('labPlay').textContent='동작 재생';};$('labSlow').onclick=()=>{labSpeed=labSpeed===1?.25:1;$('labSlow').textContent=labSpeed+'×';};
  $('startBtn').onclick=startCareerMatch;$('careerStartBtn').onclick=startCareerMatch;$('confirmBtn').onclick=()=>confirm(false);$('lobbyMenuBtn').onclick=()=>$('menuDialog').showModal();$('returnLobbyBtn').onclick=returnToLobby;
  document.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>setCamera(b.dataset.camera));document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{replaySpeed=Number(b.dataset.speed);document.querySelectorAll('[data-speed]').forEach(p=>{p.classList.toggle('selected',p===b);p.setAttribute('aria-pressed',String(p===b));});if(mode==='review')updateReplay();});
  document.querySelectorAll('[data-matchspeed]').forEach(b=>b.onclick=()=>{matchSpeed=Number(b.dataset.matchspeed);document.querySelectorAll('[data-matchspeed]').forEach(p=>{p.classList.toggle('selected',p===b);p.setAttribute('aria-pressed',String(p===b));});});
  document.querySelectorAll('[data-restart]').forEach(b=>b.onclick=()=>{selection=selectRestart(event(),b.dataset.restart,selection);$('beneficiary').value=selection.beneficiary;document.querySelectorAll('[data-restart]').forEach(p=>{p.classList.toggle('selected',p===b);p.setAttribute('aria-pressed',String(p===b));});$('confirmBtn').disabled=!!story&&!lessonReady(story);$('decisionHint').textContent=selection.restart==='offside'?'상대 팀 간접 프리킥 적용':'';});
  document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>{selection.card=b.dataset.card;document.querySelectorAll('[data-card]').forEach(p=>{p.classList.toggle('selected',p===b);p.setAttribute('aria-pressed',String(p===b));});$('targetLabel').hidden=selection.card==='none';});
  $('beneficiary').onchange=()=>selection.beneficiary=$('beneficiary').value;$('cardTarget').onchange=()=>selection.target=$('cardTarget').value;
  const step=d=>{if(!['review','evidence'].includes(mode))return;replayPlaying=false;contactLoop=false;replayTime=Math.max(0,Math.min(event().clipLength,replayTime+d/60));updateReplay();};$('prevFrame').onclick=()=>step(-1);$('nextFrame').onclick=()=>step(1);
  $('replayBtn').onclick=()=>{const wasForward=replayDirection===1;replayDirection=1;replayPlaying=!replayPlaying||!wasForward;updateReplay();};$('reverseBtn').onclick=()=>{const wasReverse=replayDirection===-1;replayDirection=-1;replayPlaying=!replayPlaying||!wasReverse;updateReplay();};$('momentBtn').onclick=()=>{if(story&&mode==='review')observeLesson(story,'contact');$('incidentToast').hidden=true;replayTime=event().moment;replayPlaying=false;contactLoop=false;updateReplay();syncStory();};$('whistleBtn').onclick=()=>{replayTime=event().whistleAt;replayPlaying=false;contactLoop=false;updateReplay();};$('loopBtn').onclick=()=>{contactLoop=!contactLoop;if(contactLoop){replayTime=event().moment-.55;replaySpeed=.25;replayDirection=1;replayPlaying=true;document.querySelectorAll('[data-speed]').forEach(b=>{b.classList.toggle('selected',b.dataset.speed==='0.25');b.setAttribute('aria-pressed',String(b.dataset.speed==='0.25'));});}updateReplay();};$('timeline').oninput=()=>{replayTime=Number($('timeline').value);replayPlaying=false;contactLoop=false;updateReplay();};
  $('lineTool').onclick=()=>turnDrawing(!drawEnabled);$('closeLines').onclick=()=>turnDrawing(false);document.querySelectorAll('[data-line]').forEach(b=>b.onclick=()=>{lineType=b.dataset.line;document.querySelectorAll('[data-line]').forEach(p=>p.classList.toggle('selected',p===b));$('drawInstruction').textContent=`${lineType==='defender'?'파란 수비':'주황 공격'} 기준선을 그을 위치를 선택하세요`;updateLines();});$('linePosition').oninput=()=>placeLine(Number($('linePosition').value));$('clearLines').onclick=()=>{stadium.clearLines();updateLines();};
  $('zoomTool').onclick=()=>{$('incidentToast').hidden=true;stadium.zoom=!stadium.zoom;stadium.cameraSnap=true;$('zoomTool').classList.toggle('active',stadium.zoom);$('zoomTool').setAttribute('aria-pressed',String(stadium.zoom));if(stadium.zoom){$('feedMeta').textContent='접촉 확대';$('cameraHint').textContent='접촉 확대 · 드래그로 접촉 부위를 다른 각도에서 확인';}else{setCamera(stadium.cameraMode);$('cameraHint').textContent='우클릭 드래그 회전 · 휠 확대';}};$('fullscreenBtn').hidden=!document.fullscreenEnabled;$('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('cameraHint').textContent='브라우저에서 전체 화면을 사용할 수 없습니다.';}};document.addEventListener('fullscreenchange',()=>{const on=!!document.fullscreenElement;$('fullscreenBtn').setAttribute('aria-pressed',String(on));$('fullscreenBtn').setAttribute('aria-label',on?'전체 화면 종료':'전체 화면');$('fullscreenBtn').title=on?'전체 화면 종료':'전체 화면';});
  $('pauseMatch').onclick=()=>{paused=!paused;$('pauseMatch').textContent=paused?'계속하기':'일시정지';$('pausedIndicator').hidden=!paused;feed(paused?'일시정지':'LIVE',paused?'':'live');};
  $('menuBtn').onclick=()=>$('menuDialog').showModal();$('helpBtn').onclick=()=>{$('menuDialog').close();$('helpDialog').showModal();};$('reportNav').onclick=showReport;document.querySelectorAll('dialog .dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if((e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)&&!(d.id==='addedTimeDialog'&&matchClock.status==='awaiting-added-time'))d.close();}}));
  $('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').textContent=sound?'소리 ON':'소리 OFF';$('soundBtn').setAttribute('aria-label',sound?'경기 소리 끄기':'경기 소리 켜기');$('soundBtn').setAttribute('aria-pressed',String(sound));if(sound)tone(800,.08);};
  let drag=null;$('viewport').addEventListener('pointerdown',e=>{if(e.target!==stadium.renderer.domElement)return;if(![0,2].includes(e.button))return;drag={x:e.clientX,y:e.clientY,button:e.button};stadium.renderer.domElement.setPointerCapture(e.pointerId);if(drawEnabled&&e.button===0){const hit=stadium.groundAt(e.clientX,e.clientY);if(hit)placeLine(hit.x);}});$('viewport').addEventListener('pointermove',e=>{if(!drag)return;if(drawEnabled&&drag.button===0){const hit=stadium.groundAt(e.clientX,e.clientY);if(hit)placeLine(hit.x);}else{stadium.rotate(e.clientX-drag.x,e.clientY-drag.y);if(story&&mode==='review'&&Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>2){observeLesson(story,'angle');syncStory();}}drag={x:e.clientX,y:e.clientY,button:drag.button};});$('viewport').addEventListener('contextmenu',e=>{if(e.target===stadium.renderer.domElement)e.preventDefault();});$('viewport').addEventListener('pointerup',()=>drag=null);$('viewport').addEventListener('pointercancel',()=>drag=null);$('viewport').addEventListener('wheel',e=>{e.preventDefault();stadium.zoomFactor=Math.max(.3,Math.min(1.8,stadium.zoomFactor+e.deltaY*.0006));},{passive:false});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')){e.preventDefault();$('menuDialog').showModal();return;}if(['INPUT','SELECT','TEXTAREA','BUTTON','SUMMARY'].includes(e.target.tagName)||document.querySelector('dialog[open]')||['lab','briefing'].includes(mode))return;if(['1','2','3','4','5'].includes(e.key)){setCamera(['broadcast','side','goal','top','referee'][Number(e.key)-1]);return;}if(!['review','evidence'].includes(mode))return;if(e.code==='Space'){e.preventDefault();$('replayBtn').click();}if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}if(e.key==='ArrowRight'){e.preventDefault();step(1);}});
}
function tick(now){const realDelta=Math.max(0,(now-last)/1000),dt=Math.min(.15,realDelta);last=now;const blocked=paused||document.hidden||!!document.querySelector('dialog[open]'),step=blocked?0:dt*matchSpeed;if(!blocked)ambientTime+=dt;if(toastUntil&&now>toastUntil){$('careerToast').hidden=true;toastUntil=0;}
  if(mode==='lab'){if(labPlaying&&!blocked)labTime=(labTime+dt*labSpeed)%(labType==='reaction'?5.2:4);const action=stadium.lab(labTime,labType,labVariant);$('labReadout').textContent=action+' · '+labTime.toFixed(2)+'s';$('labTimeline').value=labTime;}
  else if(mode==='lobby'||mode==='briefing'){if(stadium.lobby)stadium.lobby(ambientTime);else stadium.ambient(ambientTime);}
  else if(mode==='halftime'){
    stageTime+=step;$('matchFade').style.opacity=Math.min(1,stageTime/.45);$('matchFade').textContent='HALF TIME · '+match.score.home+' : '+match.score.away;
    if(stageTime>=2.6){startSecondHalf(matchClock);match.index++;stadium.useHalf(2);beginFlow(kickoffFrame(stadium.roster(),'away',2),true);}
  }
  else if(mode==='live'){
    if(livePhase==='flow'||livePhase==='closing'){
      const elapsed=clockForward(Math.min(step,sequence.duration-flowTime));
      flowTime=Math.min(sequence.duration,flowTime+elapsed);const play=stadium.flow(sequence,flowTime);applyFlowEvents(match,sequence,flowTime);match.possession=play.team;
      $('liveTitle').textContent=play.phase==='goal'?'득점!':'플레이 진행 중';$('liveDescription').textContent=TEAMS[play.team]+' · '+play.action;$('flowText').textContent=TEAMS[play.team]+' · '+play.action;$('matchFade').style.opacity=play.fade;$('matchFade').textContent='GOAL · '+TEAMS[play.goal||play.team];if(!blocked)feed(play.phase==='goal'?'GOAL':'LIVE','live');
      if(livePhase==='closing'){if(!blocked&&periodEnded(matchClock))endPeriod();else if(!blocked&&play.done)beginClosingFlow(stadium.capture(play.team));}else if(play.done){livePhase='incident';stageTime=0;match.possession=event().attack;}
    }else{
      clockForward(Math.min(step,event().stoppageAt-stageTime));stageTime=Math.min(event().stoppageAt,stageTime+step);stadium.pose(stageTime,'live');$('liveTitle').textContent='플레이 진행 중';$('liveDescription').textContent=TEAMS[event().attack]+' · 공격 전개';$('flowText').textContent=TEAMS[event().attack]+' · 공격 전개';
      if(stageTime>=event().whistleAt&&!whistlePlayed){whistlePlayed=true;whistle();feed('WHISTLE','review');}
      if(stageTime>=event().stoppageAt){const at=(event().minute-(matchClock.half-1)*45)/CLOCK_RATE;matchClock.elapsed=story?Math.max(matchClock.elapsed,at):at;match.minute=matchMinute(matchClock);enterReview();}
    }
    updateHUD();
  }else if(mode==='review'||mode==='evidence'){if(replayPlaying&&!blocked){replayTime+=dt*replaySpeed*replayDirection;const start=contactLoop?event().moment-.55:0,end=contactLoop?Math.min(event().clipLength,event().moment+.55):event().clipLength;if(replayTime>end)replayTime=start;if(replayTime<start)replayTime=end;updateReplay();}stadium.pose(replayTime,'review');if(mode==='review'&&!story){const expired=advanceReviewTimer(reviewTimer,realDelta,blocked);updateReviewTimer();if(expired)confirm(true);}}
  else if(mode==='result')stadium.pose(event().moment,'result');
  else if(mode==='resume'){
    stageTime+=step;clockForward(step);const play=stadium.resume(stageTime,record,restartPosition(event(),record.decision));
    if(record.goal&&!record.goalApplied&&play.phase==='goal'){match.score[record.decision.beneficiary]++;record.goalApplied=true;record.score={...match.score};}
    match.possession=play.team;$('liveTitle').textContent=play.inPlay?'플레이 진행 중':play.phase==='goal'?'득점!':play.phase==='kickoff'?'상대 팀 킥오프':RESTARTS[record.decision.restart];$('liveDescription').textContent=TEAMS[play.team]+' · '+play.action;$('flowText').textContent=TEAMS[play.team]+' · '+play.action;$('matchFade').style.opacity=play.fade;$('matchFade').textContent=record.goal?'GOAL · 상대 팀 킥오프':'';if(!blocked)feed(play.inPlay?'LIVE':play.phase==='goal'?'GOAL':'경기 재개','live');updateHUD();if(!blocked)completeRestart(play);
  }
  stadium.render();perfFrames++;if(now-perfSince>=500){const info=stadium.renderer.info.render;$('devPerformance').textContent=`${Math.round(perfFrames*1000/(now-perfSince))} FPS · 삼각형 ${info.triangles.toLocaleString('ko-KR')} · 드로콜 ${info.calls}`;perfFrames=0;perfSince=now;}requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{last=performance.now();});
try{stadium=new Stadium($('viewport'));await waitForAthleteTextures();bind();reviewControls(false);updateHUD();renderCareer();stadium.setStage?.(selectedStageId);$('loading').hidden=true;persistCareer();if(!storyProgress.seen&&career.matches===0)openFirstWhistle();requestAnimationFrame(tick);}catch(err){console.error(err);$('loading').innerHTML='<div style="padding:30px;line-height:1.9;text-align:center">게임 화면과 모델을 불러올 수 없습니다.<br>연결 상태를 확인하고 하드웨어 가속을 지원하는 최신 브라우저에서 다시 열어주세요.</div>';$('startBtn').disabled=true;$('careerStartBtn').disabled=true;}



