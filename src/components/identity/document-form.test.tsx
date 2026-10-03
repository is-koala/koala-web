import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityDocumentForm } from "./document-form";

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe("kimlik belge formu", () => {
  it("dört fotoğrafı genel Server Action yerine dar BFF yükleme ucuna gönderir", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: "done" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<IdentityDocumentForm firstName="Yusuf" lastName="Acmaci" />);

    fireEvent.change(screen.getByLabelText("Doğum tarihi"), {
      target: { value: "1998-04-12" },
    });
    await user.type(screen.getByLabelText("T.C. kimlik numarası"), "10000000146");
    await user.type(screen.getByLabelText("Kimlik seri numarası"), "A01A00000");
    await user.upload(screen.getByLabelText("Yüz fotoğrafı"), photo("yuz.jpg"));
    await user.upload(screen.getByLabelText("Kimlik ön yüzü"), photo("on.jpg"));
    await user.upload(screen.getByLabelText("Kimlik arka yüzü"), photo("arka.png", "image/png"));
    await user.upload(screen.getByLabelText("Kimlik yüzün altında"), photo("birlikte.jpg"));

    const submit = screen.getByRole("button", { name: "İncelemeye gönder" });
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/users/me/identity-documents");
    expect(init).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(init.body).toBeInstanceOf(FormData);
    expect(await screen.findByRole("heading", { name: "Belgelerin incelemeye alındı" })).toBeVisible();
  });

  it("toplam boyut reddini formun içinde Türkçe gösterir", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      status: "error",
      errorCode: "VALIDATION_FAILED",
      httpStatus: 400,
      fieldErrors: {
        photos: "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
      },
    }, { status: 400 })));
    render(<IdentityDocumentForm firstName="Yusuf" lastName="Acmaci" />);

    const submit = screen.getByRole("button", { name: "İncelemeye gönder" });
    fireEvent.submit(submit.closest("form")!);

    expect(await screen.findByText(
      "Dört fotoğrafın toplam boyutu en fazla 40 MB olabilir.",
    )).toBeVisible();
  });

  it("yükleme sırasında biten oturumu güvenli dönüş hedefiyle giriş sayfasına taşır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    }, { status: 401 })));
    render(<IdentityDocumentForm firstName="Yusuf" lastName="Acmaci" />);

    const submit = screen.getByRole("button", { name: "İncelemeye gönder" });
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/giris?next=%2Fkimlik-dogrula");
    });
  });

  it("oturum biterse kimlik ekranının güvenli dönüş yolunu giriş sonrasına taşır", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    }, { status: 401 })));
    render(
      <IdentityDocumentForm
        firstName="Yusuf"
        lastName="Acmaci"
        returnPath="/isveren/ilan/yeni"
      />,
    );

    const submit = screen.getByRole("button", { name: "İncelemeye gönder" });
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        "/giris?next=%2Fkimlik-dogrula%3Fnext%3D%252Fisveren%252Filan%252Fyeni",
      );
    });
  });

  it("dış next değerini giriş dönüş hedefine dönüştürmez", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      status: "error",
      errorCode: "AUTHENTICATION_REQUIRED",
      httpStatus: 401,
    }, { status: 401 })));
    render(
      <IdentityDocumentForm
        firstName="Yusuf"
        lastName="Acmaci"
        returnPath="https://evil.example/phish"
      />,
    );

    const submit = screen.getByRole("button", { name: "İncelemeye gönder" });
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/giris?next=%2Fkimlik-dogrula");
    });
  });
});

function photo(name: string, type = "image/jpeg"): File {
  return new File(["photo"], name, { type });
}
