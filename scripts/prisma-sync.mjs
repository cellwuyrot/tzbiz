import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !configuredDatabaseUrl) {
  throw new Error("DATABASE_URL is required when NODE_ENV=production.");
}

const databaseUrl = configuredDatabaseUrl || "file:../data/dev.db";
const isPostgres = /^postgres(ql)?:/i.test(databaseUrl);

if (isProduction && !isPostgres) {
  throw new Error("Production DATABASE_URL must use PostgreSQL (postgres:// or postgresql://).");
}

const provider = isPostgres ? "postgresql" : "sqlite";
const source = path.join(root, "prisma", isPostgres ? "schema.postgresql.prisma" : "schema.sqlite.prisma");
const target = path.join(root, "prisma", "schema.prisma");
const migrationSource = path.join(root, "prisma", isPostgres ? "migrations-postgresql" : "migrations-sqlite");
const migrationTarget = path.join(root, "prisma", "migrations");

if (!fs.existsSync(source)) {
  throw new Error(`Prisma schema source is missing for ${provider}: ${source}`);
}

fs.copyFileSync(source, target);
fs.rmSync(migrationTarget, { recursive: true, force: true });
fs.cpSync(migrationSource, migrationTarget, { recursive: true });

console.log(`[prisma-sync] provider=${provider}`);
