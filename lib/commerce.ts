import { z } from "zod";
import { prisma } from "./db";
export const commerceInput = z
  .object({
    sellerName: z.string().trim().max(300),
    sellerDetails: z.string().trim().max(5000),
    supportEmail: z.string().trim().email().max(254),
    paymentInstructions: z.string().trim().max(5000),
    fulfillmentTerms: z.string().trim().max(5000),
    refundTerms: z.string().trim().max(5000),
    approved: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .superRefine((v, c) => {
    if (
      v.approved &&
      (v.sellerName.length < 2 ||
        [
          v.sellerDetails,
          v.paymentInstructions,
          v.fulfillmentTerms,
          v.refundTerms,
        ].some((s) => s.length < 10))
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Перед утверждением заполните продавца, реквизиты и все условия (не менее 10 символов).",
      });
  });
export async function getCommerceSettings() {
  return prisma.commerceSettings.findUnique({ where: { id: "commerce" } });
}
export { ORDER_STATUS, canTransition } from "./commerce-client";
