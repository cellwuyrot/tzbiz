import crypto from "node:crypto";
import { NextResponse } from "next/server";
export function failureInfo(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (["P2021", "P2022"].includes(code))
    return {
      code: "DATABASE_SCHEMA",
      message:
        "Структура базы данных устарела. Примените миграции командой npm run db:deploy на сервере.",
    };
  if (["P1000", "P1010"].includes(code))
    return {
      code: "DATABASE_ACCESS",
      message:
        "Нет доступа к базе данных. Проверьте пользователя БД и его права на сервере.",
    };
  if (["P1001", "P1002", "P1008", "P1017", "P2024"].includes(code))
    return {
      code: "DATABASE_UNAVAILABLE",
      message:
        "База данных недоступна или не отвечает. Проверьте подключение на сервере.",
    };
  return {
    code: "INTERNAL_ERROR",
    message:
      "Не удалось выполнить операцию. Передайте код обращения администратору сервера.",
  };
}
export function logFailure(area: string, error: unknown) {
  const info = failureInfo(error),
    requestId = crypto.randomUUID();
  console.error("[business] operation_failed", {
    area,
    code: info.code,
    requestId,
  });
  return { ...info, requestId };
}
export function diagnosticResponse(area: string, error: unknown) {
  const info = logFailure(area, error);
  return NextResponse.json(
    { error: info.message, ...info },
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Request-Id": info.requestId,
      },
    },
  );
}
