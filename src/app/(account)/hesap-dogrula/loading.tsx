import { LoadingState } from "@/components/placeholder-states";

/**
 * Sayfa açılışta kayıt tokenını ve sözleşme listesini backend'e soruyor; iki
 * çağrı boyunca kabuk boş kalmasın diye bekleme durumu ayrı tanımlı.
 */
export default function Loading() {
  return (
    <section className="account-card">
      <LoadingState label="Kayıt bağlantın doğrulanıyor" />
    </section>
  );
}
