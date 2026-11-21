import crypto from "crypto";
import { config } from "../config.js";
import { HttpError } from "./http.js";

export const encryptionEnabled = () => /^[a-f0-9]{64}$/i.test(config.encryptionKey);
const key = () => {
  if (!encryptionEnabled()) throw new HttpError(503, "Account connections are not configured on this server (missing ENCRYPTION_KEY).");
  return Buffer.from(config.encryptionKey, "hex");
};

// AES-256-GCM. Output: iv:tag:ciphertext (base64).
export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(":");
}
export function decrypt(str) {
  const [iv, tag, enc] = String(str).split(":").map((x) => Buffer.from(x, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString("utf8"));
}
