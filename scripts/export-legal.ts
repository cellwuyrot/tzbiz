import fs from "node:fs";
import { LEGAL_SLUGS, defaultLegal } from "../lib/legal-store";
import { legalNotice } from "../lib/legal-documents";
for (const slug of LEGAL_SLUGS) {
  const d = defaultLegal(slug);
  fs.writeFileSync(
    `docs/${slug.toUpperCase()}.md`,
    `# ${d.title}\n\nЧЕРНОВИК ШАБЛОНА. Не является публикацией в базе.\n\n${legalNotice}\n\n${d.body}\n`,
  );
}
