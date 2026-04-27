import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import styles from "./AuthModal.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  configured: boolean;
  user: User | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

type AuthMode = "signin" | "signup";
type SubmitStatus = "idle" | "submitting" | "success" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

// Supabase가 반환하는 영문 에러 메시지를 사용자가 읽을 수 있는 한국어로 매핑한다.
function translateAuthError(rawMessage: string, mode: AuthMode): string {
  const message = rawMessage.replace(/^\[Supabase Auth\]\s*/, "");

  if (/Invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (/Email not confirmed/i.test(message)) {
    return "이메일 인증이 완료되지 않았습니다. 가입 시 받은 메일의 확인 링크를 먼저 눌러 주세요.";
  }
  if (/User already registered/i.test(message) || /already exists/i.test(message)) {
    return mode === "signup"
      ? "이미 가입된 이메일입니다. ‘로그인’ 탭으로 이동해 주세요."
      : "이미 가입된 이메일입니다. 로그인해 주세요.";
  }
  if (/Password should be at least/i.test(message)) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (/for security purposes/i.test(message) || /rate limit/i.test(message)) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }
  return message || "알 수 없는 오류가 발생했습니다.";
}

export function AuthModal({
  open,
  onClose,
  configured,
  user,
  onSignIn,
  onSignUp,
  onSignOut,
}: Props) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 가입 직후 안내용 — 폼이 리셋되어도 안내 박스에 이메일이 남도록 별도 보관한다.
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  // 모달이 닫힐 때 모든 입력/상태 초기화. 다시 열리면 이메일 입력에 포커스를 준다.
  useEffect(() => {
    if (!open) {
      setMode("signin");
      setEmail("");
      setPassword("");
      setPasswordConfirm("");
      setStatus("idle");
      setErrorMessage(null);
      setSignupEmail(null);
      return;
    }
    const t = window.setTimeout(() => emailRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  // 탭 전환 시 폼/에러 상태 초기화. 단, 이메일은 유지(같은 사람이 잘못 들어왔을 때 다시 안 치게).
  useEffect(() => {
    setPassword("");
    setPasswordConfirm("");
    setStatus("idle");
    setErrorMessage(null);
  }, [mode]);

  // ESC 닫기.
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const trimmedEmail = email.trim();
  const isEmailValid = EMAIL_PATTERN.test(trimmedEmail);
  const isPasswordValid = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = mode === "signin" || password === passwordConfirm;
  const canSubmit =
    configured &&
    status !== "submitting" &&
    isEmailValid &&
    isPasswordValid &&
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      if (mode === "signin") {
        await onSignIn(trimmedEmail, password);
        // 로그인 성공 시 세션이 갱신되며 user 가 채워진다. 헤더에서 닉네임이 보이도록 모달은 닫는다.
        onClose();
      } else {
        await onSignUp(trimmedEmail, password);
        setSignupEmail(trimmedEmail);
        setStatus("success");
      }
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setErrorMessage(translateAuthError(msg, mode));
    }
  };

  const handleSignOut = async () => {
    try {
      await onSignOut();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "로그아웃 중 오류가 발생했습니다.");
    }
  };

  // 가입 안내 화면(success)에서 ‘다른 이메일로 가입’ 시 폼만 리셋.
  const resetSignupForm = () => {
    setEmail("");
    setPassword("");
    setPasswordConfirm("");
    setSignupEmail(null);
    setStatus("idle");
    setErrorMessage(null);
    window.setTimeout(() => emailRef.current?.focus(), 0);
  };

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  const isLoggedIn = configured && !!user;
  const showSignupSuccess = mode === "signup" && status === "success";

  const headerTitle = isLoggedIn ? "내 계정" : mode === "signin" ? "로그인" : "회원가입";
  const headerSubtitle = isLoggedIn
    ? null
    : mode === "signin"
      ? "이메일과 비밀번호로 즉시 로그인합니다."
      : "이메일로 인증 링크를 보내드립니다. 링크를 누르면 가입이 완료돼요.";

  return (
    <div className={styles.modal} role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{headerTitle}</h2>
            {headerSubtitle && <p className={styles.subtitle}>{headerSubtitle}</p>}
          </div>
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
          {!configured && (
            <div className={`${styles.callout} ${styles.calloutWarn}`} role="status">
              <strong className={styles.calloutTitle}>Supabase 미설정</strong>
              <p className={styles.calloutText}>
                <code>.env.local</code> 에 <code>VITE_SUPABASE_URL</code> 과{" "}
                <code>VITE_SUPABASE_ANON_KEY</code> 를 채운 뒤 페이지를 새로고침하면 로그인을 사용할 수 있습니다.
              </p>
            </div>
          )}

          {isLoggedIn && (
            <>
              <div className={styles.profile}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>이름</span>
                  <span className={styles.profileValue}>{displayName}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>이메일</span>
                  <span className={styles.profileValue}>{user?.email ?? "-"}</span>
                </div>
              </div>
              {errorMessage && (
                <p className={`${styles.notice} ${styles.noticeWarn}`}>{errorMessage}</p>
              )}
            </>
          )}

          {configured && !isLoggedIn && (
            <>
              {!showSignupSuccess && (
                <div className={styles.tabs} role="tablist" aria-label="인증 모드">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "signin"}
                    className={`${styles.tab} ${mode === "signin" ? styles.tabActive : ""}`}
                    onClick={() => setMode("signin")}
                  >
                    로그인
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "signup"}
                    className={`${styles.tab} ${mode === "signup" ? styles.tabActive : ""}`}
                    onClick={() => setMode("signup")}
                  >
                    회원가입
                  </button>
                </div>
              )}

              {showSignupSuccess ? (
                <div className={`${styles.callout} ${styles.calloutOk}`} role="status">
                  <strong className={styles.calloutTitle}>가입 메일을 보냈어요</strong>
                  <p className={styles.calloutText}>
                    <code>{signupEmail}</code> 로 발송된 메일의 <strong>확인 링크를 클릭</strong>하면
                    가입이 완료되고 자동으로 로그인됩니다. 메일이 보이지 않으면 스팸함도 확인해 주세요.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className={styles.form}>
                  <label className={styles.label} htmlFor="auth-email">
                    이메일
                  </label>
                  <input
                    id="auth-email"
                    ref={emailRef}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={status === "submitting"}
                  />

                  <label className={styles.label} htmlFor="auth-password">
                    비밀번호
                    <span className={styles.labelHint}> (최소 {MIN_PASSWORD_LENGTH}자)</span>
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    className={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "signin" ? "비밀번호" : "새 비밀번호"}
                    disabled={status === "submitting"}
                  />

                  {mode === "signup" && (
                    <>
                      <label className={styles.label} htmlFor="auth-password-confirm">
                        비밀번호 확인
                      </label>
                      <input
                        id="auth-password-confirm"
                        type="password"
                        autoComplete="new-password"
                        className={styles.input}
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="비밀번호 다시 입력"
                        disabled={status === "submitting"}
                      />
                      {password.length > 0 &&
                        passwordConfirm.length > 0 &&
                        password !== passwordConfirm && (
                          <p className={`${styles.notice} ${styles.noticeWarn}`}>
                            비밀번호가 일치하지 않습니다.
                          </p>
                        )}
                    </>
                  )}

                  {status === "submitting" && (
                    <p className={styles.notice}>
                      {mode === "signin" ? "로그인 중…" : "가입 메일을 발송하는 중…"}
                    </p>
                  )}
                  {status === "error" && errorMessage && (
                    <p className={`${styles.notice} ${styles.noticeWarn}`}>{errorMessage}</p>
                  )}
                </form>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {isLoggedIn ? (
            <>
              <button type="button" className="wb-btn" onClick={onClose}>
                닫기
              </button>
              <button
                type="button"
                className="wb-btn wb-btn--primary"
                onClick={handleSignOut}
              >
                로그아웃
              </button>
            </>
          ) : showSignupSuccess ? (
            <>
              <button type="button" className="wb-btn" onClick={resetSignupForm}>
                다른 이메일로 가입
              </button>
              <button type="button" className="wb-btn wb-btn--primary" onClick={onClose}>
                확인
              </button>
            </>
          ) : (
            <>
              <button type="button" className="wb-btn" onClick={onClose}>
                닫기
              </button>
              <button
                type="button"
                className="wb-btn wb-btn--primary"
                onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
                disabled={!canSubmit}
              >
                {status === "submitting"
                  ? mode === "signin"
                    ? "로그인 중…"
                    : "가입 메일 발송 중…"
                  : mode === "signin"
                    ? "로그인"
                    : "가입하기"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
