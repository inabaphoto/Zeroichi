export type DifyBaseOptions = {
  baseUrl?: string; // default from env DIFY_BASE_URL or https://api.dify.ai/v1
  timeoutMs?: number; // default 15000
};

export type DifyMetadata = {
  tenantId: string;
  appId: string;
  userId: string;
  requestId?: string;
};

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type ChatRequest = {
  inputs?: Record<string, unknown>;
  query?: string; // for simple chat
  messages?: ChatMessage[]; // for multi-turn
  response_mode?: "blocking" | "streaming";
  user?: string; // external user identifier
  metadata?: Record<string, unknown>;
};

export type ChatResponse = {
  id: string;
  answer?: string;
  conversation_id?: string;
  created_at?: number;
  [k: string]: unknown;
};

export class DifyError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message);
    this.name = "DifyError";
  }
}

