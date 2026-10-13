# Реальные проверки этой доработки

Проверки выполнялись в изолированной копии архива, Node 24 / npm, с зависимостями из неизменённого package-lock.json. Реальные БД/почтовые аккаунты не использовались.

| Проверка | Статус | Что проверено / ограничения |
|---|---|---|
| npm ci --no-audit --no-fund | PASS | 455 пакетов; были предупреждения deprecated; lockfile не изменялся |
| Исходный npm test до изменений | PASS | 7 файлов, 17 тестов |
| npm run lint, окончательный | PASS | Исправлен Link в новом документе; generated next-env.d.ts исключён из lint, проверки исходников не отключены |
| npm run typecheck | PASS | После Prisma generate, noEmit |
| npm test, окончательный | PASS | 11 файлов, 52 теста; исходные проверки сохранены, leads fixture обновлён для обязательного agreementAccepted |
| npm run build, окончательный | PASS, exit 0 | Production Next.js build с тестовым PostgreSQL URL и Business origin; это не проверка соединения с production/PostgreSQL |
| SQLite 0001 → 0004, Python sqlite3 | PASS | Старая заявка сохранена, новые поля NULL, foreign_key_check без нарушений |
| Prisma migrate deploy на новой тестовой SQLite | PASS | Применены 4 миграции, никакой production-базы |
| Prisma validate SQLite / PostgreSQL | PASS / PASS | Обе схемы валидны |
| SQLite migrate diff БД → schema | PASS | No difference detected, exit 0 |
| PostgreSQL модельный migrate diff | PASS | Только 3 ожидаемых добавления; SQL соответствует 0004 по смыслу |
| Реальное применение миграции к PostgreSQL | НЕ ПРОВЕДЕНО | PostgreSQL server в окружении отсутствует; нужны staging и резервная копия перед production |
| Локальный HTTP/browser/SQLite smoke | PASS | 30 проверок на синтетических данных, обязательность каждого checkbox, документы без сессии, canonical/robots/sitemap, новая вкладка без потери данных, реальная запись при отключённом SMTP, вход/роли/изоляция/CSRF |
| Мобильные страницы 320px | PASS | Нет горизонтального overflow, визуально проверен screenshot политики, скорректирован размер длинного h1 |
| Успех обоих писем, сбой каждого, отказ SMTP, экранирование | PASS (моки) | Unit-тесты mailer/route; реальное письмо внешнему адресату не отправлялось |
| Реальные SMTP sender / доставка / SPF / DKIM / DMARC | НЕ ПРОВЕДЕНО | Нет согласованной конфигурации и тестовых адресатов |
| npm audit --json | FAIL, exit 1 | 19 отмеченных уязвимых пакетов: 2 critical, 13 high, 4 moderate; includes dev/transitive, не доказательство эксплуатации |
| Production migration / deploy / PM2 / Nginx | НЕ ВЫПОЛНЯЛОСЬ | Требует отдельного согласования |
| Подписки/платежи основной платформы | ЗАБЛОКИРОВАНО | Нет исходников/API/провайдера/сценария |

## Сценарии локального smoke
- `/agreement` и `/privacy` отдают 200 без cookie; canonical Business; robots index; 320px без overflow.
- Форма невалидна без согласий и с любым одним из двух; валидна с двумя; документ открывается в отдельной вкладке, значения остаются.
- Реальный POST формы при пустой SMTP-конфигурации даёт 201 `{ok:true,emailNotified:false}`; запись действительно существует в отдельной SQLite с обеими датами/версиями.
- Anonymous admin API = 401; CLIENT admin = 403; CLIENT свой проект = 200; другой CLIENT тот же проект = 404; dashboard/admin pages = 200 для соответствующих ролей; admin POST без CSRF = 403.
- Соглашение/политика присутствуют в sitemap, robots указывает Business origin.

## Ограничения интерпретации
Моки успешной отправки подтверждают логику, не реальную доставку. 30 HTTP-проверок используют SQLite, не PostgreSQL. Непрерывная доставка при остановке процесса не гарантирована. Нет полного production pentest, проверки backup/log retention или юридического заключения. Первый lint/build выявил исправленные замечания; финальные результаты приведены отдельно. HTTP-браузер первый раз не стартовал из-за неверного локального пути chromium, затем выполнен повторно с доступным браузером и прошёл.

Логи сохранены в docs/checks. Персональные данные production и секреты в них отсутствуют; SMTP отключён, фикстуры синтетические. Неблокирующее предупреждение build о нескольких lockfile в sandbox не воспроизводится обязательно на сервере проекта.
