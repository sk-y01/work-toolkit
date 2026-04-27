import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorkbookHeader } from "./components/WorkbookHeader";
import { StatusBar } from "./components/StatusBar";
import { PracticeGrid, type MoveDirection } from "./components/PracticeGrid";
import { SummaryBar } from "./components/SummaryBar";
import { SheetTabs } from "./components/SheetTabs";
import { ConverterModal } from "./components/ConverterModal";
import { AuthModal } from "./components/AuthModal";
import { useAuth } from "./hooks/useAuth";
import { COLUMNS, SAMPLE_DATA } from "./data/sampleData";
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

const ROWS = SAMPLE_DATA.length;
const COLS = COLUMNS.length;

export default function App() {
  const expected = SAMPLE_DATA;

  const [grid, setGrid] = useState<GridState>(() => createEmptyGrid(ROWS, COLS));
  const [active, setActive] = useState<CellPosition>({ row: 0, col: 0 });

  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const rowStartedAtRef = useRef<number | null>(null);
  const [lastRowDurationMs, setLastRowDurationMs] = useState<number | null>(null);

  const [fixMode, setFixMode] = useState(false);

  const [stats, setStats] = useState(() => loadStats());
  const [isConverterOpen, setConverterOpen] = useState(false);
  const [isAuthOpen, setAuthOpen] = useState(false);

  const auth = useAuth();

  const completionSavedRef = useRef(false);

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

  const markRowChanged = useCallback(() => {
    const t = Date.now();
    if (rowStartedAtRef.current !== null) {
      setLastRowDurationMs(Math.max(0, t - rowStartedAtRef.current));
    }
    rowStartedAtRef.current = t;
  }, []);

  const activateCell = useCallback(
    (pos: CellPosition) => {
      setActive((prev) => {
        if (prev.row === pos.row && prev.col === pos.col) return prev;
        if (prev.row !== pos.row && startedAt !== null) {
          markRowChanged();
        }
        return pos;
      });
    },
    [startedAt, markRowChanged]
  );

  // blur 등으로 호출되는 평가 커밋. 상태 적용만 담당.
  const evaluateCommit = useCallback(
    (pos: CellPosition) => {
      setGrid((prev) => commitCell(prev, pos, expected[pos.row]?.[pos.col] ?? ""));
    },
    [expected]
  );

  const changeCell = useCallback(
    (pos: CellPosition, value: string) => {
      if (startedAt === null) {
        const t = Date.now();
        setStartedAt(t);
        setNow(t);
        rowStartedAtRef.current = t;
      }
      setGrid((prev) => {
        const cell = prev[pos.row]?.[pos.col];
        if (!cell) return prev;
        if (cell.value === value) return prev;
        const nextRow = prev[pos.row].slice();
        nextRow[pos.col] = { ...cell, value, status: "empty" };
        const nextGrid = prev.slice();
        nextGrid[pos.row] = nextRow;
        return nextGrid;
      });
    },
    [startedAt]
  );

  // 메인 이동 핸들러. 커밋 후 grid 를 즉시 계산해 완료/오류 탐색 판단에 사용한다.
  const move = useCallback(
    (direction: MoveDirection) => {
      const target = expected[active.row]?.[active.col] ?? "";
      const committedGrid = commitCell(grid, active, target);
      setGrid(committedGrid);

      let next: CellPosition = { row: active.row, col: active.col };

      if (direction === "next") {
        // Tab: 오른쪽 이동. 행 끝이면 다음 행 첫 셀.
        let c = active.col + 1;
        let r = active.row;
        if (c >= COLS) {
          c = 0;
          r = Math.min(ROWS - 1, r + 1);
        }
        next = { row: r, col: c };
      } else if (direction === "enter") {
        if (fixMode) {
          // 수정 모드: 다음 오류 셀로 이동. 없으면 수정 모드 해제.
          const nextErr = findNextError(getErrorPositions(committedGrid), active);
          if (nextErr) {
            next = nextErr;
          } else {
            setFixMode(false);
          }
        } else {
          // Enter: 세로 이동. 같은 열의 아래 행으로.
          // 마지막 행이면 다음 열의 첫 행, 마지막 셀(C12)이면 A1으로 순환.
          // A1로 돌아갈 때 모든 셀이 평가된 상태라면 useEffect 가 완료 전이를 1회 트리거한다.
          if (active.row < ROWS - 1) {
            next = { row: active.row + 1, col: active.col };
          } else if (active.col < COLS - 1) {
            next = { row: 0, col: active.col + 1 };
          } else {
            next = { row: 0, col: 0 };
          }
        }
      } else if (direction === "down") {
        next = { row: Math.min(ROWS - 1, active.row + 1), col: active.col };
      } else if (direction === "up") {
        next = { row: Math.max(0, active.row - 1), col: active.col };
      }
      // NOTE: "prev" (Shift+Tab / ArrowLeft) 역방향 이동은 MVP에서 비활성화되어 있다.
      // 확장 시 여기에 "prev" 케이스를 추가하고 PracticeGrid의 handleKeyDown 주석을 해제한다.

      if (next.row !== active.row && startedAt !== null) {
        markRowChanged();
      }
      setActive(next);
    },
    [active, expected, grid, fixMode, startedAt, markRowChanged]
  );

  // 완료 상태 전이 — 모든 셀이 최소 1회 평가된 시점에 딱 한 번만 발동한다.
  useEffect(() => {
    if (finishedAt !== null || completionSavedRef.current) return;
    if (!isAllAttempted(grid)) return;
    if (startedAt === null) return;

    const end = Date.now();
    setFinishedAt(end);
    completionSavedRef.current = true;

    const record: PracticeRecord = {
      date: new Date(end).toISOString(),
      accuracy: calcAccuracy(correctCount, attemptedCount),
      totalTimeSec: Math.round((end - startedAt) / 1000),
      errors: errorPositions.length,
      completedRows,
      totalRows: ROWS,
    };
    const next = appendRecord(record);
    setStats(next);
  }, [grid, finishedAt, startedAt, correctCount, attemptedCount, errorPositions, completedRows]);

  // 모든 오류가 해결되면 수정 모드를 자동 해제한다.
  useEffect(() => {
    if (fixMode && errorPositions.length === 0) {
      setFixMode(false);
    }
  }, [fixMode, errorPositions]);

  const handleReset = useCallback(() => {
    setGrid(createEmptyGrid(ROWS, COLS));
    setActive({ row: 0, col: 0 });
    setStartedAt(null);
    setFinishedAt(null);
    setLastRowDurationMs(null);
    rowStartedAtRef.current = null;
    setFixMode(false);
    completionSavedRef.current = false;
  }, []);

  const handleStartFixMode = useCallback(() => {
    if (errorPositions.length === 0) return;
    const first = errorPositions[0];
    setFixMode(true);
    if (first.row !== active.row && startedAt !== null) {
      markRowChanged();
    }
    setActive(first);
  }, [errorPositions, active.row, startedAt, markRowChanged]);

  // "오류 N건" 클릭 → 현재 활성 셀 다음에 위치한 오류 셀로 순환 이동
  const handleErrorCycle = useCallback(() => {
    const nextErr = findNextError(errorPositions, active);
    if (!nextErr) return;
    if (nextErr.row !== active.row && startedAt !== null) {
      markRowChanged();
    }
    setActive(nextErr);
  }, [errorPositions, active, startedAt, markRowChanged]);

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

  // 완료 후 잔존/신규 오류가 있으면 "오류 수정 중" 상태로 간주한다.
  // fixMode 플래그와 무관하게, 사용자가 100% 정확 후 특정 셀을 다시 수정해 틀린 경우에도
  // 완료 카드가 즉시 "오류 수정 중" 으로 돌아가야 하기 때문이다.
  const isFixingAfterComplete = finishedAt !== null && errors > 0;
  const completeLabel = isFixingAfterComplete ? "오류 수정 중" : "완료";
  const headerMode = isFixingAfterComplete || fixMode ? "오류 수정" : "기본 입력";

  return (
    <div className={styles.app}>
      <WorkbookHeader
        mode={headerMode}
        saved
        authConfigured={auth.configured}
        authLoading={auth.loading}
        user={auth.user}
        onAccountClick={() => setAuthOpen(true)}
      />
      <StatusBar
        cellAddress={cellAddress}
        elapsedLabel={formatElapsed(elapsedMs)}
        lastRowLabel={lastRowLabel}
        accuracy={accuracy}
        onReset={handleReset}
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
      <SheetTabs />
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
    </div>
  );
}
