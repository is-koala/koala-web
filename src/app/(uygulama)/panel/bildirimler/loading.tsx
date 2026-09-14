import { LoadingState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";

/**
 * Bölümün kendi yükleniyor durumu. Sayfa `notFound()` çağırmıyor, yani
 * Suspense sınırı 404'ü düşürmüyor (`AGENTS.md`, "Yapı").
 */
export default function Loading() {
  return (
    <PagePanel className="notifications-page">
      <PageHeader eyebrow="İş arayan paneli" title="Bildirimler" />
      <LoadingState label="Bildirimler yükleniyor" />
    </PagePanel>
  );
}
