export async function readAdminResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      response.status === 401
        ? "Сессия завершилась. Войдите в аккаунт снова."
        : response.status === 403
          ? "Нет прав администратора Business. Проверьте назначение роли в TZ ID."
          : data?.error ||
            (response.status === 429
              ? "Слишком много запросов. Повторите позже."
              : "Сервер недоступен. Повторите запрос.");
    throw new Error(
      `${message}${data?.requestId ? ` Код обращения: ${data.requestId}` : ""}`,
    );
  }
  if (!data)
    throw new Error("Сервер вернул некорректный ответ. Повторите запрос.");
  return data as T;
}
export async function adminFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new Error(
      "Нет соединения с сервером. Проверьте сеть и повторите запрос.",
    );
  }
  return readAdminResponse<T>(response);
}
export async function adminMutation<T>(
  url: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const { token } = await adminFetch<{ token: string }>("/api/auth/csrf");
  return adminFetch<T>(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
