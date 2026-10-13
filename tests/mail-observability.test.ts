import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ prisma: { leadRequest: { updateMany: vi.fn() }, $transaction: vi.fn() } }));
vi.mock("@/lib/mailer", () => ({ sendLeadChannel: vi.fn() }));
import { prisma } from "@/lib/db";
import { sendLeadChannel } from "@/lib/mailer";
import { initialMailState, recordMailResult, retryLeadNotification } from "@/lib/lead-notifications";
import { effectiveMailStatus, MAIL_LEASE_MS } from "@/lib/mail-status";
import { getMailConfig, mailConfigSnapshot } from "@/lib/mailer-config";
import { requestServiceUrl } from "@/lib/request-service";

describe("safe configuration and status semantics", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("returns presence flags, never credentials or internal host", () => {
    vi.stubEnv("SMTP_HOST", "private.internal"); vi.stubEnv("SMTP_USER", "private-login"); vi.stubEnv("SMTP_PASS", "private-secret");
    vi.stubEnv("SMTP_PORT", "587"); vi.stubEnv("SMTP_SECURE", "false");
    const summary = mailConfigSnapshot();
    expect(summary.configured).toBe(true); expect(summary.tlsMode).toBe("STARTTLS");
    expect(JSON.stringify(summary)).not.toMatch(/private.internal|private-login|private-secret/);
  });
  it("rejects placeholders and bad address/port without exposing their values", () => {
    vi.stubEnv("SMTP_HOST", "smtp.example.com"); vi.stubEnv("SMTP_USER", "smtp-account@example.com"); vi.stubEnv("SMTP_PASS", "replace-with-mailbox-password");
    vi.stubEnv("SMTP_PORT", "oops"); vi.stubEnv("EMAIL_FROM", "invalid-from-secret");
    const summary = mailConfigSnapshot(); expect(summary.configured).toBe(false); expect(summary.from).toBeNull();
    expect(JSON.stringify(summary)).not.toContain("invalid-from-secret"); expect(() => getMailConfig()).toThrow();
  });
  it("makes stale pending unknown but leaves historical status untracked", () => {
    expect(effectiveMailStatus("PENDING", new Date(0), MAIL_LEASE_MS + 1)).toBe("UNKNOWN");
    expect(effectiveMailStatus("UNTRACKED", null)).toBe("UNTRACKED");
    expect(effectiveMailStatus("SMTP_ACCEPTED", null)).toBe("SMTP_ACCEPTED");
  });
  it("uses a separate encoded form query, not the service modal query", () => {
    expect(requestServiceUrl("a b&x")).toBe("/?requestService=a%20b%26x#contact");
    expect(requestServiceUrl()).toBe("/#contact");
  });
});
describe("notification persistence and retry claims", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(prisma.leadRequest.updateMany).mockResolvedValue({ count: 1 }); });
  it("starts both attempts only when the lead is saved", () => {
    const now = new Date(); expect(initialMailState(now)).toMatchObject({ clientEmailStatus: "PENDING", internalEmailStatus: "PENDING", clientEmailAttempts: 1, internalEmailAttempts: 1, clientEmailAttemptedAt: now });
  });
  it("compares attempt and pending state to ignore stale completions", async () => {
    await recordMailResult("lead", "internal", 2, { status: "SMTP_ACCEPTED", errorCategory: null });
    expect(prisma.leadRequest.updateMany).toHaveBeenCalledWith({ where: { id: "lead", internalEmailStatus: "PENDING", internalEmailAttempts: 2 }, data: { internalEmailStatus: "SMTP_ACCEPTED", internalEmailErrorCategory: null } });
  });
  it("never sends if atomic claim is rejected", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => unknown)({ leadRequest: { updateMany } }) as never);
    expect(await retryLeadNotification("lead", "client")).toEqual({ conflict: true });
    expect(sendLeadChannel).not.toHaveBeenCalled();
    const where = updateMany.mock.calls[0][0].where;
    expect(where.OR[0].clientEmailStatus.in).toEqual(["FAILED", "UNKNOWN", "UNTRACKED"]);
    expect(where.OR[1].clientEmailStatus).toBe("PENDING");
  });
  it("sends only the claimed channel and records its new attempt", async () => {
    const lead = { id: "lead", clientEmailAttempts: 2, internalEmailAttempts: 1, service: { slug: "service" }, serviceTitle: "Saved title" };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (fn as (tx: unknown) => unknown)({ leadRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn().mockResolvedValue(lead) } }) as never);
    vi.mocked(sendLeadChannel).mockResolvedValue({ status: "FAILED", errorCategory: "AUTH" });
    expect(await retryLeadNotification("lead", "client")).toEqual({ result: { status: "FAILED", errorCategory: "AUTH" }, recorded: true });
    expect(sendLeadChannel).toHaveBeenCalledTimes(1);
    expect(sendLeadChannel).toHaveBeenCalledWith(expect.objectContaining({ serviceTitle: "Saved title", serviceSlug: "service" }), "client");
    expect(prisma.leadRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead", clientEmailStatus: "PENDING", clientEmailAttempts: 2 } }));
  });
});
