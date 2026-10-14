import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tzLoginAttempt: { updateMany: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn().mockResolvedValue("synthetic-hash") } }));
import { prisma } from "@/lib/db";
import { openTzData, sealTzData } from "@/lib/tz-id/crypto";
import { tzIdConfigSnapshot } from "@/lib/tz-id/config";
import { readTzTransaction, consumeTzTransaction, resolveTzIdentity } from "@/lib/tz-id/flow";
const transaction = { state: "s".repeat(43), nonce: "n".repeat(43), verifier: "v".repeat(43), expiresAt: Date.now() + 600_000, localUserId: null };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("TZ_ID_TOKEN_KEY", Buffer.alloc(32, 7).toString("base64")); vi.stubEnv("TZ_ID_CLIENT_ID", "tz_synthetic"); vi.stubEnv("TZ_ID_CLIENT_SECRET", "private-synthetic-client-secret"); });
afterEach(() => vi.unstubAllEnvs());
describe("TZ ID crypto and account ownership", () => {
  it("encrypts tokens and rejects tampering", () => {
    const encrypted = sealTzData("private-access-token"); expect(encrypted).not.toContain("private-access-token"); expect(openTzData(encrypted)).toBe("private-access-token");
    expect(() => openTzData(encrypted.slice(0, -4) + "AAAA")).toThrow();
  });
  it("does not expose secret or token-encryption key in readiness output", () => {
    const result = JSON.stringify(tzIdConfigSnapshot()); expect(result).not.toContain("private-synthetic-client-secret"); expect(result).not.toContain(Buffer.alloc(32, 7).toString("base64"));
  });
  it("rejects incorrect token-encryption key and wrong issuer", () => {
    vi.stubEnv("TZ_ID_TOKEN_KEY", "bad"); vi.stubEnv("TZ_ID_ISSUER", "https://foreign.example"); expect(tzIdConfigSnapshot().configured).toBe(false);
  });
  it("rejects expired or forged flow cookie", () => {
    expect(readTzTransaction(sealTzData(transaction))).toEqual(transaction);
    expect(() => readTzTransaction(sealTzData({ ...transaction, expiresAt: 1 }))).toThrow();
    expect(() => readTzTransaction("forged")).toThrow();
  });
  it("rejects state mismatch before consuming transaction", async () => {
    await expect(consumeTzTransaction(transaction, "other")).rejects.toThrow(); expect(prisma.tzLoginAttempt.updateMany).not.toHaveBeenCalled();
  });
  it("consumes flow once using a DB compare-and-set", async () => {
    vi.mocked(prisma.tzLoginAttempt.updateMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await consumeTzTransaction(transaction, transaction.state); await expect(consumeTzTransaction(transaction, transaction.state)).rejects.toThrow();
  });
  it("never merges an existing local account by matching email", async () => {
    const tx = { tzIdentityLink: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, user: { findUnique: vi.fn().mockResolvedValue({ id: "old-user" }), create: vi.fn() } };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => unknown)(tx) as never);
    await expect(resolveTzIdentity("https://id.trioz.ru", "subject", { email: "existing@example.com", email_verified: true }, null)).rejects.toThrow();
    expect(tx.user.create).not.toHaveBeenCalled(); expect(tx.tzIdentityLink.create).not.toHaveBeenCalled();
  });
  it("requires verified email before creating a new local client", async () => {
    const tx = { tzIdentityLink: { findUnique: vi.fn().mockResolvedValue(null) }, user: { create: vi.fn() } };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => unknown)(tx) as never);
    await expect(resolveTzIdentity("https://id.trioz.ru", "subject", { email: "unverified@example.com", email_verified: false }, null)).rejects.toThrow(); expect(tx.user.create).not.toHaveBeenCalled();
  });
  it("new OIDC user is CLIENT even if an external role claims admin", async () => {
    const tx = { tzIdentityLink: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() }, user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "new", role: "CLIENT" }) } };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => unknown)(tx) as never);
    await resolveTzIdentity("https://id.trioz.ru", "subject", { email: "new@example.com", email_verified: true, name: "New" }, null);
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: "CLIENT", passwordHash: "synthetic-hash" }) }));
  });
});
