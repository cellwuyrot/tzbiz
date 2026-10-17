import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { agreementDocument, privacyDocument } from "@/lib/legal-documents";
import { AGREEMENT_VERSION, PRIVACY_VERSION } from "@/lib/legal";

describe("legal documents and public navigation", () => {
  it("has versioned documents and no authentication in legal pages", () => {
    expect(agreementDocument.sections).toHaveLength(8);
    expect(agreementDocument.version).toBe(AGREEMENT_VERSION);
    expect(privacyDocument.version).toBe(PRIVACY_VERSION);
    for (const path of ["agreement", "privacy"]) {
      const source = fs.readFileSync(`app/${path}/page.tsx`, "utf8");
      expect(source).not.toContain("requireRole");
      expect(source).not.toContain("getCurrentUser");
      expect(source).toContain(`canonical: "/${path}"`);
      expect(source).toContain("index: true");
    }
  });
  it("links documents in separate required checkboxes and a new tab", () => {
    const form = fs.readFileSync("components/lead-form.tsx", "utf8");
    expect(form).toContain('name="agreementAccepted"');
    expect(form).toContain('name="privacyConsent"');
    for (const path of ["agreement", "privacy"]) {
      const link = form
        .match(/<a\b[^>]*>/g)
        ?.find((tag) => tag.includes(`href={legal.href("${path}")}`));
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
    }
    expect(
      form
        .match(/<input\b[^>]*>/g)
        ?.filter(
          (tag) => tag.includes('type="checkbox"') && /\brequired\b/.test(tag),
        ),
    ).toHaveLength(2);
  });
  it("does not add private routes to public navigation", () => {
    for (const file of [
      "app/page.tsx",
      "components/site-header.tsx",
      "components/legal-document.tsx",
      "app/services/[slug]/page.tsx",
    ]) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/href=["']\/(enter|admin|dashboard|login)/);
    }
  });
  it("keeps the provider schemas equivalent except datasource", () => {
    const normalize = (text: string) =>
      text.replace(
        /provider = "(?:postgresql|sqlite)"/,
        'provider = "database"',
      );
    expect(
      normalize(fs.readFileSync("prisma/schema.postgresql.prisma", "utf8")),
    ).toBe(normalize(fs.readFileSync("prisma/schema.sqlite.prisma", "utf8")));
  });
});
