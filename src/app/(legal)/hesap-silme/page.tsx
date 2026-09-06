import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(
  "Hesap Silme",
  "Koala hesabı ve kişisel verileri için silme talebi oluşturma yolları.",
  "/hesap-silme",
);

export default function Page() {
  const subject = encodeURIComponent("Koala hesap silme talebi");

  return (
    <article className="legal-document">
      <p className="eyebrow">Hesap ve veriler</p>
      <h1>Hesabını silme talebi oluştur</h1>
      <p className="lede">
        Koala uygulamasında Hesap Ayarları içinden hesap silme talebi
        oluşturabilirsin. Uygulamaya erişemiyorsan kayıtlı e-posta adresinden
        bize yaz.
      </p>
      <h2>Uygulamadan talep</h2>
      <p>
        Hesap Ayarları → Hesabımı Sil adımında kapsamı görüp talebi
        onaylayabilirsin. Açık iş, ödeme veya uyuşmazlık varsa talep bunlar
        sonuçlanana kadar bekler; durum uygulamada görünür.
      </p>
      <h2>Web üzerinden talep</h2>
      <p>
        Kimliğini doğrulayabilmemiz için hesabında kayıtlı e-posta adresinden
        <a className="text-link" href={`mailto:info@iskoala.com?subject=${subject}`}>
          {" "}info@iskoala.com
        </a>
        {" "}adresine yaz. Mesaja parola, kimlik belgesi veya ödeme bilgisi ekleme.
      </p>
      <h2>Silinen ve saklanan veriler</h2>
      <p>
        Kimlik ve profil bilgileri anonimleştirilir. Kanunen saklanması gereken
        ödeme, sözleşme ve rıza kayıtları gerekli süre boyunca tutulabilir;
        mümkün olan yerlerde hesapla doğrudan bağları kaldırılır.
      </p>
    </article>
  );
}
