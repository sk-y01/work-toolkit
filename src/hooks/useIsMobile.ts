import { useEffect, useState } from "react";

const QUERY = "(max-width: 900px)";

/**
 * 데스크톱/모바일을 분기해 표시할 안내문구나 버튼 노출 여부를 결정하는 데 사용한다.
 * 단순한 너비 미디어 쿼리이며 터치 디바이스 정확 검출은 시도하지 않는다.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
