import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithPassword as apiSignIn,
  signUpWithPassword as apiSignUp,
  signOut as apiSignOut,
} from "../lib/api/auth";
import { isSupabaseConfigured } from "../lib/supabase/client";

export type AuthState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const NOT_CONFIGURED_MSG =
  "Supabase 환경변수가 설정되지 않아 로그인을 사용할 수 없습니다.";

export function useAuth(): AuthState {
  const configured = isSupabaseConfigured();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(configured);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    getCurrentSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!configured) throw new Error(NOT_CONFIGURED_MSG);
      await apiSignIn(email, password);
    },
    [configured]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      if (!configured) throw new Error(NOT_CONFIGURED_MSG);
      await apiSignUp(email, password);
    },
    [configured]
  );

  const signOut = useCallback(async () => {
    if (!configured) return;
    await apiSignOut();
  }, [configured]);

  return {
    configured,
    loading,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
  };
}
