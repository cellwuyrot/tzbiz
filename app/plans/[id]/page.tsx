import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getCommerceSettings } from "@/lib/commerce";
import { SETTLEMENT_LABELS, PERIOD_LABELS } from "@/lib/billing/plan";
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
    title: p?.isPublished && !p.isArchived ? p.title : "Предложение",
    alternates: { canonical: `/plans/${id}` },
    description: p?.description.slice(0, 160),
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
          <h1 className="type-h2 break-words">{plan.title}</h1>
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
            {plan.description}
          </p>
          {plan.renewalTerms && (
            <div>
              <h2 className="type-h3">Продление</h2>
              <p className="type-body mt-3 whitespace-pre-wrap text-muted">
                {plan.renewalTerms}
              </p>
            </div>
          )}
          <div>
            <h2 className="type-h3">Отмена и возврат</h2>
            <p className="type-body mt-3 whitespace-pre-wrap text-muted">
              {plan.cancellationTerms}
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
