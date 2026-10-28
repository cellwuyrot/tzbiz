import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { safeReturnTo } from "@/lib/return-to";
import { tzIdConfigSnapshot } from "@/lib/tz-id/config";
import { SiteHeader } from "@/components/site-header";
import { LogoutButton } from "@/components/logout-button";
import { OrderHistory } from "@/components/order-history";
import { INVOICE_METHODS, INVOICE_STATUSES } from "@/lib/invoices";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TRIOZ — личный кабинет", robots: { index: false, follow: false, nocache: true } };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; section?: string; payment?: string }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const user = await getCurrentUser();
  const config = tzIdConfigSnapshot();
  const section = ["orders", "invoices", "profile"].includes(params.section || "") ? params.section! : "orders";
  const orders = user && section === "orders" ? await prisma.businessOrder.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } }) : [];
  const invoices = user && section === "invoices" ? await prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }) : [];
  return <main className="min-h-screen bg-bg text-text"><SiteHeader basePath="/" /><section className="site-shell space-y-8 py-12">
    <div><p className="eyebrow">TRIOZ Business</p><h1 className="type-h2 mt-3">{user ? "Личный кабинет" : "Вход через TZ ID"}</h1><p className="type-body text-muted mt-3">{user ? `${user.name}, здесь ваши заказы, счета и проекты.` : "Один аккаунт для оформления заказов и работы с проектами."}</p></div>
    {!user ? <div className="panel space-y-5 p-6 max-w-xl"><h2 className="type-h3">Добро пожаловать</h2><p className="type-body text-muted">Вход для клиентов и администраторов — только через TZ ID. Права управления проверяются на сервере.</p>{config.configured ? <a className="button-primary" href={`/api/auth/tz-id/login?returnTo=${encodeURIComponent(returnTo)}`}>Войти через TZ ID</a> : <p role="status" className="type-body">Вход временно недоступен: владелец ещё не настроил TZ ID. Напишите <a className="text-accent" href="mailto:info@trioz.ru">info@trioz.ru</a>.</p>}</div> : <>
      <nav className="account-tabs" aria-label="Личный кабинет"><Link href="/subscriptions">Услуги и подписки</Link>{[["orders", "Заказы и оплата"], ["invoices", "Счета"], ["profile", "Профиль"]].map(([id, label]) => <Link key={id} aria-current={section === id ? "page" : undefined} href={`/account?section=${id}`}>{label}</Link>)}<Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"}>{user.role === "ADMIN" ? "Админ-панель" : "Мои проекты"}</Link></nav>
      {returnTo !== "/account" && <a href={returnTo} className="button-primary">Продолжить оформление →</a>}
      {params.payment && section === "orders" && <p role="status" className="panel p-5 type-body">{params.payment === "failed" ? "Оплата не завершена. Проверьте статус перед повторной попыткой." : "Вы вернулись из банка. Подтверждение может занять некоторое время — нажмите «Проверить оплату» у заказа."}</p>}
      {section === "orders" && <OrderHistory orders={orders} />}
      {section === "profile" && <section className="panel p-6 space-y-4 max-w-xl"><h2 className="type-h3">Профиль TZ ID</h2><p className="type-body">{user.name}</p><p className="type-body break-all text-muted">{user.email}</p><a href="https://id.trioz.ru/" target="_blank" rel="noopener noreferrer" className="button-secondary">Управлять профилем в TZ ID</a><div><LogoutButton /></div></section>}
      {section === "invoices" && <section className="space-y-4"><h2 className="type-h3">Мои счета</h2>{!invoices.length ? <div className="panel p-6 type-body text-muted">Выставленных счетов пока нет. Онлайн-оплата тарифов — в разделе «Заказы и оплата».</div> : invoices.map(invoice => <article className="panel p-5 space-y-3" key={invoice.id}><h3 className="type-h3">{invoice.title}</h3><p className="type-ui">{INVOICE_METHODS[invoice.method as keyof typeof INVOICE_METHODS]} · {INVOICE_STATUSES[invoice.status as keyof typeof INVOICE_STATUSES]}</p><p className="type-body">{new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(invoice.amountMinor / 100)}</p><Link className="button-secondary" href={`/invoices/${invoice.id}`}>Открыть счёт</Link></article>)}</section>}
    </>}
  </section></main>;
}
