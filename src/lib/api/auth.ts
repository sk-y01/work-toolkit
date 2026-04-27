import type { Session, User, AuthChangeEvent, Subscription } from "@supabase/supabase-js";
import { requireSupabase } from "../supabase/client";

// 회원가입: 이메일/비밀번호로 가입하고, Supabase가 확인 메일을 발송한다.
// 사용자가 메일의 링크를 누르면 emailRedirectTo 로 돌아오면서 자동 로그인된다.
export async function signUpWithPassword(email: string, password: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
  if (error) throw new Error(`[Supabase Auth] ${error.message}`);
}

// 로그인: 비밀번호로 즉시 로그인. 이메일 확인이 완료되지 않은 계정이면
// "Email not confirmed" 에러가 반환된다(상위에서 한국어로 매핑).
export async function signInWithPassword(email: string, password: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`[Supabase Auth] ${error.message}`);
}

export async function signOut(): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`[Supabase Auth] ${error.message}`);
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`[Supabase Auth] ${error.message}`);
  return data.session;
}

export async function getCurrentUser(): Promise<User | null> {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): () => void {
  const supabase = requireSupabase();
  const { data } = supabase.auth.onAuthStateChange(callback);
  const subscription: Subscription = data.subscription;
  return () => subscription.unsubscribe();
}
