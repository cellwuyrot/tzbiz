import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
vi.mock("@/lib/api-auth", () => ({ requireApiRole: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
import { requireApiRole } from "@/lib/api-auth";

const modules: Record<string, () => Promise<unknown>> = {
  "/app/api/admin/documents/route.ts": () =>
    import("@/app/api/admin/documents/route"),
  "/app/api/admin/analytics/route.ts": () =>
    import("@/app/api/admin/analytics/route"),
  "/app/api/admin/billing/plans/[id]/image/route.ts": () =>
    import("@/app/api/admin/billing/plans/[id]/image/route"),
  "/app/api/admin/invoices/route.ts": () =>
    import("@/app/api/admin/invoices/route"),
  "/app/api/admin/invoices/[id]/route.ts": () =>
    import("@/app/api/admin/invoices/[id]/route"),
  "/app/api/admin/commerce/route.ts": () =>
    import("@/app/api/admin/commerce/route"),
  "/app/api/admin/orders/route.ts": () =>
    import("@/app/api/admin/orders/route"),
  "/app/api/admin/orders/[id]/route.ts": () =>
    import("@/app/api/admin/orders/[id]/route"),
  "/app/api/admin/billing/plans/route.ts": () =>
    import("@/app/api/admin/billing/plans/route"),
  "/app/api/admin/billing/plans/[id]/route.ts": () =>
    import("@/app/api/admin/billing/plans/[id]/route"),
  "/app/api/admin/integrations/route.ts": () =>
    import("@/app/api/admin/integrations/route"),
  "/app/api/admin/integrations/email/verify/route.ts": () =>
    import("@/app/api/admin/integrations/email/verify/route"),
  "/app/api/admin/integrations/email/test/route.ts": () =>
    import("@/app/api/admin/integrations/email/test/route"),
  "/app/api/admin/leads/[id]/notifications/retry/route.ts": () =>
    import("@/app/api/admin/leads/[id]/notifications/retry/route"),
  "/app/api/admin/clients/[id]/reset-password/route.ts": () =>
    import("@/app/api/admin/clients/[id]/reset-password/route"),
  "/app/api/admin/clients/[id]/route.ts": () =>
    import("@/app/api/admin/clients/[id]/route"),
  "/app/api/admin/clients/route.ts": () =>
    import("@/app/api/admin/clients/route"),
  "/app/api/admin/leads/[id]/route.ts": () =>
    import("@/app/api/admin/leads/[id]/route"),
  "/app/api/admin/leads/route.ts": () => import("@/app/api/admin/leads/route"),
  "/app/api/admin/projects/[id]/route.ts": () =>
    import("@/app/api/admin/projects/[id]/route"),
  "/app/api/admin/projects/route.ts": () =>
    import("@/app/api/admin/projects/route"),
  "/app/api/admin/services/[id]/media/[mediaId]/route.ts": () =>
    import("@/app/api/admin/services/[id]/media/[mediaId]/route"),
  "/app/api/admin/services/[id]/route.ts": () =>
    import("@/app/api/admin/services/[id]/route"),
  "/app/api/admin/services/route.ts": () =>
    import("@/app/api/admin/services/route"),
  "/app/api/admin/site-settings/route.ts": () =>
    import("@/app/api/admin/site-settings/route"),
};
const request = new NextRequest("http://localhost:3000/api/admin/test", {
  method: "POST",
});
const context = { params: Promise.resolve({ id: "test", mediaId: "test" }) };

describe("all admin route guards", () => {
  afterEach(() => vi.clearAllMocks());
  for (const [path, load] of Object.entries(modules)) {
    it(`protects each handler in ${path} before database access`, async () => {
      const handlers = (await load()) as Record<string, unknown>;
      for (const [method, handler] of Object.entries(handlers)) {
        if (
          !/^(GET|POST|PATCH|DELETE)$/.test(method) ||
          typeof handler !== "function"
        )
          continue;
        for (const status of [401, 403]) {
          vi.mocked(requireApiRole).mockResolvedValueOnce({
            user: null,
            response: NextResponse.json({ error: "denied" }, { status }),
          });
          const response = await handler(request, context);
          expect(response.status).toBe(status);
          expect(requireApiRole).toHaveBeenLastCalledWith("ADMIN");
        }
        if (method === "GET") continue;
        vi.mocked(requireApiRole).mockResolvedValueOnce({
          user: { id: "admin", role: "ADMIN" } as never,
          response: null,
        });
        const response = await handler(request, context);
        // 405 handlers never mutate; all actual mutations require a valid token.
        expect([403, 405]).toContain(response.status);
      }
    });
  }
});
