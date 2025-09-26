import { describe, it, expect } from "vitest";
import { isNonEmptyString, isValidRole } from "@/lib/validation";

describe("validation utils", () => {
  it("isNonEmptyString checks strings with trimming", () => {
    expect(isNonEmptyString("hello")) .toBe(true);
    expect(isNonEmptyString("  world  ")).toBe(true);
    expect(isNonEmptyString(" ")).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(123 as any)).toBe(false);
  });

  it("isValidRole validates allowed roles", () => {
    expect(isValidRole("owner")).toBe(true);
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("member")).toBe(true);
    expect(isValidRole("viewer")).toBe(true);
    expect(isValidRole("superuser")).toBe(false);
  });
});

