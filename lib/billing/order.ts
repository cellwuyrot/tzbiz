import crypto from "node:crypto";
import { z } from "zod";
export const orderInput = z.object({
  planId: z.string().cuid(),
  revision: z.number().int().positive(),
  requestKey: z.string().uuid(),
  message: z.string().trim().min(10).max(5000),
  legalVersions: z.record(z.string(), z.string().max(120)).optional(),
  offerAccepted: z.boolean().optional(),
  agreementAccepted: z.literal(true),
  privacyConsent: z.literal(true),
});
export const orderHash = (v: {
  planId: string;
  revision: number;
  message: string;
  legalVersions?: Record<string, string>;
  offerAccepted?: boolean;
}) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        v.planId,
        v.revision,
        v.message,
        ...(v.legalVersions
          ? [
              Object.entries(v.legalVersions).sort(([a], [b]) =>
                a.localeCompare(b),
              ),
              v.offerAccepted === true,
            ]
          : []),
      ]),
    )
    .digest("hex");
