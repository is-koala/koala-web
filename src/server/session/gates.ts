import "server-only";

import { appShells, sectionAt, type AppShellId } from "@/lib/app-routes";
import { gatesInMode, type GateId } from "@/lib/gates";

import { enterShell, type Viewer, type ViewerCompany, type ViewerContext } from "./viewer";

/**
 * Bir kapının cevabı.
 *
 * Kapalı olduğunda **hangi** koşulların eksik olduğunu taşır, tek bir neden
 * değil: tek neden gösterip kullanıcıyı ikinci bir redde sürmek, kapıyı hiç
 * koymamakla aynı sonucu verir.
 */
export type GateVerdict =
  | { readonly open: true }
  | { readonly open: false; readonly blockedBy: readonly GateId[] };

/** Bir şirket üyeliği ve o şirkete özgü kararlar. */
export type CompanyGates = ViewerCompany & {
  /** `POST /companies/{companyId}/jobs` — `JobManager.java:214-219`. */
  readonly corporateJob: GateVerdict;
};

/**
 * Bu kullanıcının kapıları.
 *
 * Alanların hepsi tek bir `GET /users/me` yanıtından türüyor; hiçbiri ikinci
 * bir tura çıkmıyor ve hiçbiri backend'in ham hata metnine bakmıyor.
 */
export type ViewerGates = {
  /** `POST /users/me/jobs` — `JobManager.java:105-114`. */
  readonly individualJob: GateVerdict;
  /** `POST /companies` — `CompanyManager.java:103-105`. İşveren olmak gerekmiyor. */
  readonly companyCreation: GateVerdict;
  /**
   * `POST /jobs/{jobId}/applications` — `JobApplicationManager.java:200`.
   *
   * Karar `companyCreation` ile aynı koşulu okuyor (kimlik), ama ayrı duruyor:
   * başvuru reddi `APPLICANT_IDENTITY_NOT_VERIFIED`, şirketinki
   * `USER_MUST_VERIFY_IDENTITY`. Tek alanda birleştirmek, kapalı eylemin
   * errorCode'unu yanlış aileye düşürürdü.
   */
  readonly application: GateVerdict;
  /** Bireysel işverenin ödeme oturumu — `JobAssignmentManager.java:212-216`, `:337-350`. */
  readonly individualPayment: GateVerdict;
  /** Her üyelik kendi kararını taşır; "kullanıcının şirketi" diye tek bir nesne yok. */
  readonly companies: readonly CompanyGates[];
  /**
   * Bu kullanıcının karşılamadığı, şirketten bağımsız kapılar.
   *
   * Şirkete bağlı kapılar (`companyContact`, `companyApproval`,
   * `companyBillingAddress`) burada yok: bir şirket kimliği olmadan
   * cevaplanamıyorlar ve kabuk düzeyinde "eksik" saymak, onaysız şirketi
   * olmayan kullanıcıya da uyarı gösterirdi.
   */
  readonly unmet: readonly GateId[];
};

/** Bildirilmiş kapıların bu kullanıcıdaki karşılığı, kipine göre ayrılmış. */
export type GateRequirements = {
  /** Kalıcı şerit; kabuk kullanılabilir kalır. */
  readonly advisories: readonly GateId[];
  /** Eylemi kapatan kapılar; nedeni eylemin yanında yazılır. */
  readonly blocked: readonly GateId[];
};

/**
 * Kapı okuyucusu.
 *
 * Saf: bir `Viewer` alır, karar döndürür. Ağ çağrısı burada değil, çünkü
 * profil zaten `currentViewer()` içinde `React.cache()` ile paylaşılıyor —
 * ikinci bir çağıran her sayfa render'ına ikinci bir tur eklerdi.
 */
