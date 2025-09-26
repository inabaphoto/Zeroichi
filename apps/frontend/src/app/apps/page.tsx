"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Fragment } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type AppRow = { id: string; name: string; type: string | null; archived_at: string | null };
type EnvVarRow = { key: string; has_value: boolean; disabled: boolean; updated_at?: string | null };

export default function AppsPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [envVars, setEnvVars] = useState<EnvVarRow[]>([]);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [validation, setValidation] = useState<Record<string, { status: "idle" | "ok" | "fail" | "running"; message?: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [difyKey, setDifyKey] = useState("");

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setAccessToken(session.access_token);
      const res = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) {
        const payload = (await res.json()) as { session: { tenantId: string } };
        setTenantId(payload.session.tenantId);
      }
    };
    void load();
  }, []);

  const fetchApps = async () => {
    if (!tenantId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/apps`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Failed to list apps (${res.status})`);
      const payload = (await res.json()) as { apps: AppRow[] };
      setApps(payload.apps);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvVars = async (appId: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/env-vars`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Failed to list env vars (${res.status})`);
      const payload = (await res.json()) as { vars: EnvVarRow[] };
      setEnvVars(payload.vars);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const addEnvVar = async (appId: string) => {
    if (!accessToken || !newEnvKey.trim() || !newEnvValue.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/env-vars`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ key: newEnvKey.trim(), value: newEnvValue.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to set env var (${res.status})`);
      }
      setNewEnvKey("");
      setNewEnvValue("");
      await fetchEnvVars(appId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const updateEnvVar = async (appId: string, key: string, fields: Partial<{ value: string | null; disabled: boolean }>) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/env-vars/${encodeURIComponent(key)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to update env var (${res.status})`);
      }
      await fetchEnvVars(appId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteEnvVar = async (appId: string, key: string) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/env-vars/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to delete env var (${res.status})`);
      }
      await fetchEnvVars(appId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const validateDify = async (appId: string) => {
    if (!accessToken) return;
    setValidation((s) => ({ ...s, [appId]: { status: "running" } }));
    try {
      const res = await fetch(`/api/apps/${appId}/dify/validate`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Validation failed (${res.status})`);
      }
      setValidation((s) => ({ ...s, [appId]: { status: "ok" } }));
    } catch (e) {
      setValidation((s) => ({ ...s, [appId]: { status: "fail", message: e instanceof Error ? e.message : String(e) } }));
    }
  };

  useEffect(() => { if (tenantId && accessToken) void fetchApps(); }, [tenantId, accessToken]);

  const createApp = async () => {
    if (!accessToken || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type: type || undefined, difyApiKey: difyKey || undefined }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to create app (${res.status})`);
      }
      setName("");
      setType("");
      setDifyKey("");
      await fetchApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const updateApp = async (id: string, fields: Partial<{ name: string; type: string; difyApiKey: string | null }>) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to update app (${res.status})`);
      }
      await fetchApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteApp = async (id: string, mode: "archive" | "hard") => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${id}?mode=${mode}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to ${mode} app (${res.status})`);
      }
      await fetchApps();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">アプリ登録・管理（最小UI）</h1>

      <div className="rounded-md border p-4">
        <h2 className="mb-2 font-semibold">アプリ作成</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input className="grow rounded border px-2 py-1" placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="rounded border px-2 py-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">type</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="hybrid">hybrid</option>
          </select>
          <input className="grow rounded border px-2 py-1" placeholder="Dify API Key (任意)" value={difyKey} onChange={(e) => setDifyKey(e.target.value)} />
          <button className="rounded bg-black px-3 py-1 text-white" onClick={createApp} disabled={loading}>作成</button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Dify API Key は暗号化保存され、一覧では表示されません。</p>
      </div>

      <div className="rounded-md border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">アプリ一覧</h2>
          <button className="rounded border px-3 py-1" onClick={fetchApps} disabled={loading}>更新</button>
        </div>
        {error && <div className="mb-2 rounded bg-red-50 p-2 text-sm text-red-800">{error}</div>}
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-neutral-50">
              <th className="border px-2 py-1 text-left">名前</th>
              <th className="border px-2 py-1 text-left">種別</th>
              <th className="border px-2 py-1 text-left">状態</th>
              <th className="border px-2 py-1">操作</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <Fragment key={a.id}>
              <tr>
                <td className="border px-2 py-1">
                  <input className="w-full rounded border px-1 py-0.5" defaultValue={a.name} onBlur={(e) => e.target.value !== a.name && updateApp(a.id, { name: e.target.value })} />
                </td>
                <td className="border px-2 py-1">
                  <select defaultValue={a.type ?? ""} onChange={(e) => updateApp(a.id, { type: e.target.value })} className="rounded border px-1 py-0.5">
                    <option value="">-</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="hybrid">hybrid</option>
                  </select>
                </td>
                <td className="border px-2 py-1">{a.archived_at ? "archived" : "active"}</td>
                <td className="border px-2 py-1 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button className="rounded border px-2 py-1" onClick={() => updateApp(a.id, { difyApiKey: prompt("New Dify API Key?") || undefined })}>鍵ローテ</button>
                    <button className="rounded border px-2 py-1" onClick={() => deleteApp(a.id, "archive")} disabled={!!a.archived_at}>アーカイブ</button>
                    <button className="rounded border px-2 py-1" onClick={() => deleteApp(a.id, "hard")}>削除</button>
                    <button className="rounded border px-2 py-1" onClick={() => validateDify(a.id)} disabled={validation[a.id]?.status === "running"}>検証</button>
                    <button className="rounded border px-2 py-1" onClick={async () => { setExpandedApp(expandedApp === a.id ? null : a.id); if (expandedApp !== a.id) await fetchEnvVars(a.id); }}>
                      環境変数
                    </button>
                  </div>
                </td>
              </tr>
              {validation[a.id]?.status && validation[a.id]?.status !== "idle" && (
                <tr>
                  <td colSpan={4} className="border px-2 py-2">
                    {validation[a.id]?.status === "running" && (
                      <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">検証中...</div>
                    )}
                    {validation[a.id]?.status === "ok" && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">検証に成功しました</div>
                    )}
                    {validation[a.id]?.status === "fail" && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">検証に失敗しました: {validation[a.id]?.message}</div>
                    )}
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {apps.length === 0 && (
              <tr>
                <td className="border px-2 py-4 text-center text-neutral-500" colSpan={4}>アプリはまだありません</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {expandedApp && (
        <div className="rounded-md border p-4">
          <h2 className="mb-2 font-semibold">環境変数（App: {expandedApp}）</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input className="rounded border px-2 py-1" placeholder="KEY" value={newEnvKey} onChange={(e) => setNewEnvKey(e.target.value)} />
            <input className="rounded border px-2 py-1" placeholder="VALUE" value={newEnvValue} onChange={(e) => setNewEnvValue(e.target.value)} />
            <button className="rounded bg-black px-3 py-1 text-white" onClick={() => addEnvVar(expandedApp)} disabled={loading}>追加/上書き</button>
          </div>
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border px-2 py-1 text-left">Key</th>
                <th className="border px-2 py-1 text-left">Has Value</th>
                <th className="border px-2 py-1 text-left">Disabled</th>
                <th className="border px-2 py-1">操作</th>
              </tr>
            </thead>
            <tbody>
              {envVars.map((v) => (
                <tr key={v.key}>
                  <td className="border px-2 py-1">{v.key}</td>
                  <td className="border px-2 py-1">{v.has_value ? "yes" : "no"}</td>
                  <td className="border px-2 py-1">{v.disabled ? "true" : "false"}</td>
                  <td className="border px-2 py-1 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button className="rounded border px-2 py-1" onClick={() => updateEnvVar(expandedApp, v.key, { value: prompt(`New value for ${v.key}?`) || undefined })}>ローテ</button>
                      <button className="rounded border px-2 py-1" onClick={() => updateEnvVar(expandedApp, v.key, { disabled: !v.disabled })}>{v.disabled ? "有効化" : "無効化"}</button>
                      <button className="rounded border px-2 py-1" onClick={() => deleteEnvVar(expandedApp, v.key)}>削除</button>
                    </div>
                  </td>
                </tr>
              ))}
              {envVars.length === 0 && (
                <tr>
                  <td className="border px-2 py-4 text-center text-neutral-500" colSpan={4}>環境変数はまだありません</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
