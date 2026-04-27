import { useEffect, useRef, useState } from "react";
import { convertToReport } from "../utils/converter";
import styles from "./ConverterModal.module.css";

const MIN_INPUT_LENGTH = 2;

type Props = {
  open: boolean;
  onClose: () => void;
};

type ResultMeta = {
  index: number;
  total: number;
  source: "openai" | "fallback";
};

async function requestOpenAIConvert(input: string, signal: AbortSignal): Promise<string> {
  const r = await fetch("/api/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
    signal,
  });
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error(`API ${r.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await r.json()) as { text?: string };
  const text = (data?.text ?? "").trim();
  if (!text) throw new Error("Empty response");
  return text;
}

export function ConverterModal({ open, onClose }: Props) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [meta, setMeta] = useState<ResultMeta>({ index: -1, total: 0, source: "openai" });
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setInput("");
      setResult("");
      setMeta({ index: -1, total: 0, source: "openai" });
      setCopied(false);
      setIsLoading(false);
      setErrorNotice(null);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // 컴포넌트 언마운트 시 진행 중인 요청 취소.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!open) return null;

  const trimmed = input.trim();
  const canConvert = trimmed.length >= MIN_INPUT_LENGTH && !isLoading;

  // 템플릿 기반 fallback 변환을 그대로 호출. (로컬 결과)
  const runFallback = (prevIdx: number): { text: string; index: number; total: number } => {
    const r = convertToReport(input, prevIdx);
    return { text: r.text, index: r.index, total: r.total };
  };

  // 메인 변환 — OpenAI API 우선, 실패 시 템플릿 기반 fallback.
  const handleConvert = async () => {
    if (trimmed.length < MIN_INPUT_LENGTH) return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsLoading(true);
    setErrorNotice(null);
    setCopied(false);

    try {
      const text = await requestOpenAIConvert(trimmed, ac.signal);
      setResult(text);
      setMeta({ index: 0, total: 1, source: "openai" });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      const fb = runFallback(-1);
      setResult(fb.text);
      setMeta({ index: fb.index, total: fb.total, source: "fallback" });
      setErrorNotice("AI 변환에 실패하여 템플릿 기반 결과를 표시합니다.");
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setIsLoading(false);
    }
  };

  // "다른 결과 보기" — fallback 후보가 여러 개일 때만 의미가 있다.
  const handleAnother = () => {
    if (meta.source !== "fallback" || meta.total <= 1) return;
    const fb = runFallback(meta.index);
    setResult(fb.text);
    setMeta({ index: fb.index, total: fb.total, source: "fallback" });
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const showLengthNotice = input.length > 0 && trimmed.length < MIN_INPUT_LENGTH;
  const canShowAnother = meta.source === "fallback" && meta.total > 1 && !!result;

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>업무 문장 변환</h2>
          <button
            className={styles.close}
            type="button"
            onClick={onClose}
            aria-label="닫기 (ESC)"
            title="닫기 (ESC)"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className={styles.body}>
          <label className={styles.label} htmlFor="converter-input">
            입력 문장
          </label>
          <textarea
            id="converter-input"
            ref={inputRef}
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (canConvert) {
                  void handleConvert();
                }
              }
            }}
            placeholder="예: 서류, 회의, 영상 제작"
            rows={3}
            disabled={isLoading}
          />
          <p className={`${styles.notice} ${showLengthNotice ? styles.noticeWarn : ""}`}>
            {showLengthNotice
              ? `${MIN_INPUT_LENGTH}글자 이상 입력해야 변환할 수 있습니다.`
              : `${MIN_INPUT_LENGTH}글자 이상 입력하면 AI가 보고용 표현으로 변환합니다.`}
          </p>

          <label className={styles.label}>변환 결과</label>
          <div className={styles.result} aria-live="polite" aria-busy={isLoading}>
            {isLoading ? (
              <p className={styles.loading}>
                <span className={styles.spinner} aria-hidden="true" />
                변환 중…
              </p>
            ) : result ? (
              <p>{result}</p>
            ) : (
              <p className={styles.placeholder}>
                문장을 입력하고 변환 버튼을 누르면 보고용 문장이 출력됩니다.
              </p>
            )}
            {!isLoading && result && meta.source === "fallback" && meta.total > 1 && (
              <span className={styles.meta}>
                템플릿 후보 {meta.total}개 중 {meta.index + 1}번
              </span>
            )}
            {!isLoading && result && meta.source === "fallback" && meta.total <= 1 && (
              <span className={styles.meta}>템플릿 기반 결과</span>
            )}
          </div>
          {errorNotice && !isLoading && (
            <p className={`${styles.notice} ${styles.noticeWarn}`}>{errorNotice}</p>
          )}
        </div>
        <div className={styles.footer}>
          <button
            type="button"
            className="wb-btn wb-btn--primary"
            onClick={() => void handleConvert()}
            disabled={!canConvert}
          >
            {isLoading ? "변환 중…" : "변환"}
          </button>
          <button
            type="button"
            className="wb-btn"
            onClick={handleAnother}
            disabled={!canShowAnother || isLoading}
            title={
              meta.source === "openai"
                ? "AI 결과는 단일 결과로 제공됩니다"
                : "다른 템플릿 결과 보기"
            }
          >
            다른 결과 보기
          </button>
          <button
            type="button"
            className="wb-btn"
            onClick={handleCopy}
            disabled={!result || isLoading}
          >
            {copied ? "복사됨" : "복사"}
          </button>
        </div>
        <div className={styles.shortcutHint}>
          <span className={styles.shortcutLabel}>단축키</span>
          <span className={styles.shortcutItem}>
            <kbd>Ctrl</kbd> + <kbd>/</kbd> 열기·닫기
          </span>
          <span className={styles.shortcutDivider} aria-hidden="true" />
          <span className={styles.shortcutItem}>
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> 변환
          </span>
          <span className={styles.shortcutDivider} aria-hidden="true" />
          <span className={styles.shortcutItem}>
            <kbd>ESC</kbd> 닫기
          </span>
        </div>
      </div>
    </div>
  );
}
