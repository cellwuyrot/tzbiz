export const ORDER_STATUS = {
  REQUESTED: "Новая заявка",
  IN_REVIEW: "На согласовании",
  AWAITING_INVOICE: "Ожидает счёта",
  AWAITING_PAYMENT: "Ожидает оплаты",
  INTEGRATION_PENDING: "Ожидает подключения TZ ID",
  IN_PROGRESS: "В работе",
  DONE: "Выполнено",
  CANCELLED: "Отменено",
} as const;
export function canTransition(
  mode: string,
  from: string,
  to: string,
  paymentConfirmed = false,
) {
  if (from === to) return true;
  if (from === "DONE" || from === "CANCELLED") return false;
  if (to === "CANCELLED") return true;
  if (mode === "SUBSCRIPTION") return false; // Real subscription state belongs to TZ ID, not an admin checkbox.
  if (to === "IN_REVIEW")
    return ["REQUESTED", "AWAITING_INVOICE"].includes(from);
  if (mode === "PREPAYMENT") {
    if (to === "IN_PROGRESS" && from === "AWAITING_PAYMENT")
      return paymentConfirmed;
    if (to === "DONE" && from === "IN_PROGRESS") return paymentConfirmed;
    return (
      to === "AWAITING_PAYMENT" &&
      ["AWAITING_INVOICE", "IN_REVIEW"].includes(from)
    );
  }
  return (
    (to === "IN_PROGRESS" && ["REQUESTED", "IN_REVIEW"].includes(from)) ||
    (to === "DONE" && from === "IN_PROGRESS")
  );
}
