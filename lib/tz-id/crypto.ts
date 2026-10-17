import crypto from "node:crypto";
function key() {
  const raw = process.env.TZ_ID_TOKEN_KEY || "";
  if (
    !/^[A-Za-z0-9+/]{43}=$/.test(raw) ||
    Buffer.from(raw, "base64").length !== 32
  )
    throw new Error("TZ ID encryption is not configured");
  return Buffer.from(raw, "base64");
}
export const stateHash = (state: string) =>
  crypto.createHash("sha256").update(state).digest("hex");
export function sealTzData(value: unknown) {
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function openTzData<T>(value: string): T {
  if (value.length > 16_384) throw new Error("Invalid encrypted value");
  const [version, iv, tag, data, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !data || extra)
    throw new Error("Invalid encrypted value");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
