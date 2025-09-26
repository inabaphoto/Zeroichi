export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export type Role = "owner" | "admin" | "member" | "viewer";

export function isValidRole(value: unknown): value is Role {
  return value === "owner" || value === "admin" || value === "member" || value === "viewer";
}

