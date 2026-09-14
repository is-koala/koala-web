import Image from "next/image";

import { jobCategories, type JobCategoryCode } from "@/content/marketing";

export function categoryOf(code: JobCategoryCode) {
  return jobCategories.find((category) => category.code === code)!;
}

/**
 * Kategori pini. SVG olduğu için `next/image` dönüştürmez (`unoptimized`);
 * yine de boyutları yazılı ki düzen kaymasın. Pin kare kutuya sığdırılır
 * (mockup'taki gibi): SVG dik dörtgen ve global `img { height: auto }`
 * kuralı onu kutudan taşırırdı. Dekoratif: adını yanındaki metin ya da
 * kapsayıcı verir, `alt` boş.
 */
export function CategoryPin({ code, size }: { code: JobCategoryCode; size: number }) {
  return (
    <Image
      src={categoryOf(code).pin}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="mk-pin"
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
