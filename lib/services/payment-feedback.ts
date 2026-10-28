/** Browser return parameters are hints, never evidence of a successful payment. */
export function bankReturnMessage(value: string | null): string {
  if (value === "failed") return "Оплата не завершена: банк вернул вас со страницы неуспешной оплаты. Нажмите «Проверить оплату» у нужной услуги. Если деньги списались, не платите повторно до сверки.";
  if (value === "return") return "Вы вернулись из банка. Сам возврат не подтверждает оплату: нажмите «Проверить оплату». Доступ выдаётся только после подтверждения банка.";
  return "";
}
export function paymentStateMessage(status: string | null | undefined): string {
  if (["REJECTED", "AUTH_FAIL"].includes(status || "")) return "Банк не подтвердил платёж. Новое списание автоматически не отправляется. Уже оплаченный срок сохраняется; при его отсутствии новый доступ не выдаётся.";
  if (status === "CANCELED") return "Платёж отменён. Новый доступ по этому платежу не выдаётся.";
  if (status === "DEADLINE_EXPIRED") return "Срок оплаты истёк. Новый доступ по этому платежу не выдаётся.";
  if (["CREATING", "INITIALIZED", "CHARGING"].includes(status || "")) return "Результат банковской операции уточняется. Не создавайте повторный платёж. Нажмите «Проверить оплату»; если статус не меняется, обратитесь в поддержку.";
  if (status === "AUTHORIZED") return "Банк авторизовал платёж, но окончательное подтверждение ещё не получено. Новый доступ пока не выдан.";
  if (["NEW", "FORM_SHOWED"].includes(status || "")) return "Окончательное подтверждение оплаты ещё не получено. Само открытие банковской формы не выдаёт доступ.";
  return "";
}
