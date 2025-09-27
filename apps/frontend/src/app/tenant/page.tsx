"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { SessionInfo } from "@/components/session-info";
import { AppShell } from "@/components/app-shell";

type Member = { user_id: string; role: "owner" | "admin" | "member" | "viewer" };

export default function TenantAdminPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [invitedTenantId, setInvitedTenantId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tenantName, setTenantName] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newUserRole, setNewUserRole] = useState<Member["role"]>("member");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      setAccessToken(token);
      try {
        const res = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const payload = (await res.json()) as { session: { tenantId: string; role: string } };
          if (!cancelled) {
            setTenantId(payload.session.tenantId);
            setRole(payload.session.role);
          }
        } else if (res.status === 403) {
          // If forbidden, user may have tenant_id in metadata but no membership yet (invite pending)
          const tId = (session.user.user_metadata?.tenant_id as string | undefined) ?? null;
          if (!cancelled) setInvitedTenantId(tId);
        }
      } catch (e) {
        // ignore
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const canManage = role === "owner" || role === "admin";

  const fetchMembers = async () => {
    if (!accessToken || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to list members (${res.status})`);
      }
      const payload = (await res.json()) as { members: Member[] };
      setMembers(payload.members);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId && accessToken) void fetchMembers();
  }, [tenantId, accessToken]);

  const createTenant = async () => {
    if (!tenantName.trim() || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: tenantName.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to create tenant (${res.status})`);
      }
      const payload = (await res.json()) as { tenant: { id: string } };
      setTenantId(payload.tenant.id);
      setTenantName("");
      // Refresh session info box (metadata update)
      void fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    if (!tenantId || !accessToken || !newUserId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: newUserId.trim(), role: newUserRole }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to add member (${res.status})`);
      }
      await fetchMembers();
      setNewUserId("");
      setNewUserRole("member");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const inviteUser = async () => {
    if (!tenantId || !accessToken || !inviteEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/invite`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: newUserRole }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to send invite (${res.status})`);
      }
      setInviteEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (userId: string, nextRole: Member["role"]) => {
    if (!tenantId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members/${userId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to update role (${res.status})`);
      }
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!tenantId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to delete member (${res.status})`);
      }
      await fetchMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as any;
        throw new Error(payload?.message ?? `Failed to accept invitation (${res.status})`);
      }
      // Refresh session & members
      setInvitedTenantId(null);
      await fetchMembers();
      // reload session info
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const response = await fetch("/api/auth/session", { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (response.ok) {
          const payload = (await response.json()) as { session: { tenantId: string; role: string } };
          setTenantId(payload.session.tenantId);
          setRole(payload.session.role);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">テナント・ユーザー管理（最小UI）</h1>
      <SessionInfo />

      {!tenantId && (
        <div className="rounded-md border p-4">
          <h2 className="mb-2 font-semibold">テナント作成</h2>
          <div className="flex gap-2">
            <input
              className="w-full rounded border px-2 py-1"
              placeholder="テナント名"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            />
            <button className="rounded bg-black px-3 py-1 text-white" onClick={createTenant} disabled={loading}>
              作成
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">初回作成者は owner として登録されます。</p>
        </div>
      )}

      {tenantId && canManage && (
        <div className="rounded-md border p-4">
          <h2 className="mb-2 font-semibold">メンバー追加 / 招待</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="grow rounded border px-2 py-1"
              placeholder="ユーザーID（既存）"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            />
            <select className="rounded border px-2 py-1" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)}>
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
            <button className="rounded bg-black px-3 py-1 text-white" onClick={addMember} disabled={loading}>
              追加
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="grow rounded border px-2 py-1"
              placeholder="メールアドレスに招待を送信"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <button className="rounded border px-3 py-1" onClick={inviteUser} disabled={loading}>
              招待送信
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">メール招待は Supabase Auth の招待機能を使用します。</p>
        </div>
      )}

      {tenantId && (
        <div className="rounded-md border p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">メンバー一覧</h2>
            <button className="rounded border px-3 py-1" onClick={fetchMembers} disabled={loading}>
              更新
            </button>
          </div>
          {error && <div className="mb-2 rounded bg-red-50 p-2 text-sm text-red-800">{error}</div>}
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-neutral-50">
                <th className="border px-2 py-1 text-left">ユーザーID</th>
                <th className="border px-2 py-1 text-left">ロール</th>
                {canManage && <th className="border px-2 py-1">操作</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td className="border px-2 py-1">{m.user_id}</td>
                  <td className="border px-2 py-1">
                    {canManage ? (
                      <select
                        className="rounded border px-2 py-1"
                        value={m.role}
                        onChange={(e) => updateRole(m.user_id, e.target.value as Member["role"])}
                      >
                        <option value="owner">owner</option>
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      m.role
                    )}
                  </td>
                  {canManage && (
                    <td className="border px-2 py-1 text-center">
                      <button className="rounded border px-2 py-1" onClick={() => removeMember(m.user_id)} disabled={loading}>
                        削除
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td className="border px-2 py-4 text-center text-neutral-500" colSpan={canManage ? 3 : 2}>
                    メンバーはまだいません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!tenantId && invitedTenantId && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="mb-2 font-semibold">テナントへの招待が保留中です</div>
          <div className="mb-3">テナントID: {invitedTenantId}</div>
          <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={acceptInvite} disabled={loading}>
            招待を受諾
          </button>
        </div>
      )}
    </div>
    </AppShell>
  );
}
