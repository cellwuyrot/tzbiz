/** Display copy only. Never pass identity, URLs, slugs, product codes or audit snapshots here. */
export function renameDisplayText(text: string) {
  return text.replace(/\bVPN\b/gi, "Надёжное соединение");
}
