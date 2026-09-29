# TRIOZ — production audit / bugfix report

Дата проверки: 28.09.2026

## Итог

Исходный ZIP проверен на структуру, серверные маршруты, права доступа, файловые загрузки, Prisma migrations, клиентскую логику, синтаксис TypeScript/TSX и доступные runtime-smoke сценарии.

Исправлены два выявленных production/security класса проблем:

1. **Сброс пароля клиента не отзывал существующие сессии.**
   Теперь смена пароля и удаление всех активных сессий клиента выполняются внутри одной Prisma-транзакции.

2. **Prisma provider выбирался слишком мягко.**
   Раньше при отсутствии `DATABASE_URL` скрипт молча выбирал SQLite. В production это могло привести к генерации Prisma Client под SQLite при фактическом PostgreSQL runtime.
   Теперь при `NODE_ENV=production`:
   - `DATABASE_URL` обязателен;
   - разрешён только `postgres://` / `postgresql://`;
   - неправильная конфигурация завершается ошибкой до генерации/миграции.

Дополнительно:
- обновлён `next` до `15.5.26`;
- обновлены `react` / `react-dom` до `19.1.9`;
- `eslint-config-next` синхронизирован с `15.5.26`;
- добавлены `engines.node >=20.9.0` и `packageManager: npm@10.9.2`;
- добавлен безопасный `ecosystem.config.cjs` только для `tzbiz`;
- генерация временных паролей переведена с modulo-byte выбора на `crypto.randomInt`;
- добавлен regression-test для сброса пароля с отзывом сессий;
- удалён stale `tsconfig.tsbuildinfo` из поставочного архива.

## Тесты и проверки

### Выполнено успешно

| Проверка | Результат |
|---|---|
| `node --check scripts/prisma-sync.mjs` | PASS |
| `node --check scripts/seed.mjs` | PASS |
| `node --check ecosystem.config.cjs` | PASS |
| TypeScript/TSX parse diagnostics | PASS — 69 файлов, 0 parse errors |
| SQLite migrations 0001→0003 | PASS |
| Foreign keys / indexes SQLite | PASS |
| Seed content structure | PASS — 11 услуг |
| Upload validation runtime smoke | PASS — 8/8 |
| Async upload/signature smoke | PASS — 2/2 |
| Client project isolation | PASS |
| Role isolation | PASS |
| Order URL generation | PASS |
| Production Prisma guard: no `DATABASE_URL` | PASS — корректно завершается ошибкой |
| Production Prisma guard: SQLite URL | PASS — корректно завершается ошибкой |
| Production Prisma provider sync: PostgreSQL URL | PASS |

### Статический security audit

Все admin API handlers проверяют `requireApiRole("ADMIN")`.

Все state-changing admin handlers, которые реально изменяют данные, дополнительно проверяют CSRF. `POST /api/admin/leads` является намеренным `405`-endpoint без изменения данных и поэтому отдельная CSRF-проверка ему не требуется.

Файловые пути к upload выдаются только через серверно сгенерированные 40-символьные hex-имена. Публичный endpoint проверяет принадлежность файла к опубликованной услуге/публичному проекту либо права текущего клиента/admin.

### Полный npm-контур

Полностью выполнить:
- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- browser E2E

в текущем sandbox не удалось, потому что npm registry недоступен по сети (`EAI_AGAIN` при обращении к `registry.npmjs.org`). В проекте отсутствует `node_modules`, поэтому выдавать эти проверки как успешно выполненные было бы некорректно.

Это ограничение окружения, а не обнаруженная ошибка исходного кода.

## Что проверено по функциональным зонам

### Публичная часть
- динамический каталог опубликованных услуг;
- отдельные `/services/[slug]`;
- query-параметр `/?service=<slug>` и modal navigation;
- публичный portfolio только по `isPublic=true`;
- форма заявки и серверная валидация;
- SMTP notification fallback без потери заявки;
- robots/sitemap/noindex;
- controlled upload delivery.

### Админка
- role protection;
- CSRF на state-changing endpoints;
- clients CRUD;
- password reset;
- projects CRUD;
- services CRUD;
- media order/delete;
- site settings;
- leads status/delete.

### Безопасность
- bcrypt для паролей;
- httpOnly session cookie;
- CSRF token cookie/header pair;
- login rate limiting;
- role isolation;
- project isolation;
- upload extension/MIME/size checks;
- image signature check;
- same-origin check для public lead endpoint.

## Зависимости

Исходный проект содержал `next ^15.5.7` и `react ^19.1.0`.

Поставочная версия закрепляет:
- `next: 15.5.26`
- `react: 19.1.9`
- `react-dom: 19.1.9`
- `eslint-config-next: 15.5.26`

`15.5.26` выбран как актуальный backport в ветке Next 15 на дату проверки; React 19.1.9 закрывает известные более ранние RSC/Server Functions проблемы для ветки 19.1.

## Ограничения, которые остаются внешними

Нельзя проверить из ZIP:
- реальные PostgreSQL credentials;
- реальный SMTP mailbox;
- доступность внешнего `https://trioz.ru/connect`;
- reverse proxy / nginx;
- реальный PM2 daemon;
- реальный browser E2E на production server.

Перед production нужно выполнить на сервере реальный `npm install`, затем `npm run db:deploy`, `npm run build`, а после запуска — HTTP smoke-check публичной главной, `/services/<slug>`, `/api/auth/csrf`, формы заявки и входа в админку.

## Production sequence

```bash
npm install

# .env должен содержать как минимум:
# DATABASE_URL=postgresql://...
# SESSION_SECRET=...
# ADMIN_EMAIL=...
# ADMIN_PASSWORD=...
# NEXT_PUBLIC_APP_URL=https://...
# Основной путь: почтовый HTTP-сервис TrioZ
# SMTP_SERVICE_URL=https://...
# SMTP_SERVICE_KEY=sm_...
# SMTP_FROM=info@trioz.ru
# LEADS_EMAIL_TO=info@trioz.ru
#
# Резервный путь: прямой SMTP
# SMTP_HOST=...
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=info@trioz.ru
# SMTP_PASSWORD=...

npm run db:deploy
npm run build

pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

Для удаления старого процесса:

```bash
pm2 delete tzbiz
pm2 save
```

Для удаления только его логов:

```bash
rm -f ~/.pm2/logs/tzbiz-out.log ~/.pm2/logs/tzbiz-error.log
```

Не применять `pm2 delete all`, `pm2 kill` или `pm2 flush`.
