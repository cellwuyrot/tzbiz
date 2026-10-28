/** Operator-only migration. Obtain issuer/subject from the authenticated TZ ID admin,
 * verify account ownership separately. Never infer subject from email. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const args = process.argv.slice(2);
const value = (key: string) => args[args.indexOf(key) + 1];
const userId = args.includes("--user-id") ? value("--user-id") : "";
const subject = args.includes("--subject") ? value("--subject") : "";
if (!/^c[a-z0-9]{20,32}$/.test(userId) || !subject || subject.startsWith("--") || subject.length > 255 || !args.includes("--confirm-ownership")) throw Error("Usage: npm run account:link-tz -- --user-id <local-id> --subject <verified-TZ-sub> --confirm-ownership");
const db = new PrismaClient();
try {
  await db.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const link = await tx.tzIdentityLink.findUnique({ where: { userId } });
    if (link && (link.subject !== subject || link.issuer !== "https://id.trioz.ru")) throw Error("Account already linked to another identity; no changes made.");
    if (!link) await tx.tzIdentityLink.create({ data: { userId, subject, issuer: "https://id.trioz.ru" } });
    await tx.session.deleteMany({ where: { userId } });
    console.log(`Linked local account ${user.id}. Administrator permissions still require a current TZ ID project grant.`);
  });
} finally { await db.$disconnect(); }
