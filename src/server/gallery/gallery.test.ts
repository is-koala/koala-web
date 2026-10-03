import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { galleryPutBody, galleryQuotaReason } from "@/lib/gallery";
import { ApiError } from "@/server/api/errors";

import { sessionExpiryRedirect } from "../../../tests/support/control-flow";

import {
  cookieStore,
  envelope,
  jsonResponse,
  requestHeaders,
} from "../../../tests/support/session-cookies";

import {
  listCompanyImages,
  listJobImages,
  replaceJobGallery,
  replaceWithRules,
  uploadJobImage,
  uploadWithPrecheck,
} from "./gallery";

const deviceId = "b7b1f0d24c2f4f6c8a9e5d3c1b0a7f6e";
const jobId = "9c1f0d24-4c2f-4f6c-8a9e-5d3c1b0a7f60";
const companyId = "5d3c1b0a-7f60-4c2f-8a9e-9c1f0d244f6c";
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

vi.mock("next/headers", async () => {
  const support = await import("../../../tests/support/session-cookies");
  return {
    cookies: () => Promise.resolve(support.cookieStore),
    headers: () => Promise.resolve(support.requestHeaders),
  };
});

describe("galeri BFF sözleşmesi", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "https://api.example.test");
    vi.stubEnv("APP_VERSION", "1.4.0");
    requestHeaders.delete("x-real-ip");
    cookieStore.values.clear();
    cookieStore.values.set("koala_did", deviceId);
    cookieStore.values.set("koala_at", "access-placeholder");
    cookieStore.values.set("koala_rt", "refresh-placeholder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ilan galerisini Image.id ile okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, envelope([
        {
          id: firstId,
          url: "https://cdn.example.test/a.webp",
          caption: "Mutfak",
          cover: true,
          sortOrder: 0,
        },
      ])),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(listJobImages(jobId)).resolves.toEqual([
      {
        id: firstId,
        url: "https://cdn.example.test/a.webp",
        caption: "Mutfak",
        cover: true,
        sortOrder: 0,
      },
    ]);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      `https://api.example.test/jobs/${jobId}/images`,
    );
  });

  it("şirket galerisini şirketin kendi ucundan okur", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await listCompanyImages(companyId);

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      `https://api.example.test/companies/${companyId}/images`,
    );
  });

  it("yüklemeyi image parçasıyla, Content-Type elle koymadan gönderir", async () => {
    const image = new File(["koala"], "mekan.jpg", { type: "image/jpeg" });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await uploadJobImage(jobId, image);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("image")).toBe(image);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false);
  });

  it("PUT gövdesini tam liste olarak, yalnız DTO alanlarıyla gönderir", async () => {
    const put = galleryPutBody([
      {
        id: firstId,
        url: "https://cdn.example.test/a.webp",
        caption: "Mutfak",
        cover: true,
        sortOrder: 4,
      },
      {
        id: secondId,
        url: "https://cdn.example.test/b.webp",
        caption: null,
        cover: false,
        sortOrder: 9,
      },
    ]);
    if (!put.ok) throw new Error("beklenen gövde reddedildi");

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope([])));
    vi.stubGlobal("fetch", fetchMock);

    await replaceJobGallery(jobId, put.body);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      images: [
        { imageId: firstId, sortOrder: 0, cover: true, caption: "Mutfak" },
        { imageId: secondId, sortOrder: 1, cover: false, caption: null },
      ],
    });
    expect(JSON.parse(String(init.body)).images[0].id).toBeUndefined();
  });
});

