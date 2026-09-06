export function formatAccountDate(value: string | null): string {
  if (!value) return "Tarih yok";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Tarih yok";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
