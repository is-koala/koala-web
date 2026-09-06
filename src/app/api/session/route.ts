import { readSession } from "@/server/session/session";

export const dynamic = "force-dynamic";

/**
 * Başlığın oturum durumunu sorduğu tek uç.
 *
 * Tanıtım ve yasal sayfalar statik üretiliyor (`AGENTS.md` "Yapı"); başlık
 * çerezi render sırasında okusaydı hepsi istek başına render edilirdi. Bu
 * yüzden durum tarayıcıdan sorulur. Dönen tek bilgi bir doğru/yanlış: token
 * ne gövdeye ne de JavaScript'e çıkar (ADR-0011).
 */
export async function GET() {
  const { refreshToken } = await readSession();
  return Response.json(
    { authenticated: Boolean(refreshToken) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
