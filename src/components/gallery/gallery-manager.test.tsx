import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GalleryImage, GalleryMutationState } from "@/lib/gallery";

import { GalleryManager } from "./gallery-manager";

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const companyImageId = "33333333-3333-4333-8333-333333333333";

afterEach(cleanup);

describe("galeri yöneticisi", () => {
  it("boş galeriyi tanımlar ve yükleme düğmesini açık bırakır", () => {
    render(manager());

    expect(screen.getByRole("status")).toHaveTextContent("Henüz görsel yok");
    expect(screen.getByText("Görsel seç")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Şirket galerimden seç" })).toBeNull();
  });

  it("şirket galerisi yoksa seçme bölümünü çizmez", () => {
    render(manager({ companyImages: null }));

    expect(screen.queryByRole("heading", { name: "Şirket galerimden seç" })).toBeNull();
  });

  it("şirket galerisinden seçilen görseli tam listeyle bağlar, şirketten silmez", async () => {
    const replaceAction = vi.fn(async (form: FormData) =>
      done(JSON.parse(String(form.get("images"))) as GalleryImage[]),
    );
    render(
      manager({
        replaceAction,
        companyImages: [image(companyImageId, { caption: "Mutfak", cover: false })],
      }),
    );

    await userEvent.click(screen.getByRole("button", { name: "İlana ekle" }));

    await waitFor(() => expect(replaceAction).toHaveBeenCalled());
    const submitted = JSON.parse(String(replaceAction.mock.calls[0][0].get("images")));
    expect(submitted).toEqual([
      expect.objectContaining({ id: companyImageId, cover: true, caption: "Mutfak" }),
    ]);
    expect(screen.getByRole("heading", { name: "Şirket galerimden seç" })).toBeVisible();
    expect(screen.getByRole("button", { name: "İlanda" })).toBeDisabled();
  });

  it("desteklenmeyen türü sunucuya hiç göndermez", async () => {
    const uploadAction = vi.fn();
    render(manager({ uploadAction }));

    const input = screen.getByLabelText("Görsel seç");
    fireEvent.change(input, {
      target: { files: [new File(["<svg/>"], "zararli.svg", { type: "image/svg+xml" })] },
    });

    expect(uploadAction).not.toHaveBeenCalled();
    expect(screen.getByText("PNG, JPG, JPEG veya WEBP biçiminde bir görsel seç.")).toBeVisible();
  });

  it("yüklenen görseli listede gösterir; biri düşerse diğerleri devam eder", async () => {
    const uploadAction = vi
      .fn()
      .mockResolvedValueOnce({
        status: "error",
        errorCode: "IMAGE_UPLOAD_ERROR",
        httpStatus: 400,
        fieldErrors: { image: "Görseli şu anda yükleyemedik. Biraz sonra yeniden dene." },
      } satisfies GalleryMutationState)
      .mockResolvedValueOnce(done([image(secondId, { cover: true })]));

    render(manager({ uploadAction }));

    await userEvent.upload(screen.getByLabelText("Görsel seç"), [
      new File(["a"], "ilk.webp", { type: "image/webp" }),
      new File(["b"], "ikinci.webp", { type: "image/webp" }),
    ]);

    await waitFor(() => expect(uploadAction).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Görseli şu anda yükleyemedik/)).toBeVisible();
    expect(screen.getByRole("img", { name: "Galeri görseli" })).toBeVisible();
  });

  it("kota dolunca yüklemeyi kalıcı olarak kapatır", () => {
    render(manager({ initialImages: Array.from({ length: 10 }, (_, index) =>
      image(`aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`, {
        cover: index === 0,
        sortOrder: index,
      }),
    ) }));

    expect(screen.getByRole("button", { name: "Görsel yükle" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Görsel yükle" })).toHaveAttribute(
      "data-disabled-kind",
      "permanent",
    );
    expect(screen.getByText(/Galeri kotası doldu/)).toBeVisible();
  });

  it("kapağı tek seçimle değiştirir ve tam listeyi gönderir", async () => {
    const replaceAction = vi.fn(async (form: FormData) => {
      void form;
      return done([
        image(firstId, { cover: false }),
        image(secondId, { cover: true, sortOrder: 1 }),
      ]);
    });
    render(
      manager({
        initialImages: [image(firstId, { cover: true }), image(secondId, { sortOrder: 1 })],
        replaceAction,
      }),
    );

    await userEvent.click(screen.getAllByRole("radio", { name: "Kapak" })[1]);

    await waitFor(() => expect(replaceAction).toHaveBeenCalled());
    const submitted = JSON.parse(String(replaceAction.mock.calls[0][0].get("images"))) as GalleryImage[];
    expect(submitted.filter((entry) => entry.cover).map((entry) => entry.id)).toEqual([secondId]);
  });

  it("sürüklenen görseli tam listedeki yeni konumuna yazar", async () => {
    const replaceAction = vi.fn(async (form: FormData) => {
      const images = JSON.parse(String(form.get("images"))) as GalleryImage[];
      return done(images);
    });
    render(
      manager({
        initialImages: [image(firstId, { cover: true, caption: "Bir" }), image(secondId, { caption: "İki", sortOrder: 1 })],
        replaceAction,
      }),
    );

    const rows = screen.getAllByRole("listitem");
    const dataTransfer = { effectAllowed: "move", setData: vi.fn(), getData: vi.fn() };
    await act(async () => {
      fireEvent.dragStart(rows[0], { dataTransfer });
    });
    await act(async () => {
      fireEvent.drop(rows[1], { dataTransfer });
    });

    await waitFor(() => expect(replaceAction).toHaveBeenCalled());
    expect(JSON.parse(String(replaceAction.mock.calls[0][0].get("images"))).map((entry: GalleryImage) => entry.id)).toEqual([
      secondId,
      firstId,
    ]);
  });
});

function manager({
  initialImages = [],
  companyImages,
  uploadAction = vi.fn(async () => ({ status: "idle" }) as const),
  replaceAction = vi.fn(async () => ({ status: "idle" }) as const),
}: {
  initialImages?: readonly GalleryImage[];
  companyImages?: readonly GalleryImage[] | null;
  uploadAction?: (formData: FormData) => Promise<GalleryMutationState>;
  replaceAction?: (formData: FormData) => Promise<GalleryMutationState>;
} = {}) {
  return (
    <GalleryManager
      initialImages={initialImages}
      companyImages={companyImages}
      uploadAction={uploadAction}
      replaceAction={replaceAction}
    />
  );
}

function done(images: readonly GalleryImage[]): GalleryMutationState {
  return { status: "done", images };
}

function image(id: string, overrides: Partial<GalleryImage> = {}): GalleryImage {
  return {
    id,
    url: `https://cdn.example.test/${id}.webp`,
    caption: overrides.caption ?? null,
    cover: false,
    sortOrder: 0,
    ...overrides,
  };
}