export function viewerGates(viewer: Viewer): ViewerGates {
  // Koşullar bir kez adlandırılıyor, ama her karar kendi sırasını kuruyor:
  // gerekçeler ekranda bu sırayla okunuyor ve önce değiştirilemeyen koşul
  // (rol), sonra kullanıcının kapatabileceği eksik geliyor.
  const missing = {
    identity: absent<GateId>(viewer.identityVerified, "identityVerification"),
    identityNumber: absent<GateId>(viewer.hasIdentityNumber, "identityNumber"),
    employerRole: absent<GateId>(viewer.isEmployer, "employerRole"),
    billingAddress: absent<GateId>(viewer.hasAddress, "individualBillingAddress"),
  };

  return {
    unmet: [
      ...missing.identity,
      ...missing.identityNumber,
      ...missing.employerRole,
      ...missing.billingAddress,
    ],
    individualJob: verdict([...missing.employerRole, ...missing.identity]),
    companyCreation: verdict(missing.identity),
    application: verdict(missing.identity),
    individualPayment: verdict([
      ...missing.identity,
      ...missing.identityNumber,
      ...missing.billingAddress,
    ]),
    companies: viewer.companies.map((company) => ({
      ...company,
      corporateJob: verdict(companyJobBlockers(company)),
    })),
  };
}

/**
 * Bir bölümün ya da kabuğun bildirdiği kapıların çözümü.
 *
 * Bildirilmeyen kapı karşılanmasa da sessiz kalır: `/isveren/mesajlar` fatura
 * adresi yüzünden uyarı verirse uyarı anlamını yitirir.
 */
export function gateRequirements(
  gates: ViewerGates,
  required: readonly GateId[],
): GateRequirements {
  const unmet = required.filter((gate) => gates.unmet.includes(gate));
  return { advisories: gatesInMode(unmet, "advisory"), blocked: gatesInMode(unmet, "blocking") };
}

/** Tek bir eylem kararını sözlükte tanımlı sunum kiplerini koruyarak ayırır. */
export function gateVerdictRequirements(verdict: GateVerdict): GateRequirements {
  const unmet = verdict.open ? [] : verdict.blockedBy;
  return { advisories: gatesInMode(unmet, "advisory"), blocked: gatesInMode(unmet, "blocking") };
}

/**
 * İlanın açılacağı şirkete göre karar.
 *
 * Şirket kimliğini alır, "kullanıcının şirketi"ni varsaymaz: iki şirkette
 * yetkili bir kullanıcının biri onaylı biri değilse tek bir cevap ikisi için
 * de yanlış olur. Hiç üyelik yoksa kullanıcı o şirketin yetkilisi değildir.
 */
export function corporateJobGate(gates: ViewerGates, companyId: string): GateVerdict {
  const company = gates.companies.find((candidate) => candidate.companyId === companyId);
  return company?.corporateJob ?? { open: false, blockedBy: ["companyContact"] };
}

/**
 * Şirket ilanının ödeme oturumu kapısı.
 *
 * Şirketin adresini **dışarıdan** alıyor, `GET /users/me` yanıtından değil:
 * `CompanyMembershipDto` yalnız `(companyId, companyName, role, approved)`
 * taşıyor ve şirketin adresi olup olmadığını söylemiyor. Yani bu kapı tek
 * başına `GET /users/me` ile cevaplanamaz — çağıran şirketi zaten yüklemiş
 * olduğunda (`GET /companies/{companyId}`) o yanıttan besliyor. Kapı
 * okuyucusuna ikinci bir tur eklemek, adresi hiç sormayan sayfaları da
 * yavaşlatırdı.
 *
 * Kullanıcının kendi fatura adresine bakılmıyor: bu yolda ödeme
 * `JobAssignmentManager.java:316-326` ile şirketin adresini okuyor.
 *
 * Şirket **onayı** da bakılmıyor, bilerek. Onay kuralı ilan açmanın önünde ve
 * yalnız istemcide yaşıyor; backend onaysız şirkete ilan açtırdığı için aynı
 * kuralı ödemeye de uygulamak, işçisi kabul edilmiş bir işvereni parasını
 * ödeyemez hâlde bırakırdı. Kapının amacı bunun tersi: kullanıcıyı çıkışı
 * olmayan bir yere sokmamak.
 */
export function corporatePaymentGate(
  gates: ViewerGates,
  companyId: string,
  companyHasAddress: boolean,
): GateVerdict {
  const membership = gates.companies.find((company) => company.companyId === companyId);

  return verdict([
    ...absent<GateId>(membership !== undefined, "companyContact"),
    ...absent<GateId>(companyHasAddress, "companyBillingAddress"),
  ]);
}

