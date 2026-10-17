import { afterEach, describe, expect, it, vi } from "vitest";
import { readAdminResponse, adminFetch } from "@/lib/admin-fetch";
afterEach(() => vi.unstubAllGlobals());
describe("administrator error messages", () => {
  it.each([
    [401, "Сессия завершилась"],
    [403, "Нет прав администратора"],
    [503, "Конкретная ошибка"],
  ])("explains HTTP %s", async (status, text) => {
    await expect(
      readAdminResponse(
        new Response(
          JSON.stringify({ error: "Конкретная ошибка", requestId: "req-safe" }),
          { status },
        ),
      ),
    ).rejects.toThrow(text);
  });
  it("includes a support request id", async () => {
    await expect(
      readAdminResponse(
        new Response(
          JSON.stringify({ error: "Ошибка", requestId: "req-safe" }),
          { status: 503 },
        ),
      ),
    ).rejects.toThrow("req-safe");
  });
  it("does not expose raw transport errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("sensitive transport URL")),
    );
    await expect(adminFetch("/api/admin/integrations")).rejects.toThrow(
      "Нет соединения",
    );
  });
});
