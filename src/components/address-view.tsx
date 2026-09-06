import type { CanonicalAddress } from "@/address/contract";

/**
 * Kayıtlı adresin salt okunur hâli (şirket profili, ilan detayı).
 *
 * Backend `displayAddress` üretiyor ama her yanıtta dolu gelmiyor; bileşenler
 * her zaman elde olduğu için satır gerektiğinde buradan kurulur ve iki kaynak
 * arasında biçim farkı oluşmaz.
 */
export function AddressView({
  address,
  attribution,
}: {
  address: CanonicalAddress | null;
  attribution?: string | null;
}) {
  if (!address) {
    return (
      <div className="state-card" role="status">
        <h2>Adres eklenmemiş</h2>
        <p>Adres eklendiğinde burada görünecek.</p>
      </div>
    );
  }

  const { components } = address;
  const street = [
    components.siteName,
    components.block && `${components.block} Blok`,
    components.buildingName,
    components.thoroughfare,
    components.buildingNumber && `No: ${components.buildingNumber}`,
    components.floor && `Kat: ${components.floor}`,
    components.unitNumber && `Daire: ${components.unitNumber}`,
  ]
    .filter(Boolean)
    .join(" ");

  const locality = [
    components.neighborhood && `${components.neighborhood},`,
    `${address.districtName}/${address.cityName}`,
    components.postalCode,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <address className="address-view">
      {address.displayAddress ? (
        <p>{address.displayAddress}</p>
      ) : (
        <>
          <p>{street}</p>
          <p>{locality}</p>
        </>
      )}
      {components.additionalDirections && (
        <p className="muted">{components.additionalDirections}</p>
      )}
      {address.needsReview && (
        <p className="field-error">Bu adresin kontrol edilmesi gerekiyor.</p>
      )}
      {attribution && <p className="muted">Adres verileri: {attribution}</p>}
    </address>
  );
}
