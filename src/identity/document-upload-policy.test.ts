import { describe, expect, it } from "vitest";

import {
  identityDocumentUploadPath,
  identityPhotoContentMaxBytes,
  identityPhotoFileMaxBytes,
  identityPhotoSlots,
  identityPhotoTransportMaxBytes,
} from "./document-upload-policy";

describe("kimlik fotoğrafı yükleme bütçesi", () => {
  it("10/40/42 MiB ilişkisini tek sözleşmede tutar", () => {
    const mebibyte = 1024 * 1024;

    expect(identityPhotoSlots).toHaveLength(4);
    expect(identityPhotoFileMaxBytes).toBe(10 * mebibyte);
    expect(identityPhotoContentMaxBytes).toBe(
      identityPhotoSlots.length * identityPhotoFileMaxBytes,
    );
    expect(identityPhotoTransportMaxBytes).toBe(identityPhotoContentMaxBytes + 2 * mebibyte);
    expect(identityDocumentUploadPath).toBe("/api/users/me/identity-documents");
  });
});
