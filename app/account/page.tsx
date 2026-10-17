import { INVOICE_STATUSES, INVOICE_METHODS } from "@/lib/invoices";
import Link from "next/link";
import { OrderHistory } from "@/components/order-history";
import { safeReturnTo } from "@/lib/return-to";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tzIdConfigSnapshot } from "@/lib/tz-id/config";
import { SiteHeader } from "@/components/site-header";
import { LogoutButton } from "@/components/logout-button";
import { TzIdLink } from "@/components/tz-id-link";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "TRIOZ Business — аккаунт",
  robots: { index: false, follow: false, nocache: true },
};
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const user = await getCurrentUser(),
    config = tzIdConfigSnapshot();
  const orders = user
    ? await prisma.businessOrder.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const invoices = user
    ? await prisma.invoice.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const link = user
    ? await prisma.tzIdentityLink.findUnique({ where: { userId: user.id } })
    : null;
  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader basePath="/" />
      <section className="site-shell space-y-6 py-12">
        <p className="eyebrow">TRIOZ Business / Account</p>
        <h1 className="type-h2">Аккаунт Business</h1>
        {user ? (
          <>
            <div className="panel space-y-3 p-6">
              <p className="type-body">{user.name}</p>
              <p className="type-ui text-muted">{user.email}</p>
              {link ? (
                <>
                  <p className="type-ui text-muted break-all">
                    Связан с TZ ID: {link.subject}
                  </p>
                  <a
                    className="button-secondary"
                    href="https://id.trioz.ru/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Открыть центральный профиль
                  </a>
                </>
              ) : (
                <p className="type-ui text-muted">TZ ID пока не связан.</p>
              )}
              <LogoutButton />
              {returnTo !== "/account" ? (
                <a href={returnTo} className="button-primary">
                  Продолжить оформление →
                </a>
              ) : null}
            </div>
            {!link && config.configured ? <TzIdLink /> : null}
            <a
              className="button-secondary"
              href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
            >
              {user.role === "ADMIN" ? "Админ-панель" : "Мои проекты"}
            </a>
          </>
        ) : (
          <div className="panel space-y-4 p-6">
            <p className="type-body">
              Войдите через центральный TZ ID или существующий аккаунт Business.
            </p>
            {config.configured ? (
              <a
                className="button-primary"
                href={`/api/auth/tz-id/login?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Войти через TZ ID
              </a>
            ) : (
              <p className="type-ui text-muted">
                Владелец ещё не настроил подключение TZ ID.
              </p>
            )}
            <a
              className="button-secondary"
              href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            >
              Существующий вход Business
            </a>
          </div>
        )}
        {user ? <OrderHistory orders={orders} /> : null}
        {user ? (
          <section className="space-y-4">
            <h2 className="type-h3">Мои счета</h2>
            {!invoices.length ? (
              <p className="type-body text-muted">Выставленных счетов нет.</p>
            ) : (
              invoices.map((invoice) => (
                <article className="panel p-5 space-y-3" key={invoice.id}>
                  <h3 className="type-h3">{invoice.title}</h3>
                  <p className="type-ui">
                    {
                      INVOICE_METHODS[
                        invoice.method as keyof typeof INVOICE_METHODS
                      ]
                    }{" "}
                    ·{" "}
                    {
                      INVOICE_STATUSES[
                        invoice.status as keyof typeof INVOICE_STATUSES
                      ]
                    }
                  </p>
                  <p className="type-body">
                    {new Intl.NumberFormat("ru-RU", {
                      style: "currency",
                      currency: "RUB",
                    }).format(invoice.amountMinor / 100)}
                  </p>
                  <Link
                    className="button-secondary"
                    href={`/invoices/${invoice.id}`}
                  >
                    Открыть счёт
                  </Link>
                </article>
              ))
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
