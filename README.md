# TRIOZ — лендинг, услуги, проекты и скрытая админка

Публичный лендинг TRIOZ на Next.js App Router. Услуги и настройки первого экрана хранятся в Prisma/БД и редактируются через скрытую админку. Реализованные проекты выводятся в публичный слайдер и настраиваются из той же админки.

## Стек

- Next.js 15 App Router + React 19 + TypeScript
- Tailwind CSS 3
- Prisma 6; локально SQLite, для production также PostgreSQL
- Zod для серверной валидации
- Nodemailer для SMTP-уведомлений о заявках на `info@trioz.ru`
- bcryptjs для паролей
- `next/font`: только Unbounded для заголовков и Manrope для основного текста
- собственные httpOnly-сессии, CSRF-токены и серверная проверка ролей

## Структура

```text
app/
  page.tsx                         публичный лендинг
  login/                           вход клиента, без публичной ссылки
  enter/                           скрытая точка входа администратора
  admin/                           защищённая админка
  dashboard/                       кабинет клиента
  api/
    auth/                          login/logout/csrf
    admin/                         CRUD клиентов, проектов, заявок, услуг и настроек
    projects/[id]/                 защищённая выдача проекта клиенту
    uploads/[file]/                контролируемая выдача загруженных файлов
components/
  service-catalog.tsx              список услуг + URL-состояние модалки
  service-modal.tsx                доступная полная карточка услуги
  portfolio-slider.tsx             публичный слайдер проектов
  lead-form.tsx                     публичная форма заявки
  lead-admin-table.tsx              таблица заявок в админке
  breadcrumbs.tsx                   хлебные крошки
  admin-console.tsx                услуги, проекты, заявки, клиенты, настройки сайта
lib/
  service-content.ts               чтение услуг из БД и декодирование списков
  site-settings.ts                 чтение настроек сайта из БД
  uploads.ts                       MIME/расширение/размер и файловое хранилище
  validation.ts                    Zod-схемы
  mailer.ts                         SMTP-уведомления о новых заявках
  lead-status.ts                    статусы заявок
prisma/
  schema*.prisma                   SQLite/PostgreSQL схемы
  migrations-*/                    миграции по провайдеру
  seed-content.json                11 стартовых услуг + стартовые настройки
  0003_leads                       заявки клиентов и статусы
scripts/
  prisma-sync.mjs                  выбор schema/migrations по DATABASE_URL
  seed.mjs                         идемпотентный seed администратора и контента
tests/                             unit/security/content/upload tests
uploads/                            runtime-хранилище, вне исходников и public
```

## Переменные окружения

Создайте `.env` из `.env.example`:

```env
DATABASE_URL="file:../data/dev.db"
SESSION_SECRET="replace-with-a-random-32-byte-secret"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="replace-with-a-strong-password-of-at-least-10-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Почта для уведомлений о заявках
SMTP_HOST="smtp.example.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="info@trioz.ru"
SMTP_PASS="replace-with-mailbox-password"
EMAIL_FROM="info@trioz.ru"
LEADS_EMAIL_TO="info@trioz.ru"
```

`ADMIN_PASSWORD` должен содержать минимум 10 символов. `SESSION_SECRET` должен быть длинным случайным секретом; в production используйте отдельный секрет.

### PostgreSQL

Заменяется только `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/trioz?schema=public"
```

Перед Prisma-командами `scripts/prisma-sync.mjs` выбирает `schema.postgresql.prisma` и `migrations-postgresql`.

## Установка и запуск

```bash
npm install
npm run db:setup
npm run dev
```

`db:setup` выполняет синхронизацию Prisma, генерацию клиента, миграции и seed. Seed создаёт администратора, настройки сайта и все 11 существующих услуг, если таких записей ещё нет.

Production:

```bash
npm install
# задайте .env с DATABASE_URL, SESSION_SECRET и SMTP/ADMIN_* секретами
npm run db:deploy
npm run build
pm2 start ecosystem.config.cjs --update-env
pm2 save
```

Для production `DATABASE_URL` обязателен уже на этапе `db:deploy`/`build`; проект использует PostgreSQL. Конфигурация `ecosystem.config.cjs` запускает только приложение с именем `tzbiz` в одном fork-процессе и не содержит секретов.

### PM2: удалить только старый `tzbiz`

Проверить список перед удалением:

```bash
pm2 ls
```

Удалить только процесс `tzbiz` и сохранить новое состояние PM2:

```bash
pm2 delete tzbiz
pm2 save
```

Чтобы дополнительно удалить только его старые логи, не затрагивая остальные приложения:

```bash
rm -f ~/.pm2/logs/tzbiz-out.log ~/.pm2/logs/tzbiz-error.log
```

