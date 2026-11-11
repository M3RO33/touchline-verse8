export function createReviewTimer(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('판정 시간은 양수여야 합니다.');
  return { limit: seconds, remaining: seconds, expired: false };
}
export function advanceReviewTimer(timer, realSeconds, paused = false) {
  if (!Number.isFinite(realSeconds) || realSeconds < 0) throw new RangeError('경과 시간이 올바르지 않습니다.');
  if (paused || timer.expired) return false;
  timer.remaining = Math.max(0, timer.remaining - realSeconds);
  if (timer.remaining <= 1e-8) { timer.remaining = 0; timer.expired = true; return true; }
  return false;
}
export function reviewTimerReading(timer) {
  if (!timer) return { seconds: 0, text: '—', ratio: 1, urgent: false };
  const seconds = Math.ceil(timer.remaining);
  return { seconds, text: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, ratio: timer.remaining / timer.limit, urgent: timer.remaining <= 15 };
}
