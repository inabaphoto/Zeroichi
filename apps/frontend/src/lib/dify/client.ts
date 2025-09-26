import { logAudit } from "@/lib/logging/audit";
import { notifyError } from "@/lib/notify";
import { DifyBaseOptions, DifyMetadata, ChatRequest, ChatResponse } from "./types";
import { mapHttpError } from "./errors";

function getBaseUrl(opt?: DifyBaseOptions): string {
  return opt?.baseUrl || process.env.DIFY_BASE_URL || "https://api.dify.ai/v1";
}

function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error("Timeout"), { name: "TimeoutError" })), timeoutMs);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

export function createDifyClient(apiKey: string, baseOpt?: DifyBaseOptions) {
  const baseUrl = getBaseUrl(baseOpt);
  const defaultTimeout = baseOpt?.timeoutMs ?? 15000;

  async function chatCompletions(meta: DifyMetadata, req: ChatRequest): Promise<ChatResponse> {
    const url = `${baseUrl}/chat-messages`;
    const payload: ChatRequest = {
      ...req,
      metadata: { ...(req.metadata || {}), tenantId: meta.tenantId, appId: meta.appId, userId: meta.userId, requestId: meta.requestId },
      user: req.user || meta.userId,
    };
    const body = JSON.stringify(payload);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
    const exec = fetch(url, { method: "POST", headers, body }).then(async (res) => {
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw mapHttpError(res.status, json);
      return json as ChatResponse;
    });
    try {
      const result = await withTimeout(exec, defaultTimeout);
      await logAudit({ scope: "dify", action: "chat", status: "success", tenantId: meta.tenantId, actorId: meta.userId, meta: { appId: meta.appId } });
      return result;
    } catch (e: any) {
      const code = e?.code || e?.name || "DIFY_ERROR";
      await logAudit({ scope: "dify", action: "chat", status: "error", tenantId: meta.tenantId, actorId: meta.userId, code, message: String(e?.message || e) , meta: { appId: meta.appId } });
      await notifyError("Dify chat call failed", { code, message: e?.message, appId: meta.appId, tenantId: meta.tenantId });
      throw e;
    }
  }

  return { chatCompletions } as const;
}

