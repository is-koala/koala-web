// @vitest-environment node
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicErrorState } from "./public-states";

describe("herkese açık hata kartının sunucu çizimi", () => {
  it("katalogda olmayan kodu askıya girmeden doğrudan HTML'e yazar", async () => {
    // `backend-error-families.ts` sunucuda haritayı modül değerlendirilirken
    // yüklüyor (is-koala/koala-web#184). O satır olmazsa sunucu sayfasının
    // kartı (`/is-ilanlari`, `/hesap-dogrula`) ilk çizimde askıya girer ve
    // JavaScript'siz ziyaretçi kartı akışın sonundaki saklı bir parçada bulur.
    //
    // Test yükleyiciyi kendisi çağırmıyor — çağırsa haritayı o yükler ve satır
    // silindiğinde de yeşil kalırdı. Yalnız aynı modülün inmesini ve sözün
    // `then` zincirinin işlemesini bekliyor; yüklemeyi başlatan tek şey
    // modülün kendi değerlendirmesi.
    await import("@/lib/backend-error-codes");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const html = renderToString(<PublicErrorState errorCode="VALIDATION_FAILED" status={400} />);

    expect(html).toContain("Bilgileri kontrol et");
    expect(html).toContain('role="alert"');
    // `<!--$?-->` bekleyen, `<!--$!-->` istemciye bırakılmış Suspense sınırı.
    expect(html).not.toContain("<!--$?");
    expect(html).not.toContain("<!--$!");
  });
});
