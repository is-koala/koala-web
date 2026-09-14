/**
 * Adlandırılmış marka renkleri; `globals.css` `:root` ile aynı değerler
 * (`contrast.test.ts` eşitliği ve AA kontrastını tutar).
 *
 * İki yeşil bilinçli: `green` tasarım sisteminin marka rengi ama beyaz
 * üstünde 2,1:1 — yazı için değil. `greenInk` yazı, düğme dolgusu ve odak
 * halkası; `greenDeep` hover ve koyu yeşil yüzeyler (kampanya, işveren kartı).
 */
export const brandTokens = {
  green: "#82C180",
  greenInk: "#3F7A3D",
  greenDeep: "#2E5C2C",
  ink: "#212121",
  paper: "#FFFFFF",
  surface: "#F5F5F5",
  muted: "#616161",
  subtle: "#6F6F6F",
  /* Durum rozetleri: yıkama zemin, mürekkep yazı (`--*-ink`). `--*-strong`
     tonları yıkama üstünde AA'yı geçmediği için yazıya girmez. */
  status: {
    success: { ink: "#2E6B31", wash: "#E8F5E9" },
    warning: { ink: "#8A5300", wash: "#FFF3E0" },
    info: { ink: "#2A56A8", wash: "#EBF1FD" },
    pending: { ink: "#7B1FA2", wash: "#F3E5F5" },
    danger: { ink: "#8c2424", wash: "#fff0ed" },
    neutral: { ink: "#424242", wash: "#EEEEEE" },
  },
  ratingInk: "#7A5200",
} as const;
