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
} as const;
