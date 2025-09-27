"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const signIn = async () => {
    setStatus("running");
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      setStatus("ok");
      // ログイン後はテナント画面へ（初回はここで作成可能）
      router.push("/tenant");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setStatus("error");
      setMessage(msg);
    }
  };

  const sendMagicLink = async () => {
    setStatus("running");
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
      if (error) throw error;
      setStatus("ok");
      setMessage("マジックリンクを送信しました。メールを確認してください。");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unexpected error";
      setStatus("error");
      setMessage(msg);
    }
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-3 text-xl font-semibold text-neutral-900">ログイン</h1>
      <div className="space-y-3">
        {status === "error" && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message || "ログインに失敗しました。"}</div>
        )}
        {status === "ok" && message && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{message}</div>
        )}
        <div className="space-y-2">
          <label className="block text-sm text-neutral-700">メールアドレス</label>
          <input
            type="email"
            className="w-full rounded border px-3 py-2"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-neutral-700">パスワード</label>
          <input
            type="password"
            className="w-full rounded border px-3 py-2"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" onClick={signIn} disabled={status === "running"}>
            ログイン
          </button>
          <button className="rounded border px-4 py-2 disabled:opacity-50" onClick={sendMagicLink} disabled={status === "running" || !email.trim()}>
            マジックリンク送信
          </button>
        </div>
        <p className="text-xs text-neutral-500">スーパー管理者: info@photo-innovation.net でのサインインを想定しています。</p>
      </div>
    </div>
  );
}
