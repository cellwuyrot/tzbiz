import { renameDisplayText } from "@/lib/display-labels";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  publicPlan,
  PLAN_KIND_LABELS,
  PERIOD_LABELS,
  SETTLEMENT_LABELS,
} from "@/lib/billing/plan";
import { SiteHeader } from "@/components/site-header";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Услуги и подписки",
  description:
    "Выберите формат работы: услуга без предоплаты, с предоплатой или предложение подписки Premium / «Надёжное соединение» TZ ID.",
  alternates: { canonical: "/plans" },
};
export default async function Plans({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const rows = await prisma.billingPlan.findMany({
    where: {
      isPublished: true,
      isArchived: false,
      OR: [
        { kind: { in: ["PREMIUM", "VPN"] } },
        { kind: "SERVICE", service: { isPublished: true } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { service: { select: { title: true, slug: true } } },
  });
  const plans = rows.map(publicPlan),
    params = await searchParams;
  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader basePath="/" />
      <section className="site-shell space-y-8 py-12">
        <div className="max-w-3xl">
          <p className="eyebrow">Решения / Тарифы</p>
          <h1 className="type-h2 mt-4">Выберите удобный формат работы</h1>
          <p className="type-lead text-muted mt-5">
            Разовые задачи, работа без предоплаты и предложения подписок. До
            отправки заявки вы видите условия, а после — сохраняете их в
            кабинете.
          </p>
        </div>
        <div className="panel flex flex-wrap items-center justify-between gap-5 p-6">
          <p className="max-w-3xl type-body text-muted">
            Онлайн-оплата пока не подключена. Заявка на тариф не списывает
            деньги и не выдаёт подписку. Условия Premium / «Надёжное соединение»
            должны быть подтверждены биллингом TZ ID.
          </p>
          <Link href="/payment" className="button-secondary">
            Как оформить и оплатить
          </Link>
        </div>
        {params.auth === "failed" && (
          <p role="alert" className="panel p-5 text-danger">
            Вход не завершён. Начните заново через кабинет. Если email уже
            используется, войдите в существующий аккаунт и свяжите TZ ID.
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          {plans.map((p) => (
            <article
              key={p.id}
              className="panel flex flex-col gap-5 p-6 sm:p-8"
            >
              <div className="flex flex-wrap gap-3">
                <span className="status-pill">
                  {
                    SETTLEMENT_LABELS[
                      p.settlementMode as keyof typeof SETTLEMENT_LABELS
                    ]
                  }
                </span>
                <span className="type-ui self-center text-subtle">
                  {PLAN_KIND_LABELS[p.kind as keyof typeof PLAN_KIND_LABELS]}
                </span>
              </div>
              <h2 className="type-h3 break-words">
                {renameDisplayText(p.title)}
              </h2>
              <p className="type-h2">
                {p.amountMinor === null
                  ? "По согласованию"
                  : new Intl.NumberFormat("ru-RU", {
                      style: "currency",
                      currency: p.currency,
                    }).format(p.amountMinor / 100)}
              </p>
              {p.mode === "RECURRING" && p.periodUnit && (
                <p className="type-ui text-muted">
                  Период: {p.periodCount}{" "}
                  {PERIOD_LABELS[p.periodUnit as keyof typeof PERIOD_LABELS]}
                </p>
              )}
              <p className="type-body whitespace-pre-wrap break-words text-muted">
                {renameDisplayText(p.description)}
              </p>
              <p className="type-ui text-subtle">
                {p.settlementMode === "NO_PREPAYMENT"
                  ? "Без предоплаты — не значит бесплатно. Стоимость и расчёт согласуются до начала работ."
                  : p.settlementMode === "SUBSCRIPTION"
                    ? "Заявка не активирует Premium / «Надёжное соединение». Автоматические списания недоступны."
                    : "Сначала согласование и счёт. Доступ не предоставляется по одному факту заявки."}
              </p>
              <div className="mt-auto pt-3">
                <Link className="button-primary" href={`/plans/${p.id}`}>
                  Условия и заявка →
                </Link>
              </div>
            </article>
          ))}
        </div>
        {!plans.length && (
          <div className="panel space-y-4 p-8">
            <h2 className="type-h3">Готовим предложения</h2>
            <p className="type-body text-muted">
              Опубликованных тарифов пока нет. Вы можете обсудить индивидуальную
              задачу.
            </p>
            <Link href="/#contact" className="button-primary">
              Обсудить задачу
            </Link>
          </div>
        )}
        <div className="flex gap-5 type-ui">
          <Link href="/agreement" className="text-muted">
            Соглашение
          </Link>
          <Link href="/privacy" className="text-muted">
            Политика данных
          </Link>
        </div>
      </section>
    </main>
  );
}
