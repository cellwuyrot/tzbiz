import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/api-auth", () => ({
  requireApiRole: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/security", () => ({
  verifyCsrf: vi.fn(),
  jsonError: (message: string, status = 400) => new Response(JSON.stringify({ error: message }), { status }),
}));

import { requireApiRole } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { verifyCsrf } from "@/lib/security";
import { POST } from "@/app/api/admin/clients/[id]/reset-password/route";

describe("client password reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiRole).mockResolvedValue({ user: { id: "admin", role: "ADMIN" } as never, response: null });
    vi.mocked(verifyCsrf).mockReturnValue(true);
  });

  it("does not reset or expose a password after TZ ID-only migration", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/clients/client-1/reset-password", { method: "POST", headers: { "x-csrf-token": "test" } });
    const response = await POST(request, { params: Promise.resolve({ id: "client-1" }) });
    expect(response.status).toBe(410);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("temporaryPassword");
  });
});
