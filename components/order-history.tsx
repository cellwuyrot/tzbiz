import Link from "next/link";
import { ORDER_STATUS } from "@/lib/commerce-client";
import type { BusinessOrder } from "@prisma/client";
export function OrderHistory({ orders }: { orders: BusinessOrder[] }) {
  return (
    <section className="space-y-5">
      <h2 className="type-h3">Мои заявки на тарифы</h2>
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
            description?: string;
            renewalTerms?: string;
            cancellationTerms?: string;
          } = {};
          try {
            plan = JSON.parse(o.snapshot).plan || {};
          } catch {
            /* Keep historical orders visible even if a snapshot is damaged. */
          }
          return (
            <article key={o.id} className="panel space-y-4 p-6">
              <span className="status-pill">
                {ORDER_STATUS[o.status as keyof typeof ORDER_STATUS] ||
                  o.status}
              </span>
              <h3 className="type-h3 break-words">{o.title}</h3>
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
            <span className="block">{o.createdAt.toLocaleDateString("ru-RU")}</span>
              </p>
              <p className="type-ui text-muted">
                Этот статус не является подтверждением платежа или активной
                подписки TZ ID.
              </p>
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
