import { PaymentButton } from "./payment-button";
import { checkoutAvailable } from "@/lib/billing/payment-policy";
import { renameDisplayText } from "@/lib/display-labels";
import Link from "next/link";
import { ORDER_STATUS } from "@/lib/commerce-client";
import type { BankPayment, BusinessOrder } from "@prisma/client";
export function OrderHistory({ orders }: { orders: (BusinessOrder & { payments?: BankPayment[] })[] }) {
  return (
    <section className="space-y-5">
      <h2 className="type-h3">Заказы и оплата</h2>
      {!orders.length ? (
        <div className="panel p-6 type-body text-muted">
          Здесь появятся выбранные предложения и история их условий.{" "}
          <Link className="text-accent" href="/plans">
            Посмотреть тарифы
          </Link>
          .
        </div>
      ) : (
        orders.map((o) => {
          let plan: {
            projectKey?: string;
            projectUrl?: string;
            fulfillmentTerms?: string;
            description?: string;
            renewalTerms?: string;
            cancellationTerms?: string;
          } = {};
          try {
            plan = JSON.parse(o.snapshot).plan || {};
          } catch {
            /* Keep historical orders visible even if a snapshot is damaged. */
          }
          const payment = o.payments?.[0];
          const paymentLabels: Record<string, string> = { CREATING: "Платёж обрабатывается", NEW: "Ожидает оплаты", FORM_SHOWED: "Ожидает оплаты", AUTHORIZED: "Средства авторизованы; ждём подтверждения", CONFIRMED: "Оплачено", REJECTED: "Платёж отклонён", CANCELED: "Платёж отменён", DEADLINE_EXPIRED: "Срок оплаты истёк", REFUNDED: "Оплата возвращена", PARTIAL_REFUNDED: "Частичный возврат", REVERSED: "Авторизация отменена" };
          return (
            <article key={o.id} className="panel space-y-4 p-6">
              <span className="status-pill">
                {payment?.status === "CONFIRMED" && !["IN_PROGRESS", "DONE", "CANCELLED"].includes(o.status) ? "Ожидает выполнения" : !payment && checkoutAvailable(o.settlementMode, o.amountMinor, o.currency) ? "Готов к оплате" : ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] || o.status}
              </span>
              {payment && <p className="type-ui font-semibold">{paymentLabels[payment.status] || "Статус платежа уточняется"}</p>}
              <h3 className="type-h3 break-words">
                {renameDisplayText(o.title)}
              </h3>
              <p className="type-body text-muted">
                {o.amountMinor === null
                  ? "Стоимость согласуется"
                  : new Intl.NumberFormat("ru-RU", {
                      style: "currency",
                      currency: o.currency,
                    }).format(o.amountMinor / 100)}{" "}
                · версия тарифа {o.planRevision}
              </p>
              <p className="type-ui text-subtle break-all">
                <span className="block">№ {o.id}</span>
                <span className="block">
                  {o.createdAt.toLocaleDateString("ru-RU")}
                </span>
              </p>
              <p className="type-ui text-muted">
                Оплата подтверждается банком. Она не означает автоматическую выдачу
                доступа во внешнем проекте; автосписаний нет.
              </p>
              {plan.projectKey && (
                <p className="type-ui text-muted">
                  Проект использования: {plan.projectKey}. Внешний проект ещё не
                  подтверждает права через Business.
                </p>
              )}
              {checkoutAvailable(o.settlementMode, o.amountMinor, o.currency) && !["DONE", "CANCELLED"].includes(o.status) && <PaymentButton orderId={o.id} checkOnly={!!payment && ["CONFIRMED", "REFUNDED", "PARTIAL_REFUNDED", "AUTHORIZED", "CREATING"].includes(payment.status)} />}
              <details>
                <summary className="type-ui text-accent cursor-pointer">
                  Сохранённые условия и обращение
                </summary>
                <div className="space-y-3 mt-4 type-body text-muted whitespace-pre-wrap break-words">
                  <p>{plan.description}</p>
                  <p>{plan.renewalTerms}</p>
                  <p>{plan.cancellationTerms}</p>
                  <p>Ваше обращение: {o.message}</p>
                </div>
              </details>
            </article>
          );
        })
      )}
    </section>
  );
}