Не используйте `pm2 delete all`, `pm2 kill` или `pm2 flush`: они затрагивают другие процессы/логи.

## Prisma и миграции

Схема выбирается автоматически по `DATABASE_URL`:

```bash
npm run db:generate   # sync schema + prisma generate
npm run db:migrate    # sync schema + prisma migrate dev
npm run db:deploy     # sync schema + prisma migrate deploy
npm run db:studio     # sync schema + prisma studio
```

Добавлены миграции `0002_content` с контентом и `0003_leads` с заявками клиентов. В production применяется только выбранный provider через `scripts/prisma-sync.mjs`.

Сущности контента и заявок:

- `Service`: `id`, `slug`, `title`, `shortDescription`, `fullDescription`, `includes`, `stages`, `sortOrder`, `isPublished`, timestamps;
- `ServiceMedia`: `id`, `serviceId`, `type`, `path`, `sortOrder`;
- `SiteSettings`: `id`, `tagline`, `heroTitle`, `heroSubtitle`, `contacts`, `updatedAt`;
- `LeadRequest`: контактные данные, выбранная услуга, комментарий, статус, согласие на обработку данных и timestamps.

`includes` и `stages` хранятся как JSON-строки, чтобы одна и та же модель оставалась совместимой со SQLite и PostgreSQL.

## Seed

```bash
npm run db:seed
```

Стартовые данные вынесены в `prisma/seed-content.json`. Seed идемпотентен: существующие услуги и настройки не перезаписываются, поэтому изменения через админку сохраняются при повторном запуске. Пароль администратора берётся только из `ADMIN_PASSWORD` и сохраняется как bcrypt-хеш.

## Контент и админка

Публичная часть не содержит список из 11 услуг и не хранит девиз/первый экран в компонентном коде. Лендинг читает опубликованные `Service` и `SiteSettings` из БД.

Админка доступна напрямую по `/enter`; публичных ссылок на неё нет. `/enter` и `/admin` помечены `noindex`, robots disallow и получают `X-Robots-Tag: noindex, nofollow, noarchive`. Это только мера скрытия от индексации: каждый защищённый page/route handler отдельно проверяет серверную сессию и роль.

В `/admin` доступны:

- **Услуги** — создание, редактирование, slug, описания, состав, этапы, порядок, публикация, загрузка нескольких изображений/видео, порядок и удаление медиа;
- **Настройки сайта** — девиз, заголовок первого экрана, подзаголовок и контакты;
- **Проекты** — существующий CRUD, превью, URL, клиент, статус и `isPublic`; опубликованные проекты попадают в публичный слайдер;
- **Заявки клиентов** — табличный список с именем, email, телефоном, компанией, услугой, особенностями/комментариями, датой и статусом; заявку можно перевести в `Новая / В работе / Завершена` или удалить.
- **Клиенты** — существующий CRUD и сброс временного пароля; список аккаунтов также отображается таблицей.

## Услуги на лендинге

Карточка услуги открывается по клику или прямой ссылке `/?service=<slug>`. URL синхронизируется через History API и поддерживает прямое открытие.

Полная карточка содержит:

- заголовок и развёрнутое описание;
- состав услуги;
- нумерованные этапы;
- изображения и видео;
- кнопку заказа `https://trioz.ru/connect?service=<slug>`.

Модалка имеет `role="dialog"`, `aria-modal`, focus trap, закрытие по Esc и клику по подложке, возврат фокуса на исходную карточку и блокировку скролла body. Стрелки влево/вправо переключают медиаматериалы. Видео не запускаются автоматически и используют `preload="metadata"`.

## Заявки и email

На лендинге есть форма «Давайте обсудим ваш проект» с обязательными именем, email, телефоном, услугой, комментарием и согласием на обработку данных. Публичный endpoint проверяет Zod-схему, выбранную опубликованную услугу, same-origin, honeypot и rate limit (до 4 заявок с одного IP за 15 минут в пределах инстанса).

Новая заявка сначала сохраняется в БД, затем отправляется SMTP-сообщением на `LEADS_EMAIL_TO` (по умолчанию `info@trioz.ru`); `from` по умолчанию `info@trioz.ru`, `replyTo` — email клиента. Если SMTP недоступен, заявка не теряется: она остаётся в админ-панели, ошибка уведомления пишется в server log. Для production SMTP-учётные данные должны принадлежать ящику `info@trioz.ru` или разрешённой для отправки учётной записи.

## SEO, поиск и навигация

