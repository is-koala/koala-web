import { notFound, unstable_rethrow } from "next/navigation";

import { SessionDetailScreen } from "@/components/account-settings/session-detail";
import { ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import type { AppShellId } from "@/lib/app-routes";
import { isUuid } from "@/lib/identifiers";
import { getSessionDetail } from "@/server/account-settings/session-detail";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { renameDeviceAction, revokeSessionFromDetailAction } from "./oturum-actions";

export type SessionDetailPageProps = { params: Promise<{ sessionId: string }> };

/**
 * İki kabuğun ortak oturum ayrıntısı (is-koala/koala-web#188).
 *
 * Sayfanın kendi Suspense sınırı yok ve yanında `loading.tsx` de yok, bilerek:
 * `notFound()` bir `await`'ten sonra çağrılıyor ve sayfayı bir sınıra sokmak
 * 404'ü 200'e kilitlerdi (`AGENTS.md`, "Yapı"; ölçüldü — `next dev` altında
 * `Suspense` içinden çağrılan `notFound()` 200 döndü). Bekleme göstergesi
 * hesap sayfasındaki satır bağlantısının içinde (`LinkPending`).
 */
export async function SessionDetailPage({
  shell,
  params,
}: SessionDetailPageProps & { shell: AppShellId }) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();

  const result = await getSessionDetail(sessionId)
    .then((detail) => ({ detail }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  if ("failure" in result) {
    return (
      <PagePanel aria-labelledby="oturum-hata-baslik">
        <PageHeader eyebrow="Oturum" title="Oturum ayrıntısı" titleId="oturum-hata-baslik" />
        <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />
      </PagePanel>
    );
  }
  // Başkasının oturumu, kapatılmış oturum ve eski sunucu aynı yere düşer:
  // backend üçünü de gizliyor, sayfa da ayırt etmiyor.
  if (result.detail === null) notFound();

  return (
    <SessionDetailScreen
      shell={shell}
      detail={result.detail}
      renameAction={renameDeviceAction.bind(null, shell)}
      revokeAction={revokeSessionFromDetailAction.bind(null, shell)}
    />
  );
}
