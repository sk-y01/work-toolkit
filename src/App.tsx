import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkbookHeader } from "./components/WorkbookHeader";
import { StatusBar } from "./components/StatusBar";
import { PracticeGrid, type MoveDirection } from "./components/PracticeGrid";
import { SummaryBar } from "./components/SummaryBar";
import { SheetTabs } from "./components/SheetTabs";
import { ConverterModal } from "./components/ConverterModal";
import { AuthModal } from "./components/AuthModal";
import { HelpModal } from "./components/HelpModal";
import { useAuth } from "./hooks/useAuth";
import { useDarkMode } from "./hooks/useDarkMode";
import { useIsMobile } from "./hooks/useIsMobile";
import { SHEETS } from "./data/sampleData";
import type { CellPosition, GridState, PracticeRecord } from "./types";
import {
  calcAccuracy,
  commitCell,
  countAttempted,
  countCompletedRows,
  countCorrect,
  createEmptyGrid,
  findNextError,
  getErrorPositions,
  isAllAttempted,
  toCellAddress,
} from "./utils/grid";
import { formatElapsed, formatRowSeconds } from "./utils/time";
import { appendRecord, loadStats } from "./utils/storage";
import styles from "./App.module.css";

const HELP_SEEN_KEY = "work_toolkit.help_seen.v1";
const ACTIVE_SHEET_KEY = "work_toolkit_active_sheet";

// 새로고침 후에도 사용자가 보고 있던 시트를 유지하기 위해 localStorage 에서 초기 시트 id 를 읽는다.
// 저장된 값이 없거나 SHEETS 정의에 없는 무효한 id 면 "sheet1" 으로 폴백한다.
function readInitialSheetId(): string {
  if (typeof window === "undefined") return SHEETS[0].id;
  try {
    const saved = window.localStorage.getItem(ACTIVE_SHEET_KEY);
    if (saved && SHEETS.some((s) => s.id === saved)) return saved;
  } catch {
    // 접근 실패 시에는 기본 시트로 폴백 — 사용자 흐름을 막지 않는다.
  }
  return SHEETS[0].id;
}

// 시트별로 독립적인 입력/통계 흐름을 유지하기 위한 상태 묶음.
// 사용자가 탭을 전환하면 현재 시트의 진행도가 그대로 보존되어 다른 시트로 옮겨가도 잃지 않는다.
type SheetState = {
  grid: GridState;
  active: CellPosition;
  startedAt: number | null;
  finishedAt: number | null;
  lastRowDurationMs: number | null;
  rowStartedAt: number | null;
  fixMode: boolean;
  completionSaved: boolean;
};

function makeInitialSheetState(rows: number, cols: number): SheetState {
  return {
    grid: createEmptyGrid(rows, cols),
    active: { row: 0, col: 0 },
    startedAt: null,
    finishedAt: null,
    lastRowDurationMs: null,
    rowStartedAt: null,
    fixMode: false,
    completionSaved: false,
  };
}

