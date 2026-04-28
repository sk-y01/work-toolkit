import styles from "./StatusBar.module.css";

type Props = {
  cellAddress: string;
  elapsedLabel: string;
  lastRowLabel: string | null;
  accuracy: number;
  onReset?: () => void;
  onSubmit?: () => void;
  submitDisabled?: boolean;
};

export function StatusBar({
  cellAddress,
  elapsedLabel,
  lastRowLabel,
  accuracy,
  onReset,
  onSubmit,
  submitDisabled,
}: Props) {
  return (
    <div className={styles.status} role="status" aria-live="polite">
      <StatusItem label="셀" value={cellAddress} />
      <Divider />
      <StatusItem label="경과시간" value={elapsedLabel} />
      {lastRowLabel !== null && (
        <>
          <Divider />
          <StatusItem label="직전 행" value={lastRowLabel} muted />
        </>
      )}
      <Divider />
      <StatusItem label="정확도" value={`${accuracy}%`} warn={accuracy < 90} />

      {(onReset || onSubmit) && (
        <>
          <span className={styles.spacer} />
          {onReset && (
            <button type="button" className={styles.resetBtn} onClick={onReset}>
              초기화
            </button>
          )}
          {/* "제출" 버튼은 모바일 전용. 단축키(Enter) 가 곤란한 환경에서 다음 셀로 이동 동작을 노출한다. */}
          {onSubmit && (
            <button
              type="button"
              className={styles.submitBtn}
              onClick={onSubmit}
              disabled={submitDisabled}
            >
              제출
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StatusItem({
  label,
  value,
  warn,
  muted,
}: {
  label: string;
  value: string;
  warn?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`${styles.item} ${muted ? styles.itemMuted : ""}`}>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${warn ? styles.valueWarn : ""}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <span className={styles.divider} aria-hidden="true" />;
}
