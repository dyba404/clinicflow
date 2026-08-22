import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";

export function masterKeyConfigurada(): boolean {
  return Boolean(process.env.LOCAL_MASTER_KEY);
}

function deriveKey(): Buffer {
  const master = process.env.LOCAL_MASTER_KEY;
  if (!master) {
    throw new Error("LOCAL_MASTER_KEY no configurada (requerida para datos cifrados)");
  }
  return scryptSync(master, "clinicflow-at-rest-v1", 32);
}

export function cifrar(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function descifrar(packed: string): string {
  const raw = Buffer.from(packed, "base64");
  if (raw.length < 28) throw new Error("dato_cifrado_invalido");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const enc = raw.subarray(28);
  const decipher = createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function hashHmac(plain: string): string {
  return createHmac("sha256", deriveKey()).update(plain).digest("hex");
}
