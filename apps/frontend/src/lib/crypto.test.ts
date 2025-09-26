import { describe, it, expect, beforeAll } from "vitest";
import { encryptString, decryptString } from "@/lib/crypto";

beforeAll(() => {
  // 32 bytes key (all zeros) base64
  process.env.ENCRYPTION_KEY_BASE64 = Buffer.alloc(32, 0).toString("base64");
});

describe("crypto", () => {
  it("encrypts and decrypts roundtrip", () => {
    const plain = "hello world";
    const enc = encryptString(plain);
    expect(typeof enc).toBe("string");
    const dec = decryptString(enc);
    expect(dec).toBe(plain);
  });

  it("fails when key not set", () => {
    const backup = process.env.ENCRYPTION_KEY_BASE64;
    delete process.env.ENCRYPTION_KEY_BASE64;
    expect(() => encryptString("x")).toThrow();
    process.env.ENCRYPTION_KEY_BASE64 = backup;
  });
});

