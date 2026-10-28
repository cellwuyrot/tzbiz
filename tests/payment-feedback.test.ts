import { it, expect } from "vitest";
import { bankReturnMessage, paymentStateMessage } from "@/lib/services/payment-feedback";
it("explains a failed browser return without treating it as bank evidence", () => {
  expect(bankReturnMessage("failed")).toContain("не платите повторно");
  expect(bankReturnMessage("return")).toContain("Сам возврат не подтверждает оплату");
  expect(bankReturnMessage(null)).toBe("");
  expect(bankReturnMessage("CONFIRMED")).toBe("");
});
it.each(["REJECTED", "AUTH_FAIL", "CANCELED", "DEADLINE_EXPIRED"])("shows feedback for %s", status => expect(paymentStateMessage(status)).not.toBe(""));
it.each(["CREATING", "CHARGING", "INITIALIZED"])("does not falsely call an ambiguous operation %s a failure", status => {
  expect(paymentStateMessage(status)).toContain("уточняется");
  expect(paymentStateMessage(status)).toContain("Не создавайте повторный");
});
it("does not present AUTHORIZED or a form visit as completed payment", () => {
  expect(paymentStateMessage("AUTHORIZED")).toContain("не выдан");
  expect(paymentStateMessage("FORM_SHOWED")).toContain("не выдаёт доступ");
});
