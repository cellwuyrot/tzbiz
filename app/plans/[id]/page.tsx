import { renameDisplayText } from "@/lib/display-labels";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCommerceSettings } from "@/lib/commerce";
import {
  SETTLEMENT_LABELS,
  PERIOD_LABELS,
  PRODUCT_TYPE_LABELS,
} from "@/lib/billing/plan";
import { SiteHeader } from "@/components/site-header";
import { OrderRequest } from "@/components/order-request";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await prisma.billingPlan.findUnique({ where: { id } });
  return {
    title:
      p?.isPublished && !p.isArchived
        ? renameDisplayText(p.title)
        : "Предложение",
    alternates: { canonical: `/plans/${id}` },
    description: p ? renameDisplayText(p.description).slice(0, 160) : undefined,
    robots: { index: true, follow: true },
  };
}
export default async function Plan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plan, user, terms] = await Promise.all([
    prisma.billingPlan.findUnique({
      where: { id },
      include: { service: true },
    }),
    getCurrentUser(),
    getCommerceSettings(),
  ]);
  if (
    !plan ||
    !plan.isPublished ||
    plan.isArchived ||
    (plan.kind === "SERVICE" && !plan.service?.isPublished)
  )
    notFound();
  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader basePath="/" />
      <section className="site-shell grid gap-8 py-12 lg:grid-cols-2">
        <article className="space-y-6">
          <Link href="/plans" className="type-ui text-accent">
            ← Все предложения
          </Link>
          <p className="eyebrow">
            {
              SETTLEMENT_LABELS[
                plan.settlementMode as keyof typeof SETTLEMENT_LABELS
              ]
            }
          </p>
          <p className="type-ui text-muted">
            {PRODUCT_TYPE_LABELS[
              plan.productType as keyof typeof PRODUCT_TYPE_LABELS
            ] || "Услуга"}
          </p>
          <h1 className="type-h2 break-words">
            {renameDisplayText(plan.title)}
          </h1>
          <p className="type-h3">
            {plan.amountMinor === null
              ? "Стоимость согласуем"
              : new Intl.NumberFormat("ru-RU", {
                  style: "currency",
                  currency: plan.currency,
                }).format(plan.amountMinor / 100)}
          </p>
          {plan.periodUnit ? (
            <p className="type-ui text-muted">
              Период: {plan.periodCount}{" "}
              {PERIOD_LABELS[plan.periodUnit as keyof typeof PERIOD_LABELS]}
            </p>
          ) : null}
          <p className="type-body whitespace-pre-wrap text-muted">
            {renameDisplayText(plan.description)}
          </p>
          <div className="panel space-y-4 p-5">
            <h2 className="type-h3">Где действует</h2>
            <p className="type-body break-words">{plan.projectKey}</p>
            <a
              className="text-accent underline break-all"
              href={plan.projectUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть проект ↗
            </a>
            <p className="type-ui text-muted">
              TZ ID идентифицирует аккаунт. Счёт и общий вход не активируют
              права в принимающем проекте. Автоматическая выдача доступа пока не
              подключена.
            </p>
          </div>
          {plan.cardImageUrl && (
            <img
              src={plan.cardImageUrl}
              alt={plan.title}
              className="aspect-video w-full rounded-xl object-cover"
            />
          )}
          {plan.features && (
            <div>
              <h2 className="type-h3">Состав и характеристики</h2>
              <p className="type-body mt-3 whitespace-pre-wrap text-muted">
                {renameDisplayText(plan.features)}
              </p>
            </div>
          )}
          {plan.fulfillmentTerms && (
            <div>
              <h2 className="type-h3">Получение и сроки</h2>
              <p className="type-body mt-3 whitespace-pre-wrap text-muted">
                {renameDisplayText(plan.fulfillmentTerms)}
              </p>
            </div>
          )}
          {plan.renewalTerms && (
            <div>
              <h2 className="type-h3">Продление</h2>
              <p className="type-body mt-3 whitespace-pre-wrap text-muted">
                {renameDisplayText(plan.renewalTerms)}
              </p>
            </div>
          )}
          <div>
            <h2 className="type-h3">Отмена и возврат</h2>
            <p className="type-body mt-3 whitespace-pre-wrap text-muted">
              {renameDisplayText(plan.cancellationTerms)}
            </p>
          </div>
          <p className="type-ui text-subtle">
            Версия {plan.revision}.{" "}
            <a href="/payment" className="text-accent">
              Порядок оформления и оплаты
            </a>
            .
          </p>
        </article>
        <aside>
          {!terms?.approved ? (
            <div className="panel p-6 type-body">
              Оформление ещё не открыто: владелец утверждает условия.{" "}
              <Link href="/#contact" className="text-accent">
                Обсудить задачу с командой
              </Link>
              .
            </div>
          ) : user ? (
            <OrderRequest planId={plan.id} revision={plan.revision} />
          ) : (
            <div className="panel space-y-5 p-6">
              <h2 className="type-h3">Сохраните заявку в кабинете</h2>
              <p className="type-body text-muted">
                Войдите, чтобы выбранное предложение и его условия сохранились в
                истории.
              </p>
              <a
                className="button-primary"
                href={`/account?returnTo=${encodeURIComponent(`/plans/${plan.id}`)}`}
              >
                Войти и продолжить
              </a>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}
