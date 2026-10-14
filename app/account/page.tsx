import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tzIdConfigSnapshot } from "@/lib/tz-id/config";
import { SiteHeader } from "@/components/site-header";
import { LogoutButton } from "@/components/logout-button";
import { TzIdLink } from "@/components/tz-id-link";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TRIOZ Business — аккаунт", robots: { index: false, follow: false, nocache: true } };
export default async function AccountPage() {
  const user = await getCurrentUser(), config = tzIdConfigSnapshot();
  const link = user ? await prisma.tzIdentityLink.findUnique({ where: { userId: user.id } }) : null;
  return <main className="min-h-screen bg-bg text-text"><SiteHeader basePath="/" /><section className="site-shell space-y-6 py-12"><p className="eyebrow">TRIOZ Business / Account</p><h1 className="type-h2">Аккаунт Business</h1>
    {user ? <><div className="panel space-y-3 p-6"><p className="type-body">{user.name}</p><p className="type-ui text-muted">{user.email}</p>{link ? <><p className="type-ui text-muted break-all">Связан с TZ ID: {link.subject}</p><a className="button-secondary" href="https://id.trioz.ru/" target="_blank" rel="noopener noreferrer">Открыть центральный профиль</a></> : <p className="type-ui text-muted">TZ ID пока не связан.</p>}<LogoutButton /></div>{!link && config.configured ? <TzIdLink /> : null}<a className="button-secondary" href={user.role === "ADMIN" ? "/admin" : "/dashboard"}>Открыть существующий кабинет</a></> : <div className="panel space-y-4 p-6"><p className="type-body">Войдите через центральный TZ ID или существующий аккаунт Business.</p>{config.configured ? <a className="button-primary" href="/api/auth/tz-id/login">Войти через TZ ID</a> : <p className="type-ui text-muted">Владелец ещё не настроил подключение TZ ID.</p>}<a className="button-secondary" href="/login">Существующий вход Business</a></div>}
    <div className="panel p-6 type-body text-muted">Покупки и списания пока не включены. Центральный профиль остаётся в TZ ID; Business хранит локальный аккаунт и его связь с TZ ID. <a className="text-accent" href="/plans">Посмотреть тарифы</a>.</div>
  </section></main>;
}
