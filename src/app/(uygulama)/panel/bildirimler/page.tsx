import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { ShellGate } from "@/app/(uygulama)/shell";
import { ErrorState } from "@/components/states";
import { PageHeader, PagePanel } from "@/components/ui";
import { workerNotificationsPath } from "@/lib/app-routes";
import { listNotifications } from "@/server/account-settings/settings";
import { failureView } from "@/server/form";
import { enterShell } from "@/server/session/viewer";

import { markAllNotificationsReadAction, markNotificationReadAction } from "../../hesap-actions";
import { NotificationsFeed } from "./notifications-feed";

export const metadata: Metadata = {
  title: "Bildirimler",
  robots: { index: false, follow: false },
};

type NotificationsPageProps = {
  searchParams: Promise<{ sayfa?: string | string[] }>;
};

export default function Page({ searchParams }: NotificationsPageProps) {
  return (
    <ShellGate shell="worker" href={workerNotificationsPath}>
      <NotificationsPage searchParams={searchParams} />
    </ShellGate>
  );
}

/**
 * İş arayanın bildirim akışı.
 *
 * Hesap sayfası aynı akışı bir kart olarak taşıyor; burası akışın kendi adresi
 * — mobil uygulamadaki bildirim sekmesinin web karşılığı. Liste
 * `GET /users/me/notifications` ile sayfalı geliyor; sayfa numarası adres
 * çubuğunda (`?sayfa=`), böylece bir bildirim bağlantısı paylaşılabiliyor ve
 * geri düğmesi çalışıyor.
 */
export async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const context = await enterShell();
  if (context.failure !== null || context.viewer === null) return null;

  const page = pageFrom((await searchParams).sayfa);
  const result = await listNotifications(page)
    .then((feed) => ({ feed }))
    .catch((error: unknown) => {
      unstable_rethrow(error);
      return { failure: failureView(error) };
    });

  return (
    <PagePanel className="notifications-page">
      <PageHeader
        eyebrow="İş arayan paneli"
        title="Bildirimler"
        lede="Başvuru, atama ve hesap güvenliği bildirimlerin burada toplanır. Bildirim kanallarını hesap ayarlarından seçebilirsin."
      />
      {"failure" in result ? (
        <ErrorState errorCode={result.failure.errorCode} status={result.failure.httpStatus} />
      ) : (
        <NotificationsFeed
          feed={result.feed}
          markReadAction={markNotificationReadAction}
          markAllReadAction={markAllNotificationsReadAction}
        />
      )}
    </PagePanel>
  );
}

/** `?sayfa=` 1 tabanlı; backend 0 tabanlı sayfa ister, geçersiz değer ilk sayfaya düşer. */
function pageFrom(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,5}$/.test(value)) return 0;
  return Number(value) - 1;
}
