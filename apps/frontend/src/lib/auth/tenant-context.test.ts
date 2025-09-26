import { describe, it, expect, vi, beforeEach } from "vitest";

const makeMockAdminClient = (opts: {
  getUser: { user: any } | { error: { message: string } };
  membership?: { role?: string } | null;
}) => {
  return {
    auth: {
      getUser: async () => ("error" in opts.getUser ? { data: null, error: opts.getUser.error } : { data: { user: opts.getUser.user }, error: null }),
    },
    from() {
      const chain = {
        select() { return chain; },
        eq() { return chain; },
        async maybeSingle() { return opts.membership ? { data: { role: opts.membership.role ?? "member" }, error: null } : { data: null, error: null }; },
      } as const;
      return chain;
    },
  } as any;
};

vi.mock("@/lib/supabase/admin", () => {
  const store: { client: any } = { client: null };
  return {
    getSupabaseAdminClient: () => store.client,
    __setClient: (next: any) => { store.client = next; },
  };
});

import { requireTenantContext, UnauthorizedError, ForbiddenError } from "@/lib/auth/tenant-context";
import * as AdminMod from "@/lib/supabase/admin";

describe("requireTenantContext", () => {
  beforeEach(() => {
    (AdminMod as any).__setClient(makeMockAdminClient({ getUser: { error: { message: "not set" } } }));
  });

  it("Authorization ヘッダが無い場合は UnauthorizedError", async () => {
    const req = new Request("http://localhost/api");
    await expect(requireTenantContext(req)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("ユーザーに tenant_id が無ければ ForbiddenError", async () => {
    (AdminMod as any).__setClient(makeMockAdminClient({ getUser: { user: { id: "u1", user_metadata: {}, app_metadata: {} } } }));
    const req = new Request("http://localhost/api", { headers: { Authorization: "Bearer token" } });
    await expect(requireTenantContext(req)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("会員が存在すればテナントコンテキストを返す", async () => {
    (AdminMod as any).__setClient(
      makeMockAdminClient({ getUser: { user: { id: "u1", user_metadata: { tenant_id: "t1" } } }, membership: { role: "admin" } })
    );
    const req = new Request("http://localhost/api", { headers: { Authorization: "Bearer token" } });
    const ctx = await requireTenantContext(req);
    expect(ctx).toEqual({ userId: "u1", tenantId: "t1", role: "admin", accessToken: "token" });
  });

  it("トークン検証エラー時は UnauthorizedError", async () => {
    (AdminMod as any).__setClient(makeMockAdminClient({ getUser: { error: { message: "invalid token" } } }));
    const req = new Request("http://localhost/api", { headers: { Authorization: "Bearer token" } });
    await expect(requireTenantContext(req)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

