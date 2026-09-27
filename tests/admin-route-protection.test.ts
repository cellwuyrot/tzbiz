import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-auth", () => ({
  requireApiRole: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import { requireApiRole } from "@/lib/api-auth";
import { GET } from "@/app/api/admin/services/route";

describe("admin route protection", () => {
  it("denies a CLIENT before reading the admin services store", async () => {
    vi.mocked(requireApiRole).mockResolvedValueOnce({
      user: null,
      response: new Response(JSON.stringify({ error: "Недостаточно прав." }), { status: 403 }),
    });

    const response = await GET();
    expect(response.status).toBe(403);
  });
});
