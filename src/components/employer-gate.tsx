import Link from "next/link";

import { identityHandoffHref, identityVerificationPath } from "@/identity/handoff";
import { gateNotice } from "@/lib/errors";
import type { GateId } from "@/lib/gates";

/**
 * Yetki kapılarının ekrandaki iki kipi.
 *
 * Sunum bileşenleri ve senkron: oturumu, profili, kapıyı kendileri okumaz.
 * Kararı `@/server/session/gates` veriyor, metni `@/lib/errors`; burada
 * yalnız verilen kapı kimlikleri çiziliyor. Bu ayrım sayesinde kapı kararı
 * bir React render'ı kurmadan, kapı ekranı da bir backend olmadan test
 * edilebiliyor.
 *
 * Metinlerin hiçbiri backend'den gelmiyor: kapı henüz yapılmamış bir isteği
 * anlatıyor, ortada bir yanıt yok. Ham backend mesajı da hiçbir kipte ekrana
 * basılmıyor.
 */

type GateListProps = {
  gates: readonly GateId[];
  /** Kimlik kapısı bu yola `next` olarak döner. */
  returnPath?: string;
};

/**
 * Kalıcı uyarı şeridi (**advisory**).
 *
 * Kabuk kullanılabilir kalır: kullanıcı eksiğini görür ama gezinmesi
 * kilitlenmez. Şerit `role="status"`, çünkü sayfanın o anki işine ait bir
 * hata değil, arka planda duran bir eksik.
 */
export function GateAdvisories({ gates, returnPath }: GateListProps) {
  if (gates.length === 0) return null;

  return (
    <div role="status" className="gate-advisories">
      {gates.map((gate) => (
        <GateReason key={gate} gate={gate} returnPath={returnPath} />
      ))}
    </div>
  );
}

/**
 * Engellerin gerekçeleri, devre dışı bırakılacak bir eylem olmadan.
 *
 * Bölümler sırayla açılıyor: kapının kapattığı düğme henüz ekranda olmayabilir
 * ama kullanıcı yolun kendisine kapalı olduğunu okumalı, yoksa eksik ekranı
 * bir arıza gibi okur.
 */
export function GateBlocks({ gates, returnPath }: GateListProps) {
  if (gates.length === 0) return null;

  return (
    <div role="alert" className="state-card state-card-error gate-block">
      {gates.map((gate) => (
        <GateReason key={gate} gate={gate} returnPath={returnPath} />
      ))}
    </div>
  );
}

export type EmployerGateProps = {
  /** Karşılanmamış engelleyici kapılar; boşsa eylem olduğu gibi çizilir. */
  blocked: readonly GateId[];
  /** Engellendiğinde devre dışı gösterilecek eylemin adı. */
  action: string;
  /** Kimlik kapısı bu yola `next` olarak döner; yoksa kanonik aktarım adresi. */
  returnPath?: string;
  children: React.ReactNode;
};

/**
 * Eylemi kapıya bağlayan sarmalayıcı (**blocking**).
 *
 * Engellendiğinde `children` hiç çizilmiyor: devre dışı bırakılmış bir form
 * yine de gönderilebilir, ve eylemin kendisi ekrana girdiğinde "görünüyor ama
 * çalışmıyor" hâli bir arıza gibi okunur. Yerine aynı adı taşıyan devre dışı
 * bir düğme ve nedeni geçiyor — düğmeyi tümden gizlemek "neden yapamıyorum"
 * sorusunu cevapsız bırakırdı.
 */
export function EmployerGate({ blocked, action, children, returnPath }: EmployerGateProps) {
  if (blocked.length === 0) return <>{children}</>;

  return (
    <div className="gate-action">
      <button type="button" className="button button-secondary" disabled>
        {action}
      </button>
      <GateBlocks gates={blocked} returnPath={returnPath} />
    </div>
  );
}

/** Tek bir kapının başlığı, gerekçesi ve varsa gidilecek yolu. */
function GateReason({ gate, returnPath }: { gate: GateId; returnPath?: string }) {
  const notice = gateNotice(gate);
  const href =
    notice.remedy === null
      ? null
      : notice.remedy.href === identityVerificationPath
        ? identityHandoffHref(returnPath)
        : notice.remedy.href;

  return (
    <div className="gate-reason">
      <h2>{notice.title}</h2>
      <p>{notice.message}</p>
      {href === null || notice.remedy === null ? null : (
        <Link className="text-link" href={href}>
          {notice.remedy.label}
        </Link>
      )}
    </div>
  );
}
