import styles from "./SummaryBar.module.css";

const FEEDBACK_URL = "https://forms.gle/2D3TF1Rk6W7sJXXa7";

type Props = {
  completedRows: number;
  totalRows: number;
  errors: number;
  bestAccuracy: number;
  onErrorClick?: () => void;
  feedbackUrl?: string;
};

export function SummaryBar({
  completedRows,
  totalRows,
  errors,
  bestAccuracy,
  onErrorClick,
  feedbackUrl = FEEDBACK_URL,
}: Props) {
  const ratio = totalRows > 0 ? Math.round((completedRows / totalRows) * 100) : 0;
  return (
    <div className={styles.summary}>
      <div className={styles.groupLeft}>
        <div className={styles.item}>
          <span className={styles.label}>완료 행</span>
          <span className={styles.value}>
            {completedRows} / {totalRows}
          </span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={styles.errorAction}
          onClick={onErrorClick}
          disabled={errors === 0}
          title={errors > 0 ? "클릭해서 오류 셀로 이동" : "오류 없음"}
        >
          <span className={styles.label}>오류</span>
          <span className={`${styles.value} ${errors > 0 ? styles.valueWarn : ""}`}>
            {errors}건
          </span>
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.item}>
          <span className={styles.label}>완료율</span>
          <span className={styles.value}>{ratio}%</span>
        </div>
      </div>

      <div className={styles.groupRight}>
        <div className={`${styles.item} ${styles.itemMuted}`}>
          <span className={styles.label}>최고 정확도</span>
          <span className={styles.value}>{bestAccuracy}%</span>
        </div>
        <span className={styles.divider} aria-hidden="true" />
        {/* 피드백은 별도 버튼이 아닌 텍스트 링크로 유지 — 변환 FAB 와 시각적으로 충돌하지 않게 한다. */}
        <a
          className={styles.feedbackLink}
          href={feedbackUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          피드백 보내기
        </a>
      </div>
    </div>
  );
}
