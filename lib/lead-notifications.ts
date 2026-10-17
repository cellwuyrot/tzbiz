import { prisma } from "./db";
import { sendLeadChannel, type LeadNotification } from "./mailer";
import {
  MAIL_LEASE_MS,
  MAIL_RETRY_DELAY_MS,
  type MailChannel,
  type MailResult,
} from "./mail-status";

export function initialMailState(now: Date) {
  return {
    clientEmailStatus: "PENDING" as const,
    internalEmailStatus: "PENDING" as const,
    clientEmailAttempts: 1,
    internalEmailAttempts: 1,
    clientEmailAttemptedAt: now,
    internalEmailAttemptedAt: now,
  };
}
export async function recordMailResult(
  id: string,
  channel: MailChannel,
  attempt: number,
  result: MailResult,
) {
  const where =
    channel === "client"
      ? {
          id,
          clientEmailStatus: "PENDING" as const,
          clientEmailAttempts: attempt,
        }
      : {
          id,
          internalEmailStatus: "PENDING" as const,
          internalEmailAttempts: attempt,
        };
  const data =
    channel === "client"
      ? {
          clientEmailStatus: result.status,
          clientEmailErrorCategory: result.errorCategory,
        }
      : {
          internalEmailStatus: result.status,
          internalEmailErrorCategory: result.errorCategory,
        };
  // Compare-and-set prevents a late old result overwriting a newer retry.
  const updated = await prisma.leadRequest.updateMany({ where, data });
  return updated.count === 1;
}
export async function retryLeadNotification(id: string, channel: MailChannel) {
  const now = new Date();
  const delay = new Date(now.getTime() - MAIL_RETRY_DELAY_MS);
  const stale = new Date(now.getTime() - MAIL_LEASE_MS);
  const where =
    channel === "client"
      ? {
          id,
          OR: [
            {
              clientEmailStatus: {
                in: ["FAILED", "UNKNOWN", "UNTRACKED"] as (
                  "FAILED" | "UNKNOWN" | "UNTRACKED"
                )[],
              },
              OR: [
                { clientEmailAttemptedAt: null },
                { clientEmailAttemptedAt: { lte: delay } },
              ],
            },
            {
              clientEmailStatus: "PENDING" as const,
              OR: [
                { clientEmailAttemptedAt: null },
                { clientEmailAttemptedAt: { lte: stale } },
              ],
            },
          ],
        }
      : {
          id,
          OR: [
            {
              internalEmailStatus: {
                in: ["FAILED", "UNKNOWN", "UNTRACKED"] as (
                  "FAILED" | "UNKNOWN" | "UNTRACKED"
                )[],
              },
              OR: [
                { internalEmailAttemptedAt: null },
                { internalEmailAttemptedAt: { lte: delay } },
              ],
            },
            {
              internalEmailStatus: "PENDING" as const,
              OR: [
                { internalEmailAttemptedAt: null },
                { internalEmailAttemptedAt: { lte: stale } },
              ],
            },
          ],
        };
  const data =
    channel === "client"
      ? {
          clientEmailStatus: "PENDING" as const,
          clientEmailAttempts: { increment: 1 },
          clientEmailAttemptedAt: now,
          clientEmailErrorCategory: null,
        }
      : {
          internalEmailStatus: "PENDING" as const,
          internalEmailAttempts: { increment: 1 },
          internalEmailAttemptedAt: now,
          internalEmailErrorCategory: null,
        };
  const lead = await prisma.$transaction(async (tx) => {
    const claimed = await tx.leadRequest.updateMany({ where, data });
    if (!claimed.count) return undefined;
    return tx.leadRequest.findUnique({
      where: { id },
      include: { service: { select: { slug: true, title: true } } },
    });
  });
  if (lead === undefined) return { conflict: true };
  if (!lead) return { missing: true };
  const attempt =
    channel === "client"
      ? lead.clientEmailAttempts
      : lead.internalEmailAttempts;
  const payload: LeadNotification = {
    ...lead,
    serviceSlug: lead.service?.slug ?? "unavailable",
  };
  const result = await sendLeadChannel(payload, channel);
  let recorded = true;
  try {
    recorded = await recordMailResult(id, channel, attempt, result);
  } catch {
    recorded = false;
    console.error("Retry result not recorded", { leadId: id, channel });
  }
  return { result, recorded };
}
