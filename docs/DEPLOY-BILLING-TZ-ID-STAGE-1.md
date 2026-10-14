# Развёртывание этапа 1 — только /var/www/tzbiz

Архив не отправлен в GitHub автоматически. Сначала перенесите изменения в репозиторий, проверьте diff, закоммитьте и отправьте в main. Patch основан на `5e7cbf54af6db6052cdbb92dc152b677b223b862`; если HEAD другой, проверьте совместимость. Не распаковывайте исходники поверх production `.env`, uploads или баз.

## 1. Резервная копия и контроль

Выполнять на сервере владельцем проекта. Сначала проверить `git status --short`, сохранить локальные изменения отдельно и `.env`/uploads; не делать `git reset --hard`. Не печатать `.env`/PM2 env/секреты. Копии держать вне web-root, доступ 0700/0600.

```bash
cd /var/www/tzbiz && git status --short
install -d -m 700 /root/tzbiz-backups
umask 077
cp .env "/root/tzbiz-backups/env-$(date +%Y%m%d-%H%M%S)"
runuser -u postgres -- pg_dump -p 5432 -Fc -d tzbiz_business > "/root/tzbiz-backups/db-$(date +%Y%m%d-%H%M%S).dump"
```

Если uploads есть, сохранить его отдельно. Не продолжать при ошибке pg_dump. Проверить резервную копию/восстановление на отдельной БД, никогда не тестировать restore поверх production. Код ожидает отдельную `tzbiz_business`; другие БД не трогать.

## 2. Обновление после публикации в GitHub

Применяет production-миграцию только по текущему проверенному DATABASE_URL Business. Перед этим убедиться, что URL указывает именно на `tzbiz_business` и PM2 не переопределяет его другим адресом. `env -u DATABASE_URL` очищает только переменную запуска команды, не конфигурацию PM2. Не применять новый seed — существующие данные сохраняются.

```bash
cd /var/www/tzbiz && git pull --ff-only origin main && npm ci && env -u DATABASE_URL NODE_ENV=production npm run db:deploy && env -u DATABASE_URL NODE_ENV=production npm run db:generate && npm run lint && npm run typecheck && npm test && env -u DATABASE_URL NODE_ENV=production npm run build && pm2 restart tzbiz --update-env
```

`&&` прекращает цепочку при первой ошибке. Уже применённая миграция не откатывается автоматически при неудачной сборке. Не запускать pm2 restart all/update, не перезапускать PostgreSQL/Nginx/Docker, не обновлять глобальный Node. Не запускать `db:setup`, `migrate reset`, `db push`, `npm audit fix --force` на production. Изменения Prisma Client/сборка в рабочем каталоге могут влиять на работающий процесс: выполнять в согласованное окно; для безостановочного релиза нужен отдельный release-каталог, согласованный заранее.

## 3. Работа каталога без TZ ID

Новые TZ_ID_* оставить пустыми — старые login/admin/проекты/заявки работают, каталог управляется отдельно, платежи выключены. Войти в существующую админку → «Тарифы и подписки». Создать черновики, согласовать цены/условия и только потом публиковать. Premium/VPN не выдаёт доступ и не списывает деньги.

## 4. Настройка существующего TZ ID (опционально)

Основной проект не менялся. Его владелец регистрирует Business в имеющемся управлении клиентами TZ ID, не создавая новый протокол:
- confidential web client; Authorization Code, PKCE S256; `client_secret_basic`;
- redirect URI строго `https://business.trioz.ru/api/auth/tz-id/callback`;
- scopes только `openid profile email`; ID token RS256;
- проверить issuer/discovery/JWKS/userinfo/introspection по имеющейся конфигурации.

Передать выданные client ID/secret безопасно, не через Git/chat. В `/var/www/tzbiz/.env` добавить реальные значения:

```dotenv
NEXT_PUBLIC_APP_URL=https://business.trioz.ru
TZ_ID_ISSUER=https://id.trioz.ru
TZ_ID_CLIENT_ID=
TZ_ID_CLIENT_SECRET=
TZ_ID_TOKEN_KEY=
```

TOKEN_KEY — 32 случайных байта в стандартном base64, постоянный отдельный ключ; не путать с SESSION_SECRET или секретами основного проекта. Его можно создать и добавить без вывода в терминал **только при отсутствии существующей переменной**:

```bash
cd /var/www/tzbiz && node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const s = fs.readFileSync('.env', 'utf8');
if (/^\s*(?:export\s+)?TZ_ID_TOKEN_KEY\s*=/m.test(s)) {
  console.log('Переменная уже есть: ключ не заменён. Заполните её безопасно, если она пустая.');
  process.exit(0);
}
fs.appendFileSync('.env', '\nTZ_ID_TOKEN_KEY="' + crypto.randomBytes(32).toString('base64') + '"\n');
fs.chmodSync('.env', 0o600);
console.log('Ключ добавлен без вывода значения.');
NODE
```

Не перегенерировать ключ при каждом релизе: старые зашифрованные токены станут недоступны. Сделать защищённую резервную копию. Значения PM2/ecosystem могут перекрывать `.env`; не выводить `pm2 env` публично. После изменения NEXT_PUBLIC_APP_URL требуется сборка; после серверных TZ-настроек — адресный restart tzbiz. Админка → «Интеграции» показывает только наличие конфигурации.

## 5. Приёмочная проверка

Проверить локальный парольный вход ADMIN/CLIENT, роли, существующий проект/заявку; создание/редактирование/архив тарифа; `/plans`, `/agreement`, `/privacy`, мобильную ширину 320px; новую версию обязательных согласий; две независимые почтовые попытки. Нельзя считать принятие SMTP доказательством доставки — проверить оба ящика.

После настройки TZ ID отдельно проверить реальный HTTPS-вход, неверный/replay state, существующий email без автосвязывания, явное связывание с паролем, отзыв и истечение TZ-сессии. В этом этапе TZ-сессия до 5 минут, без refresh; повторный вход через центральный SSO — ожидаемое поведение. Парольные Business-сессии не отзываются центральным logout автоматически.

Платежей/автосписаний не тестировать — они не реализованы. Следующий этап начинается после согласования банковской и выдающей доступ интеграции. Не создавать API-ключ, не имеющий реального серверного контракта.
