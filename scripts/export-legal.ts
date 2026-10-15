import fs from "node:fs";
import {
  agreementDocument,
  privacyDocument,
  legalNotice,
} from "../lib/legal-documents";
for (const [name, d] of [
  ["AGREEMENT", agreementDocument],
  ["PRIVACY", privacyDocument],
] as const) {
  fs.writeFileSync(
    `docs/${name}.md`,
    `# ${d.title}\n\nРедакция: ${d.version}\n\n${legalNotice}\n\n` +
      d.sections
        .map((s) => `## ${s.title}\n\n${s.paragraphs.join("\n\n")}`)
        .join("\n\n") +
      "\n",
  );
}
