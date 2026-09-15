import { loginPath } from "./login-path";
import { safeInternalPath } from "./urls";

/**
 * Hata sunumunun katalogsuz çekirdeği: tipler, eylem → bağlantı kararı ve
 * kod bilmeyen yedek cümleler.
 *
 * Kataloglardan ayrı bir yaprak, çünkü kök `error.tsx` hiçbir `errorCode`
 * görmez ve yalnız "Bir sorun oluştu" der; ona kataloğu ve backend kod
 * ailelerini taşıtmak her rotanın ilk yüküne birkaç kilobayt eklerdi
 * (is-koala/koala-web#177). Kataloglu sunum `public-errors.ts` ve
 * `errors.ts`'te.
 */

export type ErrorAction = "login" | "home" | "retry" | "none";

export type ErrorPresentation = {
  title: string;
  message: string;
  action: ErrorAction;
};

/** Backend `errorCode` → ekrandaki Türkçe metin. Parçalı; rota kendi parçalarını birleştirir. */
export type ErrorCatalog = Readonly<Record<string, ErrorPresentation>>;

export type ErrorRecoveryAction =
  | Readonly<{ kind: "link"; href: string; label: string }>
  | Readonly<{ kind: "retry"; label: string }>;

/**
 * Hata kataloğundaki karar ile tıklanabilir arayüz arasındaki tek kapı.
 *
 * Link hedefleri çağırandan ya da backend'den alınmaz. Yine de çalışma
 * zamanında `safeInternalPath` üzerinden geçerler: tipler silindikten sonra
 * bozulmuş bir katalog girdisi dış yönlendirmeye dönüşemez. `retry` ise burada
 * handler taşımaz; aynı hata bir GET, form mutasyonu ya da error boundary'de
 * görülebilir ve yeniden denemenin ne demek olduğunu yalnız çağıran bilir.
 */
const errorRecoveryActions = {
  login: { kind: "link", href: loginPath, label: "Giriş yap" },
  home: { kind: "link", href: "/", label: "Ana sayfaya dön" },
  retry: { kind: "retry", label: "Yeniden dene" },
  none: null,
} as const satisfies Readonly<Record<ErrorAction, ErrorRecoveryAction | null>>;

/** Bilinmeyen eylem, prototip anahtarı veya güvensiz hedefte kapalı kalır. */
export function errorRecoveryAction(action: unknown): ErrorRecoveryAction | null {
  if (typeof action !== "string" || !Object.hasOwn(errorRecoveryActions, action)) return null;

  const recovery = errorRecoveryActions[action as ErrorAction];
  if (!recovery) return null;
  if (recovery.kind === "retry") return recovery;

  const href = safeInternalPath(recovery.href);
  return href ? { ...recovery, href } : null;
}

/** Kodu ve ailesi bilinmeyen 404. */
export const notFoundErrorPresentation: ErrorPresentation = {
  title: "Aradığın içerik bulunamadı",
  message: "Bağlantıyı kontrol edebilir veya ana sayfaya dönebilirsin.",
  action: "home",
};

/** Kodu ve ailesi bilinmeyen her öbür hata; kök `error.tsx` yalnız bunu gösterir. */
export const unexpectedErrorPresentation: ErrorPresentation = {
  title: "Bir sorun oluştu",
  message: "İşlemi şu anda tamamlayamadık. Biraz sonra yeniden dene.",
  action: "retry",
};
