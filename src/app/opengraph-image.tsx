import { ImageResponse } from "next/og";

import { brandTokens } from "@/brand/tokens";

export const alt = "Koala — Boş vaktini paraya çevir";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#FFFFFF", color: brandTokens.ink, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 18, background: brandTokens.green, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800 }}>K</div>
        <span style={{ fontSize: 44, fontWeight: 800, color: brandTokens.greenInk, letterSpacing: 2 }}>KOALA</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>
        <span>Boş vaktini</span>
        <span style={{ color: brandTokens.greenInk }}>paraya çevir.</span>
      </div>
    </div>,
    size,
  );
}
