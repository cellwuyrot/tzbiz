import "dotenv/config";
import { runServiceJobs } from "../lib/services/worker";
import { prisma } from "../lib/db";
import { processMailBatch } from "../lib/mail-outbox";
async function main() {
  try {
    const now = new Date();
    await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
    await prisma.tzLoginAttempt.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 3600_000) } },
    });
    await prisma.rateBucket.deleteMany({ where: { expiresAt: { lt: now } } });
    await prisma.pageViewDaily.deleteMany({
      where: {
        day: {
          lt: new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10),
        },
      },
    });
    const n = await processMailBatch();
    await runServiceJobs();
    await prisma.maintenanceState.upsert({
      where: { key: "mail-worker" },
      create: { key: "mail-worker", lastSuccessAt: new Date() },
      update: { lastSuccessAt: new Date() },
    });
    console.log(`Maintenance complete; considered ${n} mail jobs.`);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Task failed; inspect the isolated test or server logs.");
  process.exitCode = 1;
});
