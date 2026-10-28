export const subscriptionPeriods = [1, 3, 6, 12];
/** UTC calendar anchor; 31 Jan -> 28 Feb -> 31 Mar, never drift to the 28th forever. */
export function periodEnd(anchor: Date, months: number, index: number) {
  if (!subscriptionPeriods.includes(months) || !Number.isSafeInteger(index) || index < 0) throw Error("Неверный период");
  const y = anchor.getUTCFullYear(), m = anchor.getUTCMonth() + months * (index + 1), d = anchor.getUTCDate();
  const result = new Date(Date.UTC(y, m, 1, anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()));
  const last = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate(); result.setUTCDate(Math.min(d, last)); return result;
}
export function recurringEnabled() { return process.env.TBANK_RECURRENT_ENABLED === "1" && process.env.TBANK_RECURRENT_BANK_APPROVED === "1" && process.env.SUBSCRIPTION_TERMS_APPROVED === "1"; }
