"use client";

import { useRef, useState, type DragEvent } from "react";

import { ErrorState, EmptyState } from "@/components/states";
import { errorPresentation } from "@/lib/errors";
import {
  galleryAccept,
  galleryCaptionLimit,
  galleryQuotaReason,
  precheckGalleryUpload,
  remainingSlotsAfterLimit,
  remainingSlotsBeforeLimit,
  type GalleryImage,
  type GalleryMutationState,
} from "@/lib/gallery";

type UploadRow = {
  readonly name: string;
  readonly status: "uploading" | "error";
  readonly reason?: string;
};

export function GalleryManager({
  initialImages,
  companyImages,
  uploadAction,
  replaceAction,
}: {
  initialImages: readonly GalleryImage[];
  /** `null` / yok: bireysel ilan; şirket ilanında şirket galerisi. */
  companyImages?: readonly GalleryImage[] | null;
  uploadAction: (formData: FormData) => Promise<GalleryMutationState>;
  replaceAction: (formData: FormData) => Promise<GalleryMutationState>;
}) {
  const [images, setImages] = useState(initialImages);
  const [uploads, setUploads] = useState<readonly UploadRow[]>([]);
  const [mutation, setMutation] = useState<GalleryMutationState>({ status: "idle" });
  const [countWhenExhausted, setCountWhenExhausted] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const remaining =
    countWhenExhausted === null
      ? remainingSlotsBeforeLimit(images.length)
      : remainingSlotsAfterLimit(images.length, countWhenExhausted);
  const quotaClosed = remaining <= 0;

  async function persist(next: readonly GalleryImage[]) {
    const form = new FormData();
    form.set("images", JSON.stringify(next));
    const result = await replaceAction(form);
    applyResult(result, next);
  }

  function applyResult(result: GalleryMutationState, fallback: readonly GalleryImage[]) {
    setMutation(result);
    if (result.status === "done") {
      setImages(result.images);
      if (countWhenExhausted !== null && result.images.length < countWhenExhausted) {
        setCountWhenExhausted(null);
      }
      return;
    }
    if (result.status === "error" && result.errorCode === "GALLERY_LIMIT_EXCEEDED") {
      const listed = result.images ?? fallback;
      setImages(listed);
      setCountWhenExhausted(listed.length);
    }
  }

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList];
    if (fileInput.current) fileInput.current.value = "";
    let listed = images;
    /*
     * Kota 409'u döngünün içinde düşebilir. State güncellemesi bir sonraki
     * turda gelir; aynı seçimdeki sonraki dosya bayat `countWhenExhausted`
     * ile kotayı yeniden aşardı.
     */
    let exhausted = countWhenExhausted;

    for (const file of files) {
      const slots =
        exhausted === null
          ? remainingSlotsBeforeLimit(listed.length)
          : remainingSlotsAfterLimit(listed.length, exhausted);
      const check = precheckGalleryUpload(file, slots);
      if (!check.ok) {
        setUploads((current) => [
          ...current.filter((item) => item.name !== file.name),
          { name: file.name, status: "error", reason: check.reason },
        ]);
        continue;
      }

      setUploads((current) => [
        ...current.filter((item) => item.name !== file.name),
        { name: file.name, status: "uploading" },
      ]);
      const form = new FormData();
      form.set("image", file);
      const result = await uploadAction(form);
      if (result.status === "done") {
        listed = result.images;
        setUploads((current) => current.filter((item) => item.name !== file.name));
        applyResult(result, listed);
      } else if (result.status === "error") {
        setUploads((current) =>
          current.map((item) =>
            item.name === file.name
              ? {
                  name: file.name,
                  status: "error",
                  reason: uploadFailureReason(result),
                }
              : item,
          ),
        );
        applyResult(result, listed);
        if (result.images) listed = result.images;
        if (result.errorCode === "GALLERY_LIMIT_EXCEEDED") {
          exhausted = (result.images ?? listed).length;
        }
      }
    }
  }

  function onDragStart(id: string) {
    return (event: DragEvent<HTMLLIElement>) => {
      setDraggingId(id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    };
  }

  function onDrop(targetId: string) {
    return async (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const sourceId = draggingId;
      setDraggingId(null);
      if (!sourceId || sourceId === targetId) return;
      const from = images.findIndex((image) => image.id === sourceId);
      const to = images.findIndex((image) => image.id === targetId);
      if (from < 0 || to < 0) return;
      const next = [...images];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setImages(next);
      await persist(next);
    };
  }

  async function setCover(id: string) {
    const next = images.map((image) => ({ ...image, cover: image.id === id }));
    setImages(next);
    await persist(next);
  }

  async function setCaption(id: string, caption: string) {
    const next = images.map((image) =>
      image.id === id ? { ...image, caption: caption.trim() || null } : image,
    );
    setImages(next);
    await persist(next);
  }

  async function remove(id: string) {
    const next = images.filter((image) => image.id !== id);
    setImages(next);
    await persist(next);
  }

  async function attachCompanyImage(image: GalleryImage) {
    if (images.some((entry) => entry.id === image.id)) return;
    const next = [...images, { ...image, cover: images.length === 0, sortOrder: images.length }];
    setImages(next);
    await persist(next);
  }

  return (
    <div className="gallery-manager">
      {mutation.status === "error" ? (
        <ErrorState errorCode={mutation.errorCode} status={mutation.httpStatus} />
      ) : null}

      <section className="app-panel" aria-labelledby="gallery-upload-title">
        <p className="eyebrow">Yükle</p>
        <h2 id="gallery-upload-title">Görsel ekle</h2>
        <p className="lede">PNG, JPG veya JPEG, en fazla 10 MB. Yüklemeler sırayla gider.</p>
        <div className="gallery-upload">
          <input
            ref={fileInput}
            id="gallery-files"
            className="gallery-file-input"
            type="file"
            accept={galleryAccept}
            multiple
            disabled={quotaClosed}
            onChange={(event) => void onFiles(event.target.files)}
          />
          {quotaClosed ? (
            <p className="payment-disabled-reason">
              <button
                type="button"
                className="button button-secondary"
                disabled
                data-disabled-kind="permanent"
              >
                Görsel yükle
              </button>
              <span>{galleryQuotaReason}</span>
            </p>
          ) : (
            <label className="button button-primary" htmlFor="gallery-files">
              Görsel seç
            </label>
          )}
        </div>
        {uploads.length > 0 ? (
          <ul className="gallery-upload-progress">
            {uploads.map((row) => (
              <li key={row.name}>
                <strong>{row.name}</strong>
                {row.status === "uploading" ? " yükleniyor…" : ` ${row.reason}`}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="app-panel" aria-labelledby="gallery-list-title">
        <p className="eyebrow">Galeri</p>
        <h2 id="gallery-list-title">Görseller</h2>
        {images.length === 0 ? (
          <EmptyState kind="gallery" />
        ) : (
          <ul className="gallery-editor">
            {images.map((image) => (
              <li
                key={image.id}
                draggable
                onDragStart={onDragStart(image.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop(image.id)}
                className="gallery-editor-item"
              >
                {/*
                  Düz `<img>`: depolama kökeni `STORAGE_PUBLIC_URL` ile ortamdan
                  geliyor ve `images.remotePatterns`'e tahmini bir desen
                  eklemek yanlış origin'i kilitleyerek kırardı
                  (`src/lib/image-budget.ts`).
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption ?? "Galeri görseli"} />
                <div className="gallery-editor-meta">
                  <label>
                    <input
                      type="radio"
                      name="gallery-cover"
                      checked={image.cover}
                      onChange={() => void setCover(image.id)}
                    />
                    Kapak
                  </label>
                  <label>
                    Açıklama
                    <input
                      type="text"
                      maxLength={galleryCaptionLimit}
                      defaultValue={image.caption ?? ""}
                      onBlur={(event) => void setCaption(image.id, event.target.value)}
                    />
                  </label>
                  <button type="button" className="button button-secondary button-small" onClick={() => void remove(image.id)}>
                    Kaldır
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {companyImages ? (
        <section className="app-panel" aria-labelledby="company-gallery-pick-title">
          <p className="eyebrow">Şirket</p>
          <h2 id="company-gallery-pick-title">Şirket galerimden seç</h2>
          <p className="lede">
            Seçilen görsel şirket galerisinden silinmez; ilana bağlanır.
          </p>
          {companyImages.length === 0 ? (
            <p className="muted">Şirket galerisinde henüz görsel yok.</p>
          ) : (
            <ul className="gallery-picker">
              {companyImages.map((image) => {
                const attached = images.some((entry) => entry.id === image.id);
                return (
                  <li key={image.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.caption ?? "Şirket görseli"} />
                    {attached ? (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        disabled
                        data-disabled-kind="permanent"
                      >
                        İlanda
                      </button>
                    ) : quotaClosed ? (
                      <p className="payment-disabled-reason">
                        <button
                          type="button"
                          className="button button-secondary button-small"
                          disabled
                          data-disabled-kind="permanent"
                        >
                          İlana ekle
                        </button>
                        <span>{galleryQuotaReason}</span>
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => void attachCompanyImage(image)}
                      >
                        İlana ekle
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

function uploadFailureReason(
  result: Extract<GalleryMutationState, { status: "error" }>,
): string {
  if (result.fieldErrors?.image) return result.fieldErrors.image;
  return errorPresentation(result.errorCode, result.httpStatus).message;
}
