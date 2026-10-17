import "dotenv/config";
import { prisma } from "../lib/db";
import { renameDisplayText } from "../lib/display-labels";
const apply = process.argv.includes("--apply");
async function main() {
  let services = 0,
    plans = 0;
  for (const service of await prisma.service.findMany()) {
    const data = {
      title: renameDisplayText(service.title),
      shortDescription: renameDisplayText(service.shortDescription),
      fullDescription: renameDisplayText(service.fullDescription),
      includes: JSON.stringify(
        JSON.parse(service.includes).map(renameDisplayText),
      ),
      stages: JSON.stringify(JSON.parse(service.stages).map(renameDisplayText)),
    };
    if (
      Object.entries(data).every(
        ([k, v]) => v === service[k as keyof typeof service],
      )
    )
      continue;
    if (
      data.title.length > 160 ||
      data.shortDescription.length > 1000 ||
      data.fullDescription.length > 10000
    )
      throw Error(
        `Service ${service.id}: shorten display text manually before applying.`,
      );
    services++;
    if (apply) {
      const u = await prisma.service.updateMany({
        where: { id: service.id, updatedAt: service.updatedAt },
        data,
      });
      if (!u.count)
        throw Error("Service changed concurrently; run the command again.");
    }
  }
  for (const plan of await prisma.billingPlan.findMany()) {
    const data = {
      title: renameDisplayText(plan.title),
      description: renameDisplayText(plan.description),
      renewalTerms: renameDisplayText(plan.renewalTerms),
      cancellationTerms: renameDisplayText(plan.cancellationTerms),
    };
    if (
      Object.entries(data).every(([k, v]) => v === plan[k as keyof typeof plan])
    )
      continue;
    if (
      data.title.length > 160 ||
      [data.description, data.renewalTerms, data.cancellationTerms].some(
        (s) => s.length > 5000,
      )
    )
      throw Error(
        `Plan ${plan.id}: shorten display text manually before applying.`,
      );
    plans++;
    if (apply)
      await prisma.$transaction(async (tx) => {
        const u = await tx.billingPlan.updateMany({
          where: { id: plan.id, revision: plan.revision },
          data: { ...data, revision: { increment: 1 } },
        });
        if (!u.count)
          throw Error("Plan changed concurrently; run the command again.");
        const current = await tx.billingPlan.findUniqueOrThrow({
          where: { id: plan.id },
        });
        await tx.billingPlanAudit.create({
          data: {
            planId: plan.id,
            actorId: null,
            revision: current.revision,
            snapshot: JSON.stringify(current),
          },
        });
      });
  }
  console.log(
    JSON.stringify({
      mode: apply ? "APPLIED" : "DRY_RUN",
      services,
      plans,
      identifiersChanged: false,
      historicalSnapshotsChanged: false,
    }),
  );
}
main()
  .catch(() => {
    console.error(
      "Display label update failed. Check text length, migrations and concurrent edits; previously completed rows remain applied safely.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
