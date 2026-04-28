// 오늘 하루 동안 AI 변환 호출 횟수를 제한하기 위한 클라이언트 측 카운터.
//
// 주의: 이 제한은 보안용이 아니라 MVP UX 가드(과다 호출 방지) 다.
// 실제 키 보호와 호출 제한은 서버(Vercel Serverless Function) 와 OpenAI 측에서 수행한다.
//
// localStorage 구조:
//   { date: "YYYY-MM-DD", count: number }
// 날짜가 바뀌면 count 를 자동으로 초기화한다.

const STORAGE_KEY = "work_toolkit_ai_usage";
export const DAILY_LIMIT = 5;

type UsageRecord = {
  date: string;
  count: number;
};

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function readUsage(): UsageRecord {
  const fallback: UsageRecord = { date: todayKey(), count: 0 };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<UsageRecord>;
    const today = todayKey();
    if (parsed.date !== today) return { date: today, count: 0 };
    const count = typeof parsed.count === "number" && parsed.count >= 0 ? parsed.count : 0;
    return { date: today, count };
  } catch {
    return fallback;
  }
}

function writeUsage(record: UsageRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // 저장 실패 무시 — 카운트가 일시적으로 리셋될 수 있을 뿐 동작은 영향 없음.
  }
}

export function getRemainingAIUsage(): number {
  const u = readUsage();
  return Math.max(0, DAILY_LIMIT - u.count);
}

export function canUseAI(): boolean {
  return getRemainingAIUsage() > 0;
}

/**
 * AI 호출이 성공했을 때만 호출하여 카운트를 1 증가시킨다.
 * 실패한 호출은 사용자가 보상 받지 못하면 안 되므로 카운트하지 않는다.
 */
export function incrementAIUsage(): UsageRecord {
  const u = readUsage();
  const next: UsageRecord = { date: u.date, count: u.count + 1 };
  writeUsage(next);
  return next;
}
