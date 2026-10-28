export function checkoutAvailable(mode: string, amount: number | null, currency = "RUB") {
  return ["PREPAYMENT", "SUBSCRIPTION"].includes(mode) && currency === "RUB" && Number.isSafeInteger(amount) && amount! > 0;
}
