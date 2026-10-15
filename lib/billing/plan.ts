import { z } from "zod";
export const PLAN_KIND_LABELS = {
  SERVICE: "Услуга Business",
  PREMIUM: "Premium основного проекта",
  VPN: "VPN основного проекта",
} as const;
export const SETTLEMENT_LABELS = {
  NO_PREPAYMENT: "Без предоплаты",
  PREPAYMENT: "С предоплатой",
  SUBSCRIPTION: "Подписка",
} as const;
export const PERIOD_LABELS = {
  DAY: "день",
  WEEK: "неделя",
  MONTH: "месяц",
  YEAR: "год",
} as const;
export function rublesToMinor(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(text))
    throw new Error("Некорректная цена");
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor < 1 || minor > 2_147_483_647)
    throw new Error("Цена вне допустимого диапазона");
  return minor;
}
export function minorToRubles(minor: number | null) {
  return minor === null
    ? ""
    : `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
export const planInputSchema = z
  .object({
    kind: z.enum(["SERVICE", "PREMIUM", "VPN"]),
    serviceId: z.string().cuid().nullable(),
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(5000),
    mode: z.enum(["ONE_TIME", "RECURRING"]),
    settlementMode: z
      .enum(["NO_PREPAYMENT", "PREPAYMENT", "SUBSCRIPTION"])
      .optional(),
    externalProductId: z
      .string()
      .trim()
      .max(160)
      .regex(/^[a-zA-Z0-9._:-]*$/, "Некорректный технический ID продукта")
      .default(""),
    amountRub: z
      .string()
      .max(30)
      .transform((value, ctx) => {
        try {
          return rublesToMinor(value);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Цена: положительная сумма в рублях с максимум двумя знаками после запятой.",
          });
          return z.NEVER;
        }
      }),
    currency: z.literal("RUB"),
    periodUnit: z.enum(["DAY", "WEEK", "MONTH", "YEAR"]).nullable(),
    periodCount: z.number().int().min(1).max(365).nullable(),
    renewalTerms: z.string().trim().max(5000),
    cancellationTerms: z.string().trim().max(5000),
    internalNotes: z.string().trim().max(5000),
    isPublished: z.boolean(),
    isArchived: z.boolean(),
  })
  .superRefine((plan, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const settlement =
      plan.settlementMode ??
      (plan.mode === "RECURRING" ? "SUBSCRIPTION" : "PREPAYMENT");
    if ((settlement === "SUBSCRIPTION") !== (plan.mode === "RECURRING"))
      issue(
        "mode",
        "Подписка требует регулярного периода; другие режимы — разовую услугу.",
      );
    if (
      plan.kind !== "SERVICE" &&
      (settlement !== "SUBSCRIPTION" || plan.mode !== "RECURRING")
    )
      issue("kind", "Premium/VPN оформляются только как подписки TZ ID.");
    if (plan.isPublished && plan.kind !== "SERVICE" && !plan.externalProductId)
      issue(
        "externalProductId",
        "Укажите настоящий ID продукта TZ ID из документации платформы.",
      );
    if (plan.kind === "SERVICE" && !plan.serviceId)
      issue("serviceId", "Выберите существующую услугу.");
    if (plan.kind !== "SERVICE" && plan.serviceId)
      issue("serviceId", "Premium/VPN не привязываются к локальной услуге.");
    if (
      plan.mode === "RECURRING" &&
      (!plan.periodUnit || !plan.periodCount || plan.renewalTerms.length < 10)
    )
      issue(
        "renewalTerms",
        "Для подписочной услуги укажите период и условия автопродления.",
      );
    if (
      plan.isPublished &&
      (plan.isArchived ||
        (plan.amountRub === null && settlement !== "NO_PREPAYMENT") ||
        plan.cancellationTerms.length < 10)
    )
      issue(
        "isPublished",
        "Публикация требует цены, условий отмены и неархивного тарифа.",
      );
  });
export function planData(input: z.infer<typeof planInputSchema>) {
  const { amountRub, ...data } = input;
  return {
    ...data,
    settlementMode:
      input.settlementMode ??
      (input.mode === "RECURRING" ? "SUBSCRIPTION" : "PREPAYMENT"),
    amountMinor: amountRub,
    periodUnit: input.mode === "RECURRING" ? input.periodUnit : null,
    periodCount: input.mode === "RECURRING" ? input.periodCount : null,
    renewalTerms: input.mode === "RECURRING" ? input.renewalTerms : "",
  };
}
export function publicPlan<
  T extends {
    id: string;
    kind: string;
    title: string;
    description: string;
    mode: string;
    amountMinor: number | null;
    currency: string;
    periodUnit: string | null;
    periodCount: number | null;
    renewalTerms: string;
    cancellationTerms: string;
    revision: number;
    settlementMode?: string;
    service?: { slug: string; title: string } | null;
  },
>(plan: T) {
  const {
    id,
    kind,
    title,
    description,
    mode,
    settlementMode,
    amountMinor,
    currency,
    periodUnit,
    periodCount,
    renewalTerms,
    cancellationTerms,
    revision,
    service,
  } = plan;
  return {
    id,
    kind,
    title,
    description,
    mode,
    settlementMode:
      settlementMode ?? (mode === "RECURRING" ? "SUBSCRIPTION" : "PREPAYMENT"),
    amountMinor,
    currency,
    periodUnit,
    periodCount,
    renewalTerms,
    cancellationTerms,
    revision,
    service,
  };
}
