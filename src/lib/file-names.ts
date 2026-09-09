/** Kullanıcı kaynaklı adı ekranda ve tarayıcının `download` niteliğinde güvenli tutar. */
export function safeDownloadFileName(original: string): string {
  const sanitized = original
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gi, "")
    .replace(/[\\/]/g, "_")
    .replace(/["']/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .trim();
  const extension = sanitized.match(/\.(?:pdf|png|jpe?g|webp)$/i)?.[0] ?? "";
  const base = extension ? sanitized.slice(0, -extension.length) : sanitized;
  const safeBase = Array.from(base).slice(0, 180 - Array.from(extension).length).join("");
  return `${safeBase || "kanit"}${extension}`;
}
