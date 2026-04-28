import { useEffect, useRef, useState } from "react";
import styles from "./SheetTabs.module.css";

type Tab = {
  id: string;
  label: string;
};

type Props = {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function SheetTabs({ tabs, activeId, onSelect }: Props) {
  const [hintVisible, setHintVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  const handleAddClick = () => {
    setHintVisible(true);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setHintVisible(false);
      hideTimerRef.current = null;
    }, 1600);
  };

  return (
    <div className={styles.tabs}>
      <div className={styles.list} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeId}
            className={`${styles.tab} ${t.id === activeId ? styles.tabActive : ""}`}
            onClick={() => onSelect(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* "+" 버튼은 항상 마지막 시트의 오른쪽에 위치한다. 추가 기능은 향후 지원 예정이라 안내만 노출. */}
      <div className={styles.addWrap}>
        <button
          className={styles.add}
          type="button"
          onClick={handleAddClick}
          aria-label="시트 추가"
        >
          +
        </button>
        {hintVisible && (
          <span className={styles.tooltip} role="tooltip">
            추후 지원 예정
          </span>
        )}
      </div>
    </div>
  );
}
