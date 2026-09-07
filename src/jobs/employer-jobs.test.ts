import { describe, expect, it } from "vitest";

import {
  defaultJobSort,
  jobSortOptions,
  parseJobSort,
  sortableJobFields,
} from "./employer-jobs";

describe("ilan listesinin sıralaması", () => {
  it("yalnız sunucunun izin verdiği dört alanı sunar", () => {
    // `JobManager.SORTABLE_FIELDS` bu dördü tanıyor; listede olmayan bir alan
    // `PAGE_SORT_FIELD_NOT_ALLOWED` ile 400 dönüyor
    // (`PageableSanitizer.rejectUnknownSort`). UI'ın beşinci bir seçenek
    // sunması, kullanıcıya tıklandığında hata veren bir düğme vermek olurdu.
    expect([...sortableJobFields].sort()).toEqual([
      "createdAt",
      "salary",
      "startDateTime",
      "title",
    ]);
  });

  it("her seçeneği izin verilen bir alana dayandırır", () => {
    for (const option of jobSortOptions) {
      expect(sortableJobFields, option.value).toContain(option.value.split(",")[0]);
    }
  });

  it("adres çubuğundan gelen tanınmayan sıralamayı sunucuya hiç sormaz", () => {
    // Değer kullanıcıdan geliyor: elle yazılmış bir alan doğrudan `sort`
    // parametresine geçseydi liste hata ekranına düşerdi.
    expect(parseJobSort("password,desc")).toBe(defaultJobSort);
    expect(parseJobSort(undefined)).toBe(defaultJobSort);
    expect(parseJobSort(["title,asc", "salary,desc"])).toBe(defaultJobSort);
  });

  it("tanıdığı sıralamayı olduğu gibi taşır", () => {
    expect(parseJobSort("title,asc")).toBe("title,asc");
  });
});