Добавлены metadata/canonical/Open Graph/Twitter metadata, `robots.txt` с sitemap, `sitemap.xml`, JSON-LD для Organization/WebSite и для отдельных услуг, отдельные индексируемые страницы `/services/<slug>`, `404`, визуальные хлебные крошки и noindex/X-Robots-Tag для `/enter` и `/admin`. Публичные `/services/<slug>` дают поисковику устойчивые URL для содержания услуг, а карточка из модального окна содержит ссылку на эту страницу.

## Проекты

Публичный блок «Реализованные проекты» — горизонтальный слайдер. На него попадают только `Project.isPublic = true`. Изображение является ссылкой на `projectUrl`; кнопки и клавиши ←/→ переключают слайды. Проекты редактируются в админке и используют уже существующую модель `Project`, поэтому изоляция клиентских проектов не меняется.

## Загрузка медиа

Файлы сохраняются в корневом runtime-каталоге `uploads/`, который не является исходником и не раздаётся статикой. Файл доступен через `/api/uploads/<generated-name>`.

Разрешены:

- изображения: `image/png`, `image/jpeg`, `image/webp`, до 5 МБ;
- видео: `video/mp4`, `video/webm`, до 50 МБ.

Сервер проверяет MIME, расширение и размер; для изображений дополнительно проверяется сигнатура. Имя генерируется сервером из случайных байт, пользовательский путь не принимается. При удалении медиа из админки файл удаляется с диска.

## Типографика и тема

Базовая палитра задаётся только CSS-токенами:

- фон `#15171A`;
- панели `#1C1F23` и `#23272C`;
- бирюзовый акцент существующего направления;
- белый и светло-серый текст с контрастной иерархией.

Unbounded используется только для заголовков/брендовой маркировки, Manrope — для основного текста и UI. Шкала `h1/h2/h3/lead/body/ui` находится в одном месте (`app/globals.css`), нижняя граница — 16px, основной текст — 17px.

Системные анимации и переходы упрощаются при `prefers-reduced-motion: reduce`. Базовая разметка рассчитана от 320px.

## Тесты и проверки

```bash
npm run lint
npm run typecheck
npm test
```

Покрыты как минимум:

- серверный отказ CLIENT на admin API route;
- изоляция проектов между двумя клиентами;
- проверка политики ролей;
- формирование ссылки заказа из slug;
- чтение опубликованных услуг из БД;
- чтение девиза из `SiteSettings`;
- создание заявки с проверкой опубликованной услуги и email-уведомлением;
- отклонение недопустимого MIME;
- отклонение несоответствия MIME/расширения;
- отклонение изображения > 5 МБ;
- отклонение видео > 50 МБ;
- пароль/проверка bcrypt.

## Что запускалось в текущем sandbox

Установить npm-зависимости не удалось: `npm install --offline` завершился `ENOTCACHED`, а обычный `npm install --prefer-offline` не завершился в отведённое выполнение. Поэтому полноценные `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` и браузерный ручной прогон здесь не выполнены.

При этом были выполнены независимые проверки, не требующие npm-зависимостей:

```bash
node --check scripts/prisma-sync.mjs
node --check scripts/seed.mjs
```

Оба скрипта прошли синтаксическую проверку. Все 63 файла `.ts/.tsx` прошли TypeScript parse diagnostics без синтаксических ошибок. Миграция `0003_leads` отдельно применена к in-memory SQLite через стандартный модуль Python и создала таблицу `LeadRequest` и ожидаемые индексы.

## ZIP

Финальный архив для передачи исключает `node_modules`, `.git`, `.next`, локальную БД и runtime-загрузки. Перед запуском на реальном окружении выполните `npm install`, `npm run db:setup`, затем линт, typecheck, тесты и build.

## Фирменный знак

Исходный векторный знак TRIOZ сохранён в `public/trioz-logo-source.svg`, адаптированная версия — в `public/trioz-logo.svg`. В шапке сайта используется тот же исходный контур как inline SVG: основной градиент собран из токенов палитры проекта, а при наведении добавляется мягкое бирюзовое свечение и усиление перелива; при `prefers-reduced-motion` переходы отключаются.

## Заявки и почта

Форма на лендинге сохраняет заявку в `LeadRequest` и отправляет уведомление через SMTP на `LEADS_EMAIL_TO` (по умолчанию `info@trioz.ru`). Для production SMTP-подключение должно быть настроено с реквизитами ящика `info@trioz.ru` либо учётной записи, которой разрешена отправка от его имени. Если SMTP временно недоступен, заявка не удаляется и остаётся доступной в админ-панели.

Администратор видит заявки в разделе «Заявки», а в разделе «Клиенты» дополнительно видны данные последней заявки, сопоставленной по email: телефон, компания, выбранная услуга и комментарий.