describe("yükleme ve toptan yazma kuralları", () => {
  it("desteklenmeyen türü listeye hiç sormadan reddeder", async () => {
    const list = vi.fn();
    const upload = vi.fn();

    await expect(
      uploadWithPrecheck(new File(["<svg/>"], "zararli.svg", { type: "image/svg+xml" }), list, upload),
    ).resolves.toMatchObject({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      fieldErrors: { image: "PNG, JPG veya JPEG biçiminde bir görsel seç." },
    });
    expect(list).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("WebP'yi yüklemeye göndermeden reddeder", async () => {
    // Backend WebP'yi okuyamıyor (koala-backend#348); gönderilse kota
    // turu ve yükleme boşa gider, kullanıcı belirsiz bir ret alırdı.
    const list = vi.fn();
    const upload = vi.fn();

    await expect(
      uploadWithPrecheck(new File(["koala"], "mekan.webp", { type: "image/webp" }), list, upload),
    ).resolves.toMatchObject({
      fieldErrors: { image: "PNG, JPG veya JPEG biçiminde bir görsel seç." },
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("kota yokken dosyayı yükleme ucuna hiç göndermez", async () => {
    const list = vi.fn().mockResolvedValue(Array.from({ length: 10 }, (_, index) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`,
      url: `https://cdn.example.test/${index}.webp`,
      caption: null,
      cover: index === 0,
      sortOrder: index,
    })));
    const upload = vi.fn();

    await expect(
      uploadWithPrecheck(new File(["koala"], "mekan.jpg", { type: "image/jpeg" }), list, upload),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { image: galleryQuotaReason },
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("409 sonrası kalan yeri GET listesinden okur", async () => {
    const listed = [
      {
        id: firstId,
        url: "https://cdn.example.test/a.webp",
        caption: null,
        cover: true,
        sortOrder: 0,
      },
    ];
    const list = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(listed);
    const upload = vi.fn().mockRejectedValue(
      new ApiError({
        status: 409,
        errorCode: "GALLERY_LIMIT_EXCEEDED",
        errorCategory: "CONFLICT",
        message: "ham mesaj",
      }),
    );

    await expect(
      uploadWithPrecheck(new File(["koala"], "mekan.jpg", { type: "image/jpeg" }), list, upload),
    ).resolves.toEqual({
      status: "error",
      errorCode: "GALLERY_LIMIT_EXCEEDED",
      httpStatus: 409,
      images: listed,
    });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("yükleme sırasında biten oturumun yönlendirmesini hata durumuna dönüştürmez", async () => {
    // Çağıran action `unstable_rethrow` taşıyor ama bu catch ondan önce
    // duruyor: burada yutulan yönlendirme oraya hiç ulaşmaz.
    const interrupt = sessionExpiryRedirect("/giris?next=%2Fisveren%2Filan");
    const list = vi.fn().mockResolvedValue([]);
    const upload = vi.fn().mockRejectedValue(interrupt);

    await expect(
      uploadWithPrecheck(new File(["koala"], "mekan.jpg", { type: "image/jpeg" }), list, upload),
    ).rejects.toBe(interrupt);
  });

  it("toptan yazma sırasında biten oturumun yönlendirmesini hata durumuna dönüştürmez", async () => {
    const interrupt = sessionExpiryRedirect("/giris?next=%2Fisveren%2Filan");
    const write = vi.fn().mockRejectedValue(interrupt);

    await expect(
      replaceWithRules(
        [{ id: firstId, url: "https://cdn.example.test/a.webp", caption: null, cover: true, sortOrder: 0 }],
        write,
      ),
    ).rejects.toBe(interrupt);
  });

  it("toptan yazmanın backend arızasını koddan seçilen duruma çevirir", async () => {
    const write = vi.fn().mockRejectedValue(
      new ApiError({
        status: 503,
        errorCode: "EXTERNAL_SERVICE",
        errorCategory: "EXTERNAL_SERVICE",
        message: "ham mesaj",
      }),
    );

    await expect(
      replaceWithRules(
        [{ id: firstId, url: "https://cdn.example.test/a.webp", caption: null, cover: true, sortOrder: 0 }],
        write,
      ),
    ).resolves.toEqual({ status: "error", errorCode: "EXTERNAL_SERVICE", httpStatus: 503 });
  });

  it("aynı görseli iki kez yazmayı ağa hiç göndermez", async () => {
    const write = vi.fn();

    await expect(
      replaceWithRules(
        [
          {
            id: firstId,
            url: "https://cdn.example.test/a.webp",
            caption: null,
            cover: true,
            sortOrder: 0,
          },
          {
            id: firstId,
            url: "https://cdn.example.test/a.webp",
            caption: null,
            cover: false,
            sortOrder: 1,
          },
        ],
        write,
      ),
    ).resolves.toMatchObject({
      status: "error",
      fieldErrors: { images: "Aynı görsel galeride bir kez yer alabilir." },
    });
    expect(write).not.toHaveBeenCalled();
  });
});
