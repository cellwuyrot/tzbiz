import { prisma } from "../db";
import { planData, planInputSchema } from "./plan";
import type { z } from "zod";
export async function saveBillingPlan(
  input: z.infer<typeof planInputSchema>,
  actorId: string,
  edit?: { id: string; revision: number },
) {
  const data = planData(input);
  return prisma.$transaction(async (tx) => {
    if (data.kind === "SERVICE") {
      const service = await tx.service.findUnique({
        where: { id: data.serviceId! },
        select: { isPublished: true },
      });
      if (!service || (data.isPublished && !service.isPublished))
        return { invalidService: true };
    }
    let id = edit?.id;
    if (edit) {
      const changed = await tx.billingPlan.updateMany({
        where: { id: edit.id, revision: edit.revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (changed.count !== 1) return { conflict: true };
    } else {
      id = (await tx.billingPlan.create({ data })).id;
    }
    const plan = await tx.billingPlan.findUniqueOrThrow({
      where: { id },
      include: { service: { select: { title: true, slug: true } } },
    });
    await tx.billingPlanAudit.create({
      data: {
        planId: plan.id,
        actorId,
        revision: plan.revision,
        snapshot: JSON.stringify({ ...data, revision: plan.revision }),
      },
    });
    return { plan };
  });
}
