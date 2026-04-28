import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "work_toolkit.theme";
type Theme = "light" | "dark";

function readInitial(): Theme {
  // SSR/테스트 환경처럼 window 가 없는 경우의 안전 기본값.
  if (typeof window === "undefined") return "light";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // 접근 불가(예: privacy mode) — 기본값으로 폴백한다.
  }
  return "light";
}

/**
 * 다크모드 상태를 localStorage에 보존하면서 <html data-theme> 속성으로 노출한다.
 * 새로고침 후에도 동일 모드가 유지되어 사용자의 설정 일관성을 깨지 않는다.
 */
export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = theme;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // 저장 실패는 무시 — 다음 세션에서 다시 라이트로 시작될 뿐 동작 자체는 영향 없음.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  return { theme, isDark: theme === "dark", toggle };
}
