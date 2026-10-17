import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  INVOICE_METHODS,
  INVOICE_STATUSES,
  validPaymentUrl,
  type SellerSnapshot,
} from "@/lib/invoices";
import { PrintInvoice } from "@/components/print-invoice";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Счёт на оплату",
  robots: { index: false, follow: false, nocache: true },
};
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    user = await getCurrentUser();
  if (!user)
    redirect(`/login?returnTo=${encodeURIComponent(`/invoices/${id}`)}`);
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || (user.role !== "ADMIN" && invoice.userId !== user.id))
    notFound();
  const seller: SellerSnapshot = JSON.parse(invoice.sellerSnapshot),
    expired = invoice.dueDate < new Date();
  return (
    <main className="site-shell py-10 space-y-6">
      <div className="admin-toolbar no-print">
        <a
          href={user.role === "ADMIN" ? "/admin" : "/account"}
          className="button-secondary"
        >
          Назад
        </a>
        <PrintInvoice />
      </div>
      <article className="panel p-6 sm:p-10 max-w-4xl mx-auto space-y-6 invoice-sheet">
        <div>
          <p className="type-ui text-muted">
            {INVOICE_STATUSES[invoice.status as keyof typeof INVOICE_STATUSES]}
          </p>
          <h1 className="type-h3 mt-2">Счёт № {invoice.number}</h1>
          <p className="type-ui mt-2">
            от{" "}
            {invoice.createdAt.toLocaleDateString("ru-RU", {
              timeZone: "Europe/Moscow",
            })}{" "}
            · Оплатить до {invoice.dueDate.toISOString().slice(0, 10)}
          </p>
        </div>
        <section className="space-y-2">
          <h2 className="type-h3">Получатель</h2>
          <p className="type-body">{seller.sellerName}</p>
          <p className="type-ui whitespace-pre-wrap break-words">
            {seller.sellerDetails}
          </p>
          <p className="type-ui">
            ИНН {seller.sellerInn || "—"}
            {seller.sellerKpp ? ` · КПП ${seller.sellerKpp}` : ""}
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="type-h3">Плательщик</h2>
          <p className="type-body">{invoice.buyerName}</p>
          {invoice.buyerInn && (
            <p className="type-ui">ИНН {invoice.buyerInn}</p>
          )}
          <p className="type-ui whitespace-pre-wrap break-words">
            {invoice.buyerDetails}
          </p>
        </section>
        <section className="border-y border-border py-5 space-y-3">
          <h2 className="type-h3 break-words">{invoice.title}</h2>
          <p className="type-h3">
            {new Intl.NumberFormat("ru-RU", {
              style: "currency",
              currency: "RUB",
            }).format(invoice.amountMinor / 100)}
          </p>
          <p className="type-ui">{invoice.taxNote}</p>
          <p className="type-ui">
            {INVOICE_METHODS[invoice.method as keyof typeof INVOICE_METHODS]}
          </p>
        </section>
        {invoice.method === "BANK_TRANSFER" ? (
          <dl className="admin-facts type-ui">
            <div>
              <dt>Банк</dt>
              <dd>{seller.bankName}</dd>
            </div>
            <div>
              <dt>БИК</dt>
              <dd>{seller.bankBik}</dd>
            </div>
            <div>
              <dt>Расчётный счёт</dt>
              <dd>{seller.bankAccount}</dd>
            </div>
            <div>
              <dt>Корреспондентский счёт</dt>
              <dd>{seller.bankCorrespondentAccount}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt>Назначение платежа</dt>
              <dd>
                Оплата по счёту № {invoice.number} от{" "}
                {invoice.createdAt.toLocaleDateString("ru-RU", {
                  timeZone: "Europe/Moscow",
                })}
                . {invoice.taxNote}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="type-body">
            Оплата и ввод платёжных данных выполняются на странице провайдера.
          </p>
        )}
        {invoice.method === "RECURRING" && (
          <section className="space-y-3">
            <h2 className="type-h3">Условия подписки</h2>
            <p className="type-ui">Период: {invoice.periodMonths} мес.</p>
            <p className="type-body whitespace-pre-wrap break-words">
              {invoice.renewalTerms}
            </p>
            <p className="type-ui text-muted">
              Согласие на регулярные списания и управление подпиской оформляются
              у провайдера. Этот счёт не активирует подписку TZ ID.
            </p>
          </section>
        )}
        {invoice.status === "ISSUED" &&
          invoice.method !== "BANK_TRANSFER" &&
          (expired ? (
            <p className="type-ui text-danger">
              Срок счёта истёк. Запросите новый счёт.
            </p>
          ) : validPaymentUrl(invoice.paymentUrl) ? (
            <a
              className="button-primary no-print"
              href={invoice.paymentUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              {invoice.method === "RECURRING"
                ? "Оформить у провайдера"
                : "Перейти к оплате"}
            </a>
          ) : (
            <p className="type-ui text-danger">
              Платёжная ссылка недоступна. Обратитесь к продавцу.
            </p>
          ))}
        {invoice.status === "ISSUED" &&
          invoice.method === "BANK_TRANSFER" &&
          expired && (
            <p className="type-ui text-danger">
              Срок счёта истёк. Перед переводом запросите подтверждение
              продавца.
            </p>
          )}
        <p className="type-ui break-words">
          Контакт продавца: {seller.supportEmail}
        </p>
      </article>
    </main>
  );
}
