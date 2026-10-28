import crypto from "node:crypto";

export function bankToken(payload: Record<string, unknown>, password: string) {
  const values: Record<string, unknown> = { ...payload, Password: password };
  const text = Object.keys(values).filter(k => k !== "Token" && values[k] !== null && values[k] !== undefined && ["string", "number", "boolean"].includes(typeof values[k])).sort().map(k => String(values[k])).join("");
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
export function validBankToken(payload: Record<string, unknown>, password: string) {
  if (typeof payload.Token !== "string" || !/^[a-f0-9]{64}$/i.test(payload.Token)) return false;
  return crypto.timingSafeEqual(Buffer.from(payload.Token.toLowerCase(), "hex"), Buffer.from(bankToken(payload, password), "hex"));
}
export function bankConfig() {
  const terminal = process.env.TBANK_TERMINAL_KEY?.trim();
  const password = process.env.TBANK_PASSWORD;
  const rawOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (!terminal || !password || !rawOrigin || process.env.TBANK_ENABLED !== "true") throw Error("Онлайн-оплата пока не настроена. Обратитесь в поддержку.");
  const u = new URL(rawOrigin);
  if (u.protocol !== "https:" || u.username || u.password || u.pathname !== "/" || u.search || u.hash) throw Error("Для оплаты требуется публичный HTTPS-адрес сайта.");
  const receiptMode = process.env.TBANK_RECEIPT_MODE;
  if (receiptMode !== "bank" && receiptMode !== "external") throw Error("Владелец должен настроить фискализацию платежей.");
  return { terminal, password, origin: u.origin, receiptMode };
}
export { checkoutAvailable } from "./payment-policy";
export function receiptFor(title: string, amount: number, email: string, productType: string) {
  const taxation = process.env.TBANK_TAXATION;
  const tax = process.env.TBANK_TAX;
  if (!["osn", "usn_income", "usn_income_outcome", "patent", "esn"].includes(taxation || "") || !["none", "vat0", "vat5", "vat7", "vat10", "vat22", "vat105", "vat107", "vat110", "vat122"].includes(tax || "")) throw Error("Проверьте систему налогообложения и ставку НДС для чеков.");
  return { Email: email, Taxation: taxation, Items: [{ Name: title.slice(0, 128), Price: amount, Quantity: 1, Amount: amount, Tax: tax, PaymentMethod: "full_prepayment", PaymentObject: productType === "GOOD" ? "commodity" : productType === "DIGITAL" ? "intellectual_activity" : "service" }] };
}
export function safePaymentUrl(value: unknown) {
  if (typeof value !== "string") throw Error("Банк не вернул ссылку на оплату.");
  const u = new URL(value);
  const allowed = ["securepay.tinkoff.ru", "securepay.tbank.ru", "pay.tbank.ru", "pay.tbank-online.com"];
  if (u.protocol !== "https:" || !allowed.includes(u.hostname) || u.username || u.password || u.port) throw Error("Банк вернул недопустимый адрес оплаты.");
  return u.toString();
}
export async function bankRequest(method: "Init" | "GetState" | "Charge", payload: Record<string, unknown>) {
  const c = bankConfig();
  const data = { ...payload, TerminalKey: c.terminal };
  const response = await fetch(`https://securepay.tinkoff.ru/v2/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, Token: bankToken(data, c.password) }), signal: AbortSignal.timeout(12_000), redirect: "error", cache: "no-store" });
  if (!response.ok) throw Error("Банк временно недоступен. Не создавайте повторный заказ; проверьте статус позже.");
  const result: Record<string, unknown> = await response.json();
  return result;
}
const FAILED = ["REJECTED", "CANCELED", "DEADLINE_EXPIRED", "AUTH_FAIL"];
export function paymentTransition(from: string, to: string) {
  if (from === to) return false;
  if (from === "REFUNDED" || from === "REVERSED") return false;
  if (from === "PARTIAL_REFUNDED") return to === "REFUNDED";
  if (from === "CONFIRMED") return ["PARTIAL_REFUNDED", "REFUNDED"].includes(to);
  if (FAILED.includes(from)) return false;
  if (from === "AUTHORIZED" && ["NEW", "FORM_SHOWED"].includes(to)) return false;
  return ["NEW", "FORM_SHOWED", "AUTHORIZED", "CONFIRMED", "REFUNDED", "PARTIAL_REFUNDED", "REVERSED", ...FAILED].includes(to);
}
export const failedPaymentStatus = (s: string) => FAILED.includes(s) || s === "REVERSED";
