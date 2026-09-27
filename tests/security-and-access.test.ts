import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";
import { buildOrderUrl } from "@/lib/orders";
import { canAccessClientProject, canAccessRole } from "@/lib/access-policy";

describe("password hashing", () => {
  it("hashes and verifies a password without storing plaintext", async () => {
    const password = "Correct-Horse-9!";
    const hash = await bcrypt.hash(password, 12);
    expect(hash).not.toBe(password);
    await expect(bcrypt.compare(password, hash)).resolves.toBe(true);
    await expect(bcrypt.compare("wrong-password", hash)).resolves.toBe(false);
  });
});

describe("route access policy", () => {
  it("rejects a client for an admin-only role", () => {
    expect(canAccessRole("CLIENT", "ADMIN")).toBe(false);
    expect(canAccessRole("ADMIN", "ADMIN")).toBe(true);
  });
});

describe("project isolation", () => {
  it("allows only the assigned client", () => {
    expect(canAccessClientProject("client-a", "client-a")).toBe(true);
    expect(canAccessClientProject("client-b", "client-a")).toBe(false);
    expect(canAccessClientProject("client-a", null)).toBe(false);
  });
});

describe("order links", () => {
  it("forms the external order link from a slug", () => {
    expect(buildOrderUrl("https://trioz.ru/connect", "crm-integration")).toBe("https://trioz.ru/connect?service=crm-integration");
    expect(buildOrderUrl("https://trioz.ru/connect", "ai-automation")).toContain("service=ai-automation");
  });
});

vi.mock("@/lib/db", () => ({ prisma: { project: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/db";
import { getVisibleProjectForUser } from "@/lib/project-access";

describe("project route isolation", () => {
  it("returns nothing for another client's project", async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: "ckl9v0w2j0000s0a8q5b5b5b5",
      title: "Portal",
      description: "Portal",
      previewPath: "/api/uploads/aabbccddeeff00112233445566778899aabbccdd.webp",
      projectUrl: "https://example.com",
      status: "DONE",
      isPublic: false,
      clientId: "ckl9v0w2j0000s0a8q5b5b5c6",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await getVisibleProjectForUser("ckl9v0w2j0000s0a8q5b5b5b5", { id: "ckl9v0w2j0000s0a8q5b5b5c7", role: "CLIENT" });
    expect(result).toBeNull();
  });
});
