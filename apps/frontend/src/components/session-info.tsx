"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface SessionState {
  status: "idle" | "loading" | "loaded" | "error" | "signed-out";
  data?: {
    tenantId: string;
    role: string;
    userId: string;
    email?: string;
  };
  error?: string;
}

export const SessionInfo = () => {
  const [state, setState] = useState<SessionState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      setState({ status: "loading" });
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) setState({ status: "signed-out" });
          return;
        }

        const response = await fetch("/api/auth/session", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? `Failed to fetch session (status ${response.status}).`);
        }
        const payload = (await response.json()) as {
          session: { tenantId: string; role: string; userId: string; accessToken: string };
        };

        if (!cancelled) {
          setState({
            status: "loaded",
            data: {
              tenantId: payload.session.tenantId,
              role: payload.session.role,
              userId: payload.session.userId,
              email: session.user.email ?? undefined,
            },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unexpected error";
        if (!cancelled) setState({ status: "error", error: message });
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading" || state.status === "idle") {
    return <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">セッションを確認しています...</div>;
  }
  if (state.status === "signed-out") {
    return (
      <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">ログインが必要です。</div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">セッション情報の取得に失敗しました: {state.error}</div>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      <div>
        <span className="font-semibold">ユーザー</span>: {state.data?.email ?? state.data?.userId}
      </div>
      <div>
        <span className="font-semibold">テナントID</span>: {state.data?.tenantId}
      </div>
      <div>
        <span className="font-semibold">ロール</span>: {state.data?.role}
      </div>
    </div>
  );
};

