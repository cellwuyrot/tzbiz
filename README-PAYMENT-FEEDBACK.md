# Business 1.4.0 — точечное исправление обратной связи оплаты

Это НЕ полный проект. Файлы архива накладываются на корень существующего tzbiz версии 1.4.0. Не применять к другой версии без сравнения. .env, загруженные файлы, базы, зависимости и миграции отсутствуют. Для TrioZ / TZ ID изменений серверного кода не требуется.

## Что изменено
- Разрешены точные HTTPS-домены формы pay.tbank.ru и pay.tbank-online.com, проверки протокола, credentials, порта и hostname сохранены.
- Возврат `?payment=failed` показывает понятное сообщение, а не выдуманное подтверждение отсутствия списания. Возврат `?payment=return` НЕ выдаёт права сам по себе.
- В карточках виден комментарий по последнему банковскому статусу: отказ, отмена, истечение срока, неопределённый результат, авторизация, ожидание оплаты.
- Однозначный отказ Init создаёт уведомление клиенту в существующей очереди писем; обработчик кнопки больше не называет однозначный отказ «обрабатывается».
- Добавлены регрессионные тесты цены 200 RUB, VPN/Premium, отказов, сохранения уже оплаченного периода, callbacks, доменов и сообщений.
- Добавлена диагностическая команда scripts/service-access-audit.ts.

## Установка на сервер
Загрузите архив как `/root/tzbiz-payment-feedback-fix.zip`. До распаковки сохраните текущие исходники:

```bash
cd /var/www/tzbiz &&
tar -czf "/root/tzbiz-before-feedback-$(date +%Y%m%d-%H%M%S).tar.gz" \
  lib/billing lib/services app/api/subscriptions components/services tests scripts &&
unzip -o /root/tzbiz-payment-feedback-fix.zip -d /var/www/tzbiz &&
export PATH="/opt/tzbiz-node22/current/bin:$PATH" &&
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt &&
npm test &&
npm run build &&
/usr/bin/pm2 restart tzbiz --update-env &&
/usr/bin/pm2 save
```

Зависимости и миграции не менялись. Перезапускать trioz, tz-id, PostgreSQL и остальные PM2-приложения не нужно. Команды установки сами не создают банковских запросов. При тестировании или сборке с ошибкой приложение не перезапускается.

## Проверка ВАШЕЙ вручную созданной услуги, без списаний

```bash
cd /var/www/tzbiz &&
export PATH="/opt/tzbiz-node22/current/bin:$PATH" &&
export NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt &&
node node_modules/tsx/dist/cli.mjs scripts/service-access-audit.ts
```

Скрипт читает общий каталог и последние 10 локальных подписок с зафиксированной суммой 20000 копеек. Не вызывает Init/Charge/GetState, исполнение доступа, отправку SMTP. Секреты и адреса почты не печатаются. Идентификаторы подписок — служебные данные, не публикуйте вывод без необходимости.

У нужной подписки ожидаются:
- `amountMinor: 20000`;
- `frozenAccessKind: "VPN"`;
- `currentAccessKind: "VPN"`;
- `sameAccessKind: true`, `hasTzSubject: true`;
- `mappingToStandardVpn: true`.

Если `MANUAL`, одно название «Надёжное соединение» не выдаёт VPN. Менять тип услуги с уже созданными подключениями центральный код запрещает: безопаснее создать корректную новую услугу под владельцем TrioZ, не переписывать финансовые снимки старых заявок SQL-командами.

Для Premium обе привязки должны быть `PREMIUM`; `mappingToStandardVpn` закономерно false. Локальные суммы и статусы читаются из боевой БД, поэтому именно этот запуск позволяет проверить настройку на вашем сервере, которой нет в локальной копии исходников.

## Границы подтверждения
Успешный CONFIRMED от банка с верными TerminalKey, PaymentId, OrderId и Amount активирует оплаченный период и помечает доставку в центральный TrioZ. Подписанные callbacks проверяются; для известных PaymentId фоновая сверка GetState восстанавливает пропущенные уведомления. Фоновая задача и SMTP должны реально работать. Наличие сообщения `syncPending: false` до оплаты само по себе не доказывает выдачу.

Очередь писем создаётся при подтверждённом отказе/отмене/истечении срока, а не просто при закрытии вкладки. Пока банк не дал окончательного статуса, интерфейс сообщает, что результат уточняется, и не предлагает слепое повторное списание. Неопределённая SMTP-доставка требует сверки администратором, а не бесконечных повторов.

NODE_EXTRA_CA_CERTS должен быть задан и в существующей cron-задаче, а не только в окружении PM2. Не добавляйте дубли фоновых задач и не запускайте их вручную «для проверки» на боевом окружении с включёнными автосписаниями.

Реальный платёж, получение чека, банковские разрешения, фактическое подключение к VPN и доставка почты не проверялись этим архивом. Они требуют проверки вашего сервера и обычного клиентского аккаунта. Существующие права администратора не подходят как доказательство выдачи новой покупки.

## Git после проверки

```bash
cd /var/www/tzbiz &&
git status --short &&
git diff --stat
```

Подготовьте только файлы исправления:

```bash
git add lib/billing/tbank.ts lib/services/subscriptions.ts \
  lib/services/payment-feedback.ts \
  app/api/subscriptions/route.ts 'app/api/subscriptions/[id]/route.ts' \
  components/services/customer-subscriptions.tsx \
  scripts/service-access-audit.ts \
  tests/managed-subscriptions.test.ts tests/tbank.test.ts \
  tests/payment-feedback.test.ts tests/managed-payment-notify.test.ts &&
git diff --cached --stat
```

Проверьте весь подготовленный список (в нём не должно быть ранее подготовленных чужих файлов, .env, ключей, БД). Затем:

```bash
git commit -m "fix: subscription payment feedback and entitlement regression tests" &&
git push
```

Не используйте `git add .`, `git push --force`, `git reset --hard`, не удаляйте финансовые записи. Этот патч не восстанавливает уже потерянные URL и не переносит DEMO-платежи на боевой терминал.
