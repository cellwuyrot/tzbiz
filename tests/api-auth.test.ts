import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";
import { requireApiRole } from "@/lib/api-auth";

describe("requireApiRole", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for a CLIENT on an ADMIN route", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "client-id",
      email: "client@example.com",
      passwordHash: "hash",
      name: "Client",
      role: "CLIENT",
      createdAt: new Date(),
    });
    const result = await requireApiRole("ADMIN");
    expect(result.response?.status).toBe(403);
  });
});
