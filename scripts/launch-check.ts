import "dotenv/config";
import { prisma } from "../lib/db";
import { bankReady, permittedPaymentHosts } from "../lib/invoices";
import { tzIdConfigSnapshot } from "../lib/tz-id/config";
import { mailConfigSnapshot } from "../lib/mailer-config";
async function main() {
  const checks: { check: string; ok: boolean; required: boolean }[] = [];
  const add = (check: string, ok: boolean, required = true) =>
    checks.push({ check, ok, required });
  add("NODE_22_OR_NEWER", Number(process.versions.node.split(".")[0]) >= 22);
  add(
    "DATABASE_POSTGRESQL",
    /^postgres(?:ql)?:/.test(process.env.DATABASE_URL || ""),
  );
  add(
    "SESSION_SECRET",
    Boolean(
      process.env.SESSION_SECRET &&
      process.env.SESSION_SECRET.length >= 32 &&
      !process.env.SESSION_SECRET.startsWith("replace-"),
    ),
  );
  add(
    "HTTPS_APP_URL",
    /^https:\/\//.test(process.env.NEXT_PUBLIC_APP_URL || ""),
  );
  add("LEGAL_OWNER_APPROVAL", process.env.LEGAL_APPROVED === "true");
  try {
    const settings = await prisma.commerceSettings.findUnique({
      where: { id: "commerce" },
    });
    add("COMMERCE_APPROVED", Boolean(settings?.approved));
    add("BANK_DETAILS", bankReady(settings));
    await prisma.invoice.count();
    await prisma.integrationCheck.count();
    add("DATABASE_SCHEMA", true);
    const worker = await prisma.maintenanceState.findUnique({
      where: { key: "mail-worker" },
    });
    add(
      "MAIL_WORKER_RECENT_SUCCESS",
      Boolean(worker && Date.now() - worker.lastSuccessAt.getTime() < 300000),
    );
  } catch {
    add("DATABASE_SCHEMA", false);
  }
  add("SMTP_CONFIGURATION", mailConfigSnapshot().configured);
  add("TZ_ID_CONFIGURATION", tzIdConfigSnapshot().configured);
  add("EXTERNAL_PAYMENT_HOSTS", permittedPaymentHosts().length > 0, false);
  console.log(
    JSON.stringify(
      {
        checks,
        automaticAcquiring: false,
        localRecurringCharges: false,
        automaticTzIdFulfillment: false,
      },
      null,
      2,
    ),
  );
  if (checks.some((c) => c.required && !c.ok)) process.exitCode = 1;
}
main()
  .catch(() => {
    console.error("Launch checks failed. Inspect server-side configuration.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
