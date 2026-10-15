import crypto from "node:crypto";
import { prisma } from "./db";
import { sendLeadChannel } from "./mailer";
import type { MailChannel } from "./mail-status";
/** SMTP is at-least-once: a crash after SMTP accepts can cause a duplicate, never promise exactly once. */
export async function processMailBatch() {
  const now = new Date();
  const jobs = await prisma.mailJob.findMany({
    where: {
      OR: [
        { status: "PENDING", availableAt: { lte: now } },
        { status: "RUNNING", leaseUntil: { lte: now } },
      ],
    },
    orderBy: { availableAt: "asc" },
    take: 20,
  });
  for (const job of jobs) {
    const token = crypto.randomUUID();
    const claim = await prisma.mailJob.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: "PENDING", availableAt: { lte: now } },
          { status: "RUNNING", leaseUntil: { lte: now } },
        ],
      },
      data: {
        status: "RUNNING",
        leaseToken: token,
        leaseUntil: new Date(Date.now() + 300_000),
        attempts: { increment: 1 },
      },
    });
    if (!claim.count) continue;
    const lead = await prisma.leadRequest.findUnique({
      where: { id: job.leadId },
      include: { service: { select: { slug: true } } },
    });
    if (!lead) continue;
    const channel = job.channel as MailChannel;
    if (channel !== "client" && channel !== "internal") continue;
    const prefix = channel === "client" ? "clientEmail" : "internalEmail";
    const prior =
      channel === "client" ? lead.clientEmailStatus : lead.internalEmailStatus;
    if (prior === "SMTP_ACCEPTED") {
      await prisma.mailJob.updateMany({
        where: { id: job.id, leaseToken: token },
        data: { status: "DONE", leaseToken: null, leaseUntil: null },
      });
      continue;
    }
    await prisma.leadRequest.update({
      where: { id: lead.id },
      data: {
        [`${prefix}Status`]: "PENDING",
        [`${prefix}Attempts`]: { increment: 1 },
        [`${prefix}AttemptedAt`]: new Date(),
      },
    });
    const result = await sendLeadChannel(
      { ...lead, serviceSlug: lead.service?.slug || "unavailable" },
      channel,
    );
    const attempt = job.attempts + 1,
      done = result.status === "SMTP_ACCEPTED",
      terminal = attempt >= 5;
    await prisma.$transaction(async (tx) => {
      const saved = await tx.mailJob.updateMany({
        where: { id: job.id, leaseToken: token },
        data: {
          status: done ? "DONE" : terminal ? "FAILED" : "PENDING",
          errorCategory: result.errorCategory,
          availableAt: new Date(
            Date.now() + Math.min(3600_000, 60_000 * 2 ** attempt),
          ),
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (saved.count)
        await tx.leadRequest.update({
          where: { id: lead.id },
          data: {
            [`${prefix}Status`]: result.status,
            [`${prefix}ErrorCategory`]: result.errorCategory,
          },
        });
    });
  }
  return jobs.length;
}
