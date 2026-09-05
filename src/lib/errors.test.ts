import { describe, expect, it } from "vitest";
import { errorPresentation } from "./errors";

describe("API hata sunumu", () => {
  it("oturum hatasını yeniden giriş eylemine dönüştürür", () => {
    expect(errorPresentation("TOKEN_EXPIRED", 401)).toEqual({
      title: "Oturumun sona erdi",
      message: "Devam etmek için yeniden giriş yap.",
      action: "login",
    });
  });

  it("backend mesaj anahtarından gelen birleşik NOTFOUND kodunu tanır", () => {
    expect(errorPresentation("LOCATION_CITY_NOTFOUND_ID", 404)).toEqual({
      title: "İçerik bulunamadı",
      message: "Aradığın kayıt artık mevcut olmayabilir.",
      action: "home",
    });
  });

  it("backend hız sınırı kodunu yeniden deneme eylemine dönüştürür", () => {
    expect(errorPresentation("AUTH_TOO_MANY_REQUESTS", 429)).toEqual({
      title: "Çok fazla deneme yaptın",
      message: "Kısa bir süre bekleyip yeniden dene.",
      action: "retry",
    });
  });

  it("bilinmeyen backend mesajını kullanıcıya göstermez", () => {
    expect(errorPresentation("NEW_INTERNAL_DETAIL", 500)).toEqual({
      title: "Bir sorun oluştu",
      message: "İşlemi şu anda tamamlayamadık. Biraz sonra yeniden dene.",
      action: "retry",
    });
  });
});
