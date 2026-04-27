import type { User } from "@supabase/supabase-js";
import styles from "./WorkbookHeader.module.css";

type Props = {
  mode?: string;
  saved?: boolean;
  authConfigured: boolean;
  authLoading: boolean;
  user: User | null;
  onAccountClick: () => void;
};

export function WorkbookHeader({
  mode = "기본 입력",
  saved = true,
  authConfigured,
  authLoading,
  user,
  onAccountClick,
}: Props) {
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <img src="/logo.svg" alt="" className={styles.logo} width={28} height={28} />
        <div className={styles.leftText}>
          <h1 className={styles.title}>Work Toolkit</h1>
          <span className={styles.subtitle}>업무 입력 훈련 워크북</span>
        </div>
      </div>
      <div className={styles.right}>
        <div className={styles.mode}>
          <span className={styles.modeLabel}>모드</span>
          <span className={styles.modeValue}>{mode}</span>
        </div>
        <span className={`${styles.save} ${saved ? styles.saveActive : ""}`}>
          {saved ? "로컬 저장됨" : "저장 대기"}
        </span>
        <AccountButton
          configured={authConfigured}
          loading={authLoading}
          displayName={displayName}
          email={user?.email ?? null}
          onClick={onAccountClick}
        />
      </div>
    </header>
  );
}

type AccountButtonProps = {
  configured: boolean;
  loading: boolean;
  displayName: string;
  email: string | null;
  onClick: () => void;
};

function AccountButton({ configured, loading, displayName, email, onClick }: AccountButtonProps) {
  if (loading) {
    return (
      <button type="button" className={styles.account} disabled>
        <span className={styles.accountDot} aria-hidden="true" />
        <span className={styles.accountText}>확인 중…</span>
      </button>
    );
  }

  const isLoggedIn = Boolean(email);
  const label = isLoggedIn ? displayName || email || "내 계정" : "로그인";
  const title = !configured
    ? "Supabase 미설정 — 클릭해 안내 보기"
    : isLoggedIn
      ? `${email} (계정)`
      : "로그인 / 회원가입";

  return (
    <button
      type="button"
      className={`${styles.account} ${isLoggedIn ? styles.accountActive : ""}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      <span
        className={`${styles.accountDot} ${isLoggedIn ? styles.accountDotOn : ""}`}
        aria-hidden="true"
      />
      <span className={styles.accountText}>{label}</span>
    </button>
  );
}
