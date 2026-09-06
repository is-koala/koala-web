import { errorPresentation } from "@/lib/errors";

const emptyCopy = {
  jobs: ["Henüz ilan yok", "Yeni ilanlar yayımlandığında burada görünecek."],
  applications: ["Henüz başvuru yok", "Başvurular burada listelenecek."],
  messages: ["Henüz mesaj yok", "Konuşmaların başladığında burada görünecek."],
  assignments: ["Henüz atama yok", "Atamaların burada görünecek."],
  addressSuggestions: [
    "Eşleşen adres bulunamadı",
    "Sokak ya da mahalle adını farklı yazmayı deneyebilirsin.",
  ],
} as const;

export function LoadingState({ label = "Yükleniyor" }: { label?: string }) {
  return (
    <div role="status" className="state-card animate-pulse" aria-live="polite">
      <span className="state-kicker">Biraz bekle</span>
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ kind }: { kind: keyof typeof emptyCopy }) {
  const [title, message] = emptyCopy[kind];
  return (
    <div role="status" className="state-card">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({
  errorCode,
  status,
}: {
  errorCode?: string;
  status: number;
}) {
  const presentation = errorPresentation(errorCode, status);
  return (
    <div role="alert" className="state-card state-card-error">
      <h2>{presentation.title}</h2>
      <p>{presentation.message}</p>
    </div>
  );
}
