import { z } from "zod";
import { rublesToMinor } from "./billing/plan";
export const INVOICE_METHODS = {
  BANK_TRANSFER: "Банковский перевод",
  ACQUIRING: "Эквайринг",
  RECURRING: "Рекуррентные платежи у провайдера",
} as const;
export const INVOICE_STATUSES = {
  ISSUED: "Выставлен",
  PAID: "Оплата сверена вручную",
  CANCELLED: "Отменён",
} as const;
export function permittedPaymentHosts() {
  return (process.env.PAYMENT_LINK_HOSTS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
export function validPaymentUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.port === "" &&
      permittedPaymentHosts().includes(u.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}
export const invoiceInput = z
  .object({
    requestKey: z.string().uuid(),
    userId: z.string().cuid(),
    orderId: z.string().cuid().nullable().default(null),
    providerConfirmed: z.boolean().default(false),
    method: z.enum(["BANK_TRANSFER", "ACQUIRING", "RECURRING"]),
    title: z.string().trim().min(3).max(300),
    amountRub: z
      .string()
      .max(30)
      .refine((s) => {
        try {
          return rublesToMinor(s)! > 0;
        } catch {
          return false;
        }
      }, "Введите положительную сумму с точностью до копеек."),
    buyerName: z.string().trim().min(2).max(300),
    buyerInn: z
      .string()
      .trim()
      .regex(/^(?:\d{10}|\d{12})?$/, "ИНН покупателя: 10 или 12 цифр."),
    buyerDetails: z.string().trim().max(3000),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !Number.isNaN(Date.parse(s)) &&
          new Date(s).toISOString().slice(0, 10) === s,
        "Некорректная дата.",
      ),
    taxNote: z.string().trim().min(3).max(300),
    paymentUrl: z.string().trim().max(2000).default(""),
    periodMonths: z.number().int().min(1).max(12).nullable().default(null),
    renewalTerms: z.string().trim().max(3000).default(""),
  })
  .superRefine((v, c) => {
    if (v.method !== "BANK_TRANSFER" && !v.providerConfirmed)
      c.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["providerConfirmed"],
        message: "Подтвердите проверку ссылки и условий у провайдера.",
      });
    if (v.method !== "BANK_TRANSFER" && !validPaymentUrl(v.paymentUrl))
      c.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentUrl"],
        message:
          "Укажите HTTPS-ссылку платёжного провайдера. Его точный домен должен быть разрешён в PAYMENT_LINK_HOSTS на сервере.",
      });
    if (v.method === "BANK_TRANSFER" && v.paymentUrl)
      c.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentUrl"],
        message: "Банковский перевод не использует внешнюю ссылку.",
      });
    if (
      v.method === "RECURRING" &&
      (!v.periodMonths || v.renewalTerms.length < 20)
    )
      c.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["renewalTerms"],
        message:
          "Укажите период и условия продления и отмены (не менее 20 символов).",
      });
  });
export const invoiceAction = z
  .object({
    action: z.enum(["PAID", "CANCELLED"]),
    revision: z.number().int().positive(),
    reference: z.string().trim().max(300).default(""),
    confirm: z.literal(true),
  })
  .superRefine((v, c) => {
    if (v.action === "PAID" && v.reference.length < 5)
      c.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reference"],
        message:
          "Укажите номер банковской операции или транзакции провайдера (от 5 символов).",
      });
  });
export type SellerSnapshot = {
  sellerName: string;
  sellerDetails: string;
  sellerInn: string;
  sellerKpp: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  bankCorrespondentAccount: string;
  supportEmail: string;
};
export function bankReady(s: Partial<SellerSnapshot> | null) {
  return Boolean(
    s?.sellerName &&
    s.sellerDetails &&
    /^(\d{10}|\d{12})$/.test(s.sellerInn || "") &&
    s.bankName &&
    /^\d{9}$/.test(s.bankBik || "") &&
    /^\d{20}$/.test(s.bankAccount || "") &&
    /^\d{20}$/.test(s.bankCorrespondentAccount || ""),
  );
}
