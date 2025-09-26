import { DifyError } from "./types";

export function mapHttpError(status: number, body: any): DifyError {
  const message = (body && (body.message || body.error || body.detail)) || `HTTP ${status}`;
  let code = "DIFY_HTTP_ERROR";
  if (status === 401) code = "DIFY_UNAUTHORIZED";
  else if (status === 403) code = "DIFY_FORBIDDEN";
  else if (status === 404) code = "DIFY_NOT_FOUND";
  else if (status === 408) code = "DIFY_TIMEOUT";
  else if (status >= 500) code = "DIFY_SERVER_ERROR";
  return new DifyError(code, String(message), status);
}