export default function App() {
  const [activeSheetId, setActiveSheetId] = useState<string>(readInitialSheetId);

  // 시트 변경 시 즉시 localStorage 에 반영. useEffect 로 처리해 동기화 누락이 없게 한다.
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_SHEET_KEY, activeSheetId);
    } catch {
      // 저장 실패는 무시 — 다음 새로고침에 기본 시트로 돌아갈 뿐 동작 자체에는 영향 없음.
    }
  }, [activeSheetId]);

  const [sheetStates, setSheetStates] = useState<Record<string, SheetState>>(() => {
    const map: Record<string, SheetState> = {};
    for (const s of SHEETS) {
      map[s.id] = makeInitialSheetState(s.data.length, s.columns.length);
    }
    return map;
  });

  const sheet = useMemo(
    () => SHEETS.find((s) => s.id === activeSheetId) ?? SHEETS[0],
    [activeSheetId]
  );
  const expected = sheet.data;
  const COLUMNS = sheet.columns;
  const ROWS = sheet.data.length;
  const COLS = sheet.columns.length;

  const sheetState = sheetStates[activeSheetId];
  const grid = sheetState.grid;
  const active = sheetState.active;
  const startedAt = sheetState.startedAt;
  const finishedAt = sheetState.finishedAt;
  const lastRowDurationMs = sheetState.lastRowDurationMs;
  const fixMode = sheetState.fixMode;

  const updateSheet = useCallback(
    (id: string, updater: (prev: SheetState) => SheetState) => {
      setSheetStates((prev) => {
        const cur = prev[id];
        if (!cur) return prev;
        const next = updater(cur);
        if (next === cur) return prev;
        return { ...prev, [id]: next };
      });
    },
    []
  );

  const [now, setNow] = useState<number>(() => Date.now());
  const [stats, setStats] = useState(() => loadStats());
  const [isConverterOpen, setConverterOpen] = useState(false);
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [isHelpOpen, setHelpOpen] = useState(false);

  const auth = useAuth();
  const { isDark, toggle: toggleTheme } = useDarkMode();
  const isMobile = useIsMobile();

  // 최초 진입 시(localStorage 미설정) 도움말을 1회 자동 노출.
  // 사용자가 닫으면 플래그가 저장되어 다음 방문부터는 자동으로 뜨지 않는다.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(HELP_SEEN_KEY);
      if (!seen) setHelpOpen(true);
    } catch {
      // 접근 실패 시에도 사용자 흐름을 막지 않기 위해 안내만 생략한다.
    }
  }, []);

  const handleHelpClose = useCallback(() => {
    setHelpOpen(false);
    try {
      window.localStorage.setItem(HELP_SEEN_KEY, "1");
    } catch {
      // 저장 실패는 무시 — 다음 방문에서 한 번 더 보일 뿐 동작은 영향 없음.
    }
  }, []);

  // 경과 시간 타이머: 시작된 시점이 있고 아직 완료되지 않은 경우에만 동작.
  useEffect(() => {
    if (startedAt === null || finishedAt !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 150);
    return () => window.clearInterval(id);
  }, [startedAt, finishedAt]);

  const correctCount = useMemo(() => countCorrect(grid), [grid]);
  const attemptedCount = useMemo(() => countAttempted(grid), [grid]);
  const completedRows = useMemo(() => countCompletedRows(grid), [grid]);
  const errorPositions = useMemo(() => getErrorPositions(grid), [grid]);

  const accuracy = calcAccuracy(correctCount, attemptedCount);
  const errors = errorPositions.length;

  const elapsedMs =
    startedAt === null ? 0 : Math.max(0, (finishedAt ?? now) - startedAt);
  const lastRowLabel = lastRowDurationMs === null ? null : formatRowSeconds(lastRowDurationMs);

  const activateCell = useCallback(
    (pos: CellPosition) => {
      updateSheet(activeSheetId, (prev) => {
        if (prev.active.row === pos.row && prev.active.col === pos.col) return prev;
        // 행이 바뀌면 직전 행의 입력 시간을 마감해 lastRowDurationMs 에 반영한다.
        let lastRowDuration = prev.lastRowDurationMs;
        let rowStartedAt = prev.rowStartedAt;
        if (prev.active.row !== pos.row && prev.startedAt !== null) {
          const t = Date.now();
          if (rowStartedAt !== null) {
            lastRowDuration = Math.max(0, t - rowStartedAt);
          }
          rowStartedAt = t;
        }
        return {
          ...prev,
          active: pos,
          lastRowDurationMs: lastRowDuration,
          rowStartedAt,
        };
      });
    },
    [activeSheetId, updateSheet]
  );

  // blur 등으로 호출되는 평가 커밋. 상태 적용만 담당.
  const evaluateCommit = useCallback(
    (pos: CellPosition) => {
      updateSheet(activeSheetId, (prev) => ({
        ...prev,
        grid: commitCell(prev.grid, pos, expected[pos.row]?.[pos.col] ?? ""),
      }));
    },
    [activeSheetId, expected, updateSheet]
  );

  const changeCell = useCallback(
    (pos: CellPosition, value: string) => {
      updateSheet(activeSheetId, (prev) => {
        const cell = prev.grid[pos.row]?.[pos.col];
        if (!cell) return prev;
        if (cell.value === value) return prev;

        // 첫 입력 시점에 startedAt 을 세팅 — 이후 경과시간 타이머가 가동된다.
        const t = Date.now();
        const startedAt = prev.startedAt ?? t;
        const rowStartedAt = prev.rowStartedAt ?? t;

        const nextRow = prev.grid[pos.row].slice();
        nextRow[pos.col] = { ...cell, value, status: "empty" };
        const nextGrid = prev.grid.slice();
        nextGrid[pos.row] = nextRow;

        return {
          ...prev,
          grid: nextGrid,
          startedAt,
          rowStartedAt,
        };
      });
      // 첫 입력 직후 경과시간 표시가 0:00 인 채 멈춰있지 않도록 now 도 동기화.
      if (startedAt === null) setNow(Date.now());
    },
    [activeSheetId, startedAt, updateSheet]
  );

  // 메인 이동 핸들러.
  // 커밋 후 grid 를 즉시 계산해 완료/오류 탐색 판단에 사용한다.
  // - "next": Tab 오른쪽 이동, 행 끝이면 다음 행 첫 셀
  // - "enter": 같은 열의 아래 행, 마지막 행이면 다음 열 첫 행, 마지막 셀이면 A1로 순환
  //            fixMode 일 때는 다음 오류 셀로 점프 (이 흐름 덕분에 오류만 빠르게 수정 가능)
  // - "down"/"up": 세로 1칸 이동
  const move = useCallback(
    (direction: MoveDirection) => {
      updateSheet(activeSheetId, (prev) => {
        const a = prev.active;
        const target = expected[a.row]?.[a.col] ?? "";
        const committedGrid = commitCell(prev.grid, a, target);

        let next: CellPosition = { row: a.row, col: a.col };
        let fixModeNext = prev.fixMode;

        if (direction === "next") {
          let c = a.col + 1;
          let r = a.row;
          if (c >= COLS) {
            c = 0;
            r = Math.min(ROWS - 1, r + 1);
          }
          next = { row: r, col: c };
        } else if (direction === "enter") {
          if (prev.fixMode) {
            const nextErr = findNextError(getErrorPositions(committedGrid), a);
            if (nextErr) {
              next = nextErr;
            } else {
              fixModeNext = false;
            }
          } else {
            // 마지막 셀(C12)이면 A1으로 순환 — useEffect 가 모든 셀이 평가됐는지 확인 후 1회 완료 전이.
            if (a.row < ROWS - 1) {
              next = { row: a.row + 1, col: a.col };
            } else if (a.col < COLS - 1) {
              next = { row: 0, col: a.col + 1 };
            } else {
              next = { row: 0, col: 0 };
            }
          }
        } else if (direction === "down") {
          next = { row: Math.min(ROWS - 1, a.row + 1), col: a.col };
        } else if (direction === "up") {
          next = { row: Math.max(0, a.row - 1), col: a.col };
        }
        // NOTE: "prev" (Shift+Tab / ArrowLeft) 역방향 이동은 MVP에서 비활성화되어 있다.

        // 행이 바뀐 경우, 직전 행 입력 시간을 마감하여 lastRowDurationMs 에 반영.
        let lastRowDuration = prev.lastRowDurationMs;
        let rowStartedAt = prev.rowStartedAt;
        if (next.row !== a.row && prev.startedAt !== null) {
          const t = Date.now();
          if (rowStartedAt !== null) {
            lastRowDuration = Math.max(0, t - rowStartedAt);
          }
          rowStartedAt = t;
        }

        return {
          ...prev,
          grid: committedGrid,
          active: next,
          fixMode: fixModeNext,
          lastRowDurationMs: lastRowDuration,
          rowStartedAt,
        };
      });
    },
    [activeSheetId, expected, ROWS, COLS, updateSheet]
  );

  // 완료 상태 전이 — 모든 셀이 최소 1회 평가된 시점에 시트당 딱 한 번만 발동한다.
  // completionSavedRef 대신 sheetState.completionSaved 로 가드해 시트 전환에도 안전하게 작동한다.
  useEffect(() => {
    if (finishedAt !== null || sheetState.completionSaved) return;
    if (!isAllAttempted(grid)) return;
    if (startedAt === null) return;

    const end = Date.now();

    const record: PracticeRecord = {
      date: new Date(end).toISOString(),
      accuracy: calcAccuracy(correctCount, attemptedCount),
      totalTimeSec: Math.round((end - startedAt) / 1000),
      errors: errorPositions.length,
      completedRows,
      totalRows: ROWS,
    };
    const nextStats = appendRecord(record);
    setStats(nextStats);

    updateSheet(activeSheetId, (prev) => ({
      ...prev,
      finishedAt: end,
      completionSaved: true,
    }));
  }, [
    grid,
    finishedAt,
    startedAt,
    correctCount,
    attemptedCount,
    errorPositions,
    completedRows,
    sheetState.completionSaved,
    activeSheetId,
    updateSheet,
    ROWS,
  ]);

  // 모든 오류가 해결되면 수정 모드를 자동 해제한다.
  // 사용자가 수정 모드 진입 후 빠르게 모든 오류를 고쳤을 때 모드 표시가 잔존하는 것을 막는다.
  useEffect(() => {
    if (fixMode && errorPositions.length === 0) {
      updateSheet(activeSheetId, (prev) => ({ ...prev, fixMode: false }));
    }
  }, [fixMode, errorPositions, activeSheetId, updateSheet]);

  const handleReset = useCallback(() => {
    setSheetStates((prev) => {
      const cur = prev[activeSheetId];
      if (!cur) return prev;
      return {
        ...prev,
        [activeSheetId]: makeInitialSheetState(ROWS, COLS),
      };
    });
  }, [activeSheetId, ROWS, COLS]);

  const handleStartFixMode = useCallback(() => {
    if (errorPositions.length === 0) return;
    const first = errorPositions[0];
    updateSheet(activeSheetId, (prev) => {
      let lastRowDuration = prev.lastRowDurationMs;
      let rowStartedAt = prev.rowStartedAt;
      if (first.row !== prev.active.row && prev.startedAt !== null) {
        const t = Date.now();
        if (rowStartedAt !== null) {
          lastRowDuration = Math.max(0, t - rowStartedAt);
        }
        rowStartedAt = t;
      }
      return {
        ...prev,
        fixMode: true,
        active: first,
        lastRowDurationMs: lastRowDuration,
        rowStartedAt,
      };
    });
  }, [errorPositions, activeSheetId, updateSheet]);

  // "오류 N건" 클릭 → 현재 활성 셀 다음에 위치한 오류 셀로 순환 이동
  const handleErrorCycle = useCallback(() => {
    const nextErr = findNextError(errorPositions, active);
    if (!nextErr) return;
    updateSheet(activeSheetId, (prev) => {
      let lastRowDuration = prev.lastRowDurationMs;
      let rowStartedAt = prev.rowStartedAt;
      if (nextErr.row !== prev.active.row && prev.startedAt !== null) {
        const t = Date.now();
        if (rowStartedAt !== null) {
          lastRowDuration = Math.max(0, t - rowStartedAt);
        }
        rowStartedAt = t;
      }
      return {
        ...prev,
        active: nextErr,
        lastRowDurationMs: lastRowDuration,
        rowStartedAt,
      };
    });
  }, [errorPositions, active, activeSheetId, updateSheet]);

  // Ctrl + / 단축키로 변환 모달 토글. 데스크톱 사용자의 빠른 진입 경로.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setConverterOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const cellAddress = toCellAddress(active.row, active.col);
  const totalTimeSec =
    startedAt !== null && finishedAt !== null ? Math.round((finishedAt - startedAt) / 1000) : 0;

  // 완료 후 잔존/신규 오류가 있으면 "오류 수정 중" 으로 표시한다.
  const isFixingAfterComplete = finishedAt !== null && errors > 0;
  const completeLabel = isFixingAfterComplete ? "오류 수정 중" : "완료";

  // 모바일 "제출" 버튼은 현재 셀에 입력값이 있어야 활성화된다.
  // 빈 셀에서 누르면 평가가 unset 상태로 남아 사용자에게 의미 있는 피드백이 없기 때문이다.
  const currentCellValue = grid[active.row]?.[active.col]?.value ?? "";
  const submitDisabled = currentCellValue.trim().length === 0;

  const sheetTabs = useMemo(
    () => SHEETS.map((s) => ({ id: s.id, label: s.label })),
    []
  );

  return (
    <div className={styles.app}>
      <WorkbookHeader
        saved
        authConfigured={auth.configured}
        authLoading={auth.loading}
        user={auth.user}
        onAccountClick={() => setAuthOpen(true)}
        onHelpClick={() => setHelpOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
      />
      <StatusBar
        cellAddress={cellAddress}
        elapsedLabel={formatElapsed(elapsedMs)}
        lastRowLabel={lastRowLabel}
        accuracy={accuracy}
        onReset={handleReset}
        onSubmit={() => move("enter")}
        submitDisabled={submitDisabled}
      />
      <main className={styles.main}>
        <PracticeGrid
          columns={COLUMNS}
          expected={expected}
          grid={grid}
          active={active}
          onActivate={activateCell}
          onChange={changeCell}
          onCommit={evaluateCommit}
          onMove={move}
        />
        {finishedAt !== null && (
          <div
            className={`${styles.complete} ${
              isFixingAfterComplete ? styles.completeWarn : ""
            }`}
            role="status"
          >
            <div className={styles.completeHead}>
              <span
                className={`${styles.completeTitle} ${
                  isFixingAfterComplete ? styles.completeTitleWarn : ""
                }`}
              >
                {completeLabel}
              </span>
            </div>
            <div className={styles.completeStats}>
              <div className={styles.completeItem}>
                <span className={styles.completeLabel}>총 소요 시간</span>
                <span className={styles.completeValue}>
                  {formatElapsed(totalTimeSec * 1000)}
                  <span className={styles.completeSub}>({totalTimeSec}초)</span>
                </span>
              </div>
              <div className={styles.completeItem}>
                <span className={styles.completeLabel}>정확도</span>
                <span className={styles.completeValue}>{accuracy}%</span>
              </div>
              <button
                type="button"
                className={`${styles.completeItem} ${styles.completeErrorBtn}`}
                onClick={handleErrorCycle}
                disabled={errors === 0}
                title={errors > 0 ? "클릭해서 오류 셀로 이동" : "오류 없음"}
              >
                <span className={styles.completeLabel}>오류 수</span>
                <span
                  className={`${styles.completeValue} ${
                    errors > 0 ? styles.completeValueWarn : ""
                  }`}
                >
                  {errors}건
                </span>
              </button>
            </div>
            <div className={styles.completeActions}>
              {errors > 0 && (
                <button
                  type="button"
                  className="wb-btn"
                  onClick={handleStartFixMode}
                  aria-pressed={fixMode}
                >
                  오류 수정하기
                </button>
              )}
              <button type="button" className="wb-btn wb-btn--primary" onClick={handleReset}>
                다시 시작
              </button>
            </div>
          </div>
        )}
      </main>
      <SummaryBar
        completedRows={completedRows}
        totalRows={ROWS}
        errors={errors}
        bestAccuracy={stats.bestAccuracy}
        onErrorClick={handleErrorCycle}
      />
      <SheetTabs tabs={sheetTabs} activeId={activeSheetId} onSelect={setActiveSheetId} />
      <div className={styles.hint}>
        <span className={styles.hintItem}>
          <kbd>Tab</kbd> 이동
        </span>
        <span className={styles.hintDivider} aria-hidden="true" />
        <span className={styles.hintItem}>
          <kbd>Enter</kbd> 아래 이동
        </span>
        <span className={styles.hintDivider} aria-hidden="true" />
        <span className={styles.hintItem}>
          <kbd>Ctrl</kbd>+<kbd>/</kbd> 문장 변환
        </span>
      </div>

      {/* 우측 하단 플로팅 — 모바일에서 단축키(Ctrl+/) 를 쓸 수 없는 환경의 보조 진입점.
          피드백 링크는 SummaryBar 안으로 옮겨 이 영역과의 시각적 충돌을 줄였다. */}
      <button
        type="button"
        className={styles.fab}
        onClick={() => setConverterOpen(true)}
        aria-label="문장 변환 열기"
        title="문장 변환 (Ctrl+/)"
      >
        <span className={styles.fabIcon} aria-hidden="true">✎</span>
        <span className={styles.fabLabel}>문장 변환</span>
      </button>

      <ConverterModal open={isConverterOpen} onClose={() => setConverterOpen(false)} />
      <AuthModal
        open={isAuthOpen}
        onClose={() => setAuthOpen(false)}
        configured={auth.configured}
        user={auth.user}
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onSignOut={auth.signOut}
      />
      <HelpModal open={isHelpOpen} onClose={handleHelpClose} isMobile={isMobile} />
    </div>
  );
}
