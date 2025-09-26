import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const AUTH_HEADER = "authorization";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: "owner" | "admin" | "member" | "viewer";
  accessToken: string;
}

export const requireTenantContext = async (request: Request): Promise<TenantContext> => {
  const authHeader = request.headers.get(AUTH_HEADER);

  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header.");
  }

  const [, accessToken] = authHeader.split(" ");
  if (!accessToken) {
    throw new UnauthorizedError("Missing access token.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: userResult, error: getUserError } = await supabaseAdmin.auth.getUser(accessToken);

  if (getUserError || !userResult?.user) {
    throw new UnauthorizedError(getUserError?.message ?? "Failed to verify access token.");
  }

  const user = userResult.user;
  const tenantId = (user.user_metadata?.tenant_id ?? user.app_metadata?.tenant_id) as string | undefined;

  if (!tenantId) {
    throw new ForbiddenError("Tenant context missing from user metadata.");
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new ForbiddenError("User does not belong to the specified tenant.");
  }

  return {
    userId: user.id,
    tenantId,
    role: membership.role as TenantContext["role"],
    accessToken,
  };
};

