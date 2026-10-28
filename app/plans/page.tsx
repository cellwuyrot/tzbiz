import { MediaImage } from "@/components/media-image";
import { renameDisplayText } from "@/lib/display-labels";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import {
  publicPlan,
  PRODUCT_TYPE_LABELS,
  PLAN_KIND_LABELS,
  PERIOD_LABELS,
  SETTLEMENT_LABELS,
} from "@/lib/billing/plan";
import { SiteHeader } from "@/components/site-header";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Товары, услуги и подписки",
  description:
    "Выберите формат работы: услуга без предоплаты, с предоплатой или предложение подписки Premium / «Надёжное соединение» для проектов TrioZ.",
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
        { kind: { in: ["PREMIUM", "VPN", "PRODUCT"] } },
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
            Выберите предложение и проект, в котором оно действует.
            Тарифы с фиксированной предоплатой можно оформить и оплатить через Т-Банк.
            Стоимость по согласованию и услуги без предоплаты обсуждаем отдельно.
            Вход — через TZ ID; выдача доступа в другом проекте подтверждается отдельно.
          </p>
          <Link href="/payment" className="button-secondary">
            Как оформить и оплатить
          </Link>
        </div>
        {params.auth === "failed" && (
          <p role="alert" className="panel p-5 text-danger">
            Вход не завершён. Начните заново через кабинет. Если у вас уже был аккаунт Business,
            обратитесь в поддержку для переноса привязки к TZ ID. Парольный вход отключён.
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
              {p.cardImageUrl && (
                <MediaImage
                  src={p.cardImageUrl}
                  alt={p.title}
                  className="aspect-video w-full rounded-xl object-cover"
                />
              )}
              <p className="type-ui text-accent">
                {PRODUCT_TYPE_LABELS[
                  p.productType as keyof typeof PRODUCT_TYPE_LABELS
                ] || "Услуга"}{" "}
                · Проект: {p.projectKey}
              </p>
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
                    : "При фиксированной цене доступна онлайн-оплата через банк. Сроки исполнения указаны в условиях."}
              </p>
              <div className="mt-auto pt-3">
                <Link className="button-primary" href={`/plans/${p.id}`}>
                  Условия и оформление →
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
