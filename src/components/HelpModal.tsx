import { useEffect } from "react";
import { HelpCircle } from "lucide-react";
import styles from "./HelpModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  isMobile: boolean;
};

const PC_STEPS = [
  "셀을 클릭하고 내용을 입력하세요",
  "Enter 키로 다음 셀로 이동합니다",
  "틀린 셀은 빨간색으로 표시됩니다",
  "“오류 n건”을 클릭하면 틀린 셀로 이동할 수 있습니다",
  "Ctrl + / 단축키로 업무 문장 변환 기능을 사용할 수 있습니다",
];

const MOBILE_STEPS = [
  "셀을 터치하고 내용을 입력하세요",
  "상단의 “제출” 버튼으로 다음 셀로 이동합니다",
  "틀린 셀은 빨간색으로 표시됩니다",
  "“오류 n건”을 누르면 틀린 셀로 이동할 수 있습니다",
  "우측 하단의 “문장 변환” 버튼으로 기능을 사용할 수 있습니다",
];

export function HelpModal({ open, onClose, isMobile }: Props) {
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

  if (!open) return null;

  const steps = isMobile ? MOBILE_STEPS : PC_STEPS;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>사용 안내</h2>
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
          <ol className={styles.list}>
            {steps.map((s, i) => (
              <li key={i} className={styles.item}>
                <span className={styles.num}>{i + 1}</span>
                <span className={styles.text}>{s}</span>
              </li>
            ))}
          </ol>
          <p className={styles.tip}>
            상단의{" "}
            <HelpCircle
              size={14}
              strokeWidth={1.8}
              className={styles.tipIcon}
              aria-hidden="true"
            />
            {" "}아이콘을 눌러 언제든 도움말을 다시 볼 수 있습니다.
          </p>
        </div>
        <div className={styles.footer}>
          <button type="button" className="wb-btn wb-btn--primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
