import crypto from "node:crypto";
import { prisma } from "./db";
import { agreementDocument, privacyDocument } from "./legal-documents";
export const DOCUMENT_LABELS = {
  agreement: "Пользовательское соглашение",
  privacy: "Политика обработки персональных данных",
  offer: "Оферта на товары и услуги",
  cookies: "Политика cookie и аналитики",
  consent: "Согласие на обработку персональных данных",
} as const;
export type LegalSlug = keyof typeof DOCUMENT_LABELS;
export const LEGAL_SLUGS = Object.keys(DOCUMENT_LABELS) as LegalSlug[];
const serialize = (d: typeof agreementDocument) =>
  d.sections
    .map((s) => `# ${s.title}\n${s.paragraphs.join("\n\n")}`)
    .join("\n\n");
const templates: Record<LegalSlug, string> = {
  agreement: serialize(agreementDocument),
  privacy: serialize(privacyDocument),
  offer: `# Статус документа
Черновик. До публикации владелец указывает действительные сведения о продавце, условия договора и применимые требования закона.

# Предмет и оформление
Выбранная карточка определяет товар или услугу, проект использования, состав, цену, период и способ предоставления. Заявка не является оплатой и сама по себе не заключает договор. Продавец должен определить момент акцепта, порядок согласования и подтверждения заказа.

# Оплата и подписки
Банковский перевод выполняется по выставленному счёту. Эквайринг и рекуррентные платежи оформляются у платёжного провайдера. До первого списания пользователь должен видеть сумму, период, порядок продления и способ отмены. Вход через TZ ID не является платёжным согласием и не выдаёт доступ.

# Предоставление, отмена и возврат
Продавец должен установить конкретные сроки, порядок доставки или выдачи доступа, контакты для претензий, применимые правила отказа и возврата, включая различия товаров и услуг. Отмена счёта в Business не отменяет подписку у внешнего провайдера.

# Реквизиты и обращения
Замените этот раздел полными реквизитами продавца, адресом и контактами. Проверьте документ с профильным юристом до публикации.`,
  cookies: `# Необходимые cookie
trioz_session: защищённая HttpOnly cookie локальной сессии, до 7 дней; сессия TZ ID ограничена сроком токена и перепроверяется. trioz_csrf: защита запросов, до 1 часа. tz_business_oidc: временное состояние входа OIDC, до 10 минут. trioz_cookie_choice: необходимая cookie сохранения выбора аналитики, до 180 дней. Cookie привязаны к текущему хосту; общий вход проектов организуется через TZ ID, а не общей cookie .trioz.ru.

# Необязательная аналитика
Отключена до явного выбора «Разрешить аналитику». Включает только суммарное число просмотров публичных страниц по дню UTC и пути без параметров. Не сохраняет email, TZ ID, IP, историю пользователя или уникальные идентификаторы посетителей. Страницы админки, аккаунта и счетов исключены. Сторонние счётчики не подключены. DNT и Global Privacy Control блокируют учёт. Агрегаты автоматически удаляются через 180 дней планировщиком.

# Изменение выбора
Кнопка «Cookie» доступна на страницах сайта. При изменении опубликованных политик данных или cookie прежнее разрешение аналитики не используется: требуется новый выбор. «Только необходимые» прекращает последующий сбор. При отказе вход, заявки и оплата по ссылкам остаются доступны. Уже собранные обезличенные суммарные просмотры не связаны с конкретным посетителем и не могут быть выделены из статистики.

# Другое локальное хранение
sessionStorage временно сохраняет черновик тарифной заявки и ключ повторной отправки на 30 минут; это не аналитика. Платёжный провайдер и TZ ID работают на своих доменах по собственным политикам. Защитные серверные лимиты используют краткоживущие хешированные ключи, не аналитические профили. Укажите сведения об операторе и фактические условия обработки до публикации.`,
  consent: `# Субъект и оператор
Черновик для отдельного согласия. Укажите полное наименование, адрес и контакт оператора персональных данных до публикации.

# Цель и состав данных
Рассмотрение заявки, связь с заявителем, согласование и исполнение заказа. Данные: имя, email, телефон, компания, выбранное предложение, содержание обращения; для аккаунта — идентификатор и издатель TZ ID. Для счёта — сведения о плательщике и расчётах. Не включайте в свободный текст пароли или данные банковской карты.

# Действия, получатели и срок
Уточните перечень действий, способ обработки, привлекаемых обработчиков и основания передачи, место хранения и конкретные сроки удаления. Это согласие не включает рекламу или необязательную аналитику. Согласие на автосписания оформляется отдельно у провайдера.

# Отзыв
Укажите действительный контакт оператора, порядок отзыва, рассмотрения обращений и ограничения удаления при наличии законных оснований хранения. Согласие отмечается отдельно, без предварительного выбора.`,
};
export function defaultLegal(slug: LegalSlug) {
  return {
    slug,
    title: DOCUMENT_LABELS[slug],
    body: templates[slug],
    revision: 0,
    publishedVersion: null as string | null,
  };
}
export function legalSections(body: string) {
  const result: { title: string; paragraphs: string[] }[] = [];
  for (const block of body.split(/\n\s*\n/)) {
    const lines = block.trim().split("\n");
    if (lines[0]?.startsWith("# ")) {
      result.push({
        title: lines.shift()!.slice(2),
        paragraphs: lines.length ? [lines.join("\n")] : [],
      });
    } else if (block.trim()) {
      if (!result.length) result.push({ title: "Документ", paragraphs: [] });
      result[result.length - 1].paragraphs.push(block.trim());
    }
  }
  return result;
}
export function legalDigest(title: string, body: string) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([title, body]))
    .digest("hex");
}
export async function getLegalDocument(slug: LegalSlug, version?: string) {
  const draft = await prisma.legalPage.findUnique({ where: { slug } });
  const publication = await prisma.legalPublication.findFirst({
    where: {
      slug,
      version: version || draft?.publishedVersion || "__unpublished__",
    },
  });
  if (version && !publication) return null;
  const source = publication || draft || defaultLegal(slug);
  return {
    title: source.title,
    version: publication?.version || `draft-${draft?.revision || 0}`,
    sections: legalSections(source.body),
    published: !!publication,
    publishedAt: publication?.publishedAt.toISOString() || null,
  };
}
export async function legalState(
  db: Pick<typeof prisma, "legalPage"> = prisma,
) {
  const rows = await db.legalPage.findMany({
    select: { slug: true, publishedVersion: true },
  });
  const versions: Record<string, string> = {};
  for (const row of rows)
    if (row.publishedVersion) versions[row.slug] = row.publishedVersion;
  return { versions, ready: LEGAL_SLUGS.every((slug) => !!versions[slug]) };
}
export function versionsMatch(
  actual: Record<string, string>,
  seen: Record<string, string> | undefined,
  slugs: readonly string[],
) {
  return !!seen && slugs.every((s) => !!actual[s] && actual[s] === seen[s]);
}