/**
 * Şirket ilanının kapıları.
 *
 * Kimlik doğrulaması **yok**: `JobManager.createCorporateJob` (`:180-219`)
 * yalnız yetkililiğe bakıyor. Bireysel yolun kimlik koşulunu buraya
 * kopyalamak, doğrulanmamış ama yetkili bir kullanıcıyı yapabildiği bir işten
 * alıkoyardı.
 *
 * Onay koşulu ise tersi: backend'de karşılığı **yok**. `company.isApproved()`
 * iş mantığının hiçbir yerinde okunmuyor (yalnız admin onayı ve admin
 * listesi), yani onaylanmamış şirket bugün API'den ilan açabiliyor. Bu bir
 * ürün kuralı ve istemcide duruyor; güvenlik sınırı değil.
 */
function companyJobBlockers(company: ViewerCompany): readonly GateId[] {
  return company.approved ? [] : ["companyApproval"];
}

/** Kabuk bağlamının kapı kararlarıyla genişlemiş hâli. */
export type GateContext = ViewerContext & {
  /** Profil çözülemediyse `null`: bilinmeyen bir durum eksiklik gibi gösterilmez. */
  readonly gates: ViewerGates | null;
};

/** Kapıdan geçmiş bir isteğin tam bağlamı: kullanıcı, arıza ve çözülmüş kapılar. */
export type GateEntry = GateContext & GateRequirements;

/**
 * Kabuk altındaki bir sayfanın kapısı.
 *
 * `enterShell()` üzerinden gidiyor, yani sıra korunuyor: önce oturum kapısı,
 * sonra `React.cache()` ile paylaşılan profil. Kapı kararları o tek yanıttan
 * türüyor; ikinci bir `GET /users/me` çıkmıyor.
 *
 * **Layout'ta değil sayfada çağrılır.** Next bir layout'u kardeş rotalar
 * arasında gezinirken yeniden çalıştırmıyor, yani adrese bağlı bir karar
 * layout'ta bir gezinme sonra bayatlar. Kabuğun kendi kuralı da bu:
 * "sayfa kapısını layout'tan miras almaz" (`AGENTS.md`).
 */
export async function enterSection(shell: AppShellId, href: string): Promise<GateEntry> {
  const context = await currentGates();
  const declared = sectionAt(shell, sectionSegments(shell, href));

  // Kayıtta olmayan adres 404'tür; kapı katmanı oraya kendi kararını uydurmaz.
  if (context.gates === null || declared === undefined) {
    return { ...context, advisories: [], blocked: [] };
  }

  return { ...context, ...gateRequirements(context.gates, declared.requires) };
}

/**
 * Kabuğun tamamı için geçerli kapılar.
 *
 * Kabuk düzeyinde kalan tek şey adresten bağımsız olduğu için layout'ta
 * çağrılabilen kısım: kimlik ve fatura adresi eksiği kullanıcı hangi sayfada
 * olursa olsun aynı.
 */
export async function enterShellGates(shell: AppShellId): Promise<GateEntry> {
  const context = await currentGates();
  if (context.gates === null) return { ...context, advisories: [], blocked: [] };
  return { ...context, ...gateRequirements(context.gates, appShells[shell].requires) };
}

/** Oturum kapısı, profil ve kapı kararları; hepsi tek turdan. */
export async function currentGates(): Promise<GateContext> {
  const context = await enterShell();
  return { ...context, gates: context.viewer === null ? null : viewerGates(context.viewer) };
}

/** Kayıt tam adresle değil parçalarla sorguluyor; kök kaydın kendisinden gelir. */
function sectionSegments(shell: AppShellId, href: string): readonly string[] {
  const root = `${appShells[shell].root}/`;
  return href.startsWith(root) ? href.slice(root.length).split("/") : [];
}

/** Karşılanmamış koşulu tek elemanlı listeye çevirir; karşılanmışsa boş. */
function absent<T>(satisfied: boolean, gate: T): readonly T[] {
  return satisfied ? [] : [gate];
}

function verdict(blockedBy: readonly GateId[]): GateVerdict {
  return blockedBy.length === 0 ? { open: true } : { open: false, blockedBy };
}
