import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

interface EncryptedPayload {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

const ALGORITHM = "aes-256-gcm";
const AAD = Buffer.from("unvibe-waitlist-v1");

function keyFrom(secret: string): Buffer {
  return createHash("sha256").update(`unvibe-waitlist-storage-v1:${secret}`).digest();
}

export function encryptWaitlistJson(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyFrom(secret), iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  } satisfies EncryptedPayload);
}

export function decryptWaitlistJson<T>(payload: string, secret: string): T {
  const parsed = JSON.parse(payload) as Partial<EncryptedPayload>;
  if (parsed.version !== 1 || !parsed.iv || !parsed.tag || !parsed.ciphertext) {
    throw new Error("Waitlist storage contains an unsupported encrypted payload");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    keyFrom(secret),
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as T;
}
