import Link from "next/link";
import type { Metadata } from "next";
import { getCommerceSettings } from "@/lib/commerce";
import { SiteHeader } from "@/components/site-header";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Оформление и оплата услуг",
  description:
    "Порядок согласования услуг TRIOZ: без предоплаты, с предоплатой и подписки продуктов TrioZ.",
  alternates: { canonical: "/payment" },
};
export default async function Payment() {
  const s = await getCommerceSettings();
  return (
    <main className="min-h-screen bg-bg text-text">
      <SiteHeader basePath="/" />
      <section className="site-shell py-12">
        <div className="max-w-3xl space-y-7">
          <p className="eyebrow">Условия сотрудничества</p>
          <h1 className="type-h2">Как оформить и оплатить услугу</h1>
          <p className="type-lead text-muted">
            Сначала — понятные условия. Затем — согласование и оплата выбранным
            способом.
          </p>
          {!s?.approved && (
            <p className="panel p-5 type-body">
              Коммерческие условия ещё не утверждены. Онлайн-оплата и
              автоматические списания не подключены. Не переводите деньги на
              основании одной заявки.
            </p>
          )}
          <div className="panel space-y-6 p-6">
            <div>
              <h2 className="type-h3">Без предоплаты</h2>
              <p className="mt-3 type-body text-muted">
                Вы отправляете заявку. Команда согласует объём, сроки, стоимость
                и момент расчёта. Отсутствие предоплаты не означает, что услуга
                бесплатная.
              </p>
            </div>
            <div>
              <h2 className="type-h3">С предоплатой</h2>
              <p className="mt-3 type-body text-muted">
                После заявки команда согласует условия и порядок выставления
                счёта. Отправка заявки не подтверждает оплату. Для банковского
                перевода клиент получает счёт с реквизитами. При оплате картой
                используется отдельная ссылка, выставленная продавцом на
                странице платёжного провайдера.
              </p>
            </div>
            <div>
              <h2 className="type-h3">
                Подписки Premium и «Надёжное соединение»
              </h2>
              <p className="mt-3 type-body text-muted">
                Подписка действует в проекте, указанном в карточке. TZ ID —
                способ входа и идентификации, а не платёжная система. Пока API
                выдачи прав принимающего проекта не подключён, заявка или
                отметка оплаты в Business не активирует там доступ. Если
                продавец выставил счёт со ссылкой на подписку, согласие на
                регулярные списания, продление и отмена оформляются отдельно у
                платёжного провайдера.
              </p>
            </div>
          </div>
          {s?.approved && (
            <>
              <section className="space-y-3">
                <h2 className="type-h3">Продавец</h2>
                <p className="type-body">{s.sellerName}</p>
                <p className="type-body text-muted whitespace-pre-wrap">
                  {s.sellerDetails}
                </p>
              </section>
              {[
                ["Порядок оплаты", s.paymentInstructions],
                ["Предоставление услуг", s.fulfillmentTerms],
                ["Отмена и возврат", s.refundTerms],
              ].map(([h, t]) => (
                <section key={h} className="space-y-3">
                  <h2 className="type-h3">{h}</h2>
                  <p className="type-body text-muted whitespace-pre-wrap">
                    {t}
                  </p>
                </section>
              ))}
            </>
          )}
          <p className="type-body">
            Вопросы:{" "}
            <a
              className="text-accent"
              href={`mailto:${s?.supportEmail || "info@trioz.ru"}`}
            >
              {s?.supportEmail || "info@trioz.ru"}
            </a>
          </p>
          <div className="flex flex-wrap gap-5 type-ui">
            <a href="/agreement" className="text-accent">
              Соглашение
            </a>
            <a href="/privacy" className="text-accent">
              Политика данных
            </a>
            <Link href="/documents/offer" className="text-accent">
              Оферта
            </Link>
            <Link href="/documents" className="text-accent">
              Все документы
            </Link>
            <Link href="/plans" className="button-primary">
              Выбрать предложение
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
