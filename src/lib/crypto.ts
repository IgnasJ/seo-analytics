import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error("ENCRYPTION_KEY must be a 64-char hex string")
  return Buffer.from(key, "hex")
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":")
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":")
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]).toString("utf8")
}
