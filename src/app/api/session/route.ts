import { unstable_rethrow } from "next/navigation";

import type { AppShellId } from "@/lib/app-routes";
import { readSession } from "@/server/session/session";
import { viewerShell } from "@/server/session/viewer";

export const dynamic = "force-dynamic";

export type SessionStatus = {
  authenticated: boolean;
  /** Oturum açık kullanıcının kabuğu; profil okunamadıysa `null`. */
  shell: AppShellId | null;
};

/**
 * Başlığın oturum durumunu sorduğu tek uç.
 *
 * Tanıtım ve yasal sayfalar statik üretiliyor (`AGENTS.md` "Yapı"); başlık
 * çerezi render sırasında okusaydı hepsi istek başına render edilirdi. Bu
 * yüzden durum tarayıcıdan sorulur. Dönen şey bir doğru/yanlış ve kabuk adı:
 * token ne gövdeye ne de JavaScript'e çıkar (ADR-0011).
 *
 * Kabuk için oturum açıkken `GET /users/me` okunuyor — başlık "Panelim" ile
 * "İşveren panelim" arasında seçim yapıyor (is-koala/koala-web#154). Profil
 * okunamazsa kabuk `null` kalır ve başlık genel bağlantıya düşer; oturum
 * bitmişse profil okuyucusu girişe yönlendirir ve o yönlendirme burada
 * yutulmaz.
 */
export async function GET() {
  const { refreshToken } = await readSession();
  if (!refreshToken) return respond({ authenticated: false, shell: null });

  let shell: AppShellId | null = null;
  try {
    shell = await viewerShell();
  } catch (error) {
    unstable_rethrow(error);
  }
  return respond({ authenticated: true, shell });
}

function respond(status: SessionStatus): Response {
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
