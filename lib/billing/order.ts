import crypto from "node:crypto";
import { z } from "zod";
export const orderInput = z.object({
  planId: z.string().cuid(),
  revision: z.number().int().positive(),
  requestKey: z.string().uuid(),
  message: z.string().trim().min(10).max(5000),
  agreementAccepted: z.literal(true),
  privacyConsent: z.literal(true),
});
export const orderHash = (v: {
  planId: string;
  revision: number;
  message: string;
}) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify([v.planId, v.revision, v.message]))
    .digest("hex");
