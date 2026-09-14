import { LoadingState } from "@/components/states";

/**
 * Bölümün kendi yükleniyor durumu. Sayfa `notFound()` çağırmıyor, yani
 * Suspense sınırı 404'ü düşürmüyor (`AGENTS.md`, "Yapı").
 */
export default function Loading() {
  return (
    <section className="app-panel notifications-page">
      <p className="eyebrow">İş arayan paneli</p>
      <h1>Bildirimler</h1>
      <LoadingState label="Bildirimler yükleniyor" />
    </section>
  );
}
