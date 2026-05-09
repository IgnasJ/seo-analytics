import { describe, it, expect } from "bun:test"

describe("crypto encrypt/decrypt", () => {
  it("round-trips a string", async () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64) // 32-byte hex
    const { encrypt, decrypt } = await import("../crypto")
    const original = "my-secret-refresh-token"
    const encrypted = encrypt(original)
    expect(encrypted).not.toBe(original)
    expect(encrypted).toContain(":") // iv:authTag:ciphertext format
    expect(decrypt(encrypted)).toBe(original)
  })

  it("produces different ciphertext for same input (random IV)", async () => {
    process.env.ENCRYPTION_KEY = "a".repeat(64)
    const { encrypt } = await import("../crypto")
    const a = encrypt("same")
    const b = encrypt("same")
    expect(a).not.toBe(b)
  })
})
