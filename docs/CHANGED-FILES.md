# Точный состав поставки

## Изменены

- `.env.example`
- `README.md`
- `app/api/leads/route.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/robots.ts`
- `app/services/[slug]/page.tsx`
- `app/sitemap.ts`
- `components/lead-form.tsx`
- `lib/mailer.ts`
- `lib/validation.ts`
- `prisma/schema.postgresql.prisma`
- `prisma/schema.sqlite.prisma`
- `tests/leads.test.ts`

## Добавлены

- `.eslintignore`
- `app/agreement/page.tsx`
- `app/privacy/page.tsx`
- `components/legal-document.tsx`
- `docs/AGREEMENT.md`
- `docs/AUDIT-INITIAL.md`
- `docs/AUDIT-REPORT.md`
- `docs/CHANGED-FILES.md`
- `docs/CHECKS.md`
- `docs/INTEGRATION-PLAN.md`
- `docs/PRIVACY.md`
- `docs/checks/build-final.log`
- `docs/checks/dependency-audit.json`
- `docs/checks/http-smoke.log`
- `docs/checks/lint-final.log`
- `docs/checks/migrate-sqlite.log`
- `docs/checks/postgres-model-diff.sql`
- `docs/checks/sqlite-diff.log`
- `docs/checks/sqlite-history.log`
- `docs/checks/tests-baseline.log`
- `docs/checks/tests-final.log`
- `docs/checks/typecheck-final.log`
- `docs/checks/validate-postgres.log`
- `docs/checks/validate-sqlite.log`
- `lib/legal-documents.ts`
- `lib/legal.ts`
- `lib/site-url.ts`
- `prisma/migrations-postgresql/0004_legal_acceptance/migration.sql`
- `prisma/migrations-sqlite/0004_legal_acceptance/migration.sql`
- `prisma/migrations/0004_legal_acceptance/migration.sql`
- `tests/admin-all-routes.test.ts`
- `tests/leads-reliability.test.ts`
- `tests/legal-and-navigation.test.ts`
- `tests/mailer.test.ts`

Все прочие исходные файлы архива совпадают побайтно. Секреты/локальные базы/build artifacts исключены; исходный generated tsconfig.tsbuildinfo также не поставляется.
