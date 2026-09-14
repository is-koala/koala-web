import { ImageResponse } from "next/og";

import { brandTokens } from "@/brand/tokens";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 18, background: brandTokens.green, color: "white", fontSize: 40, fontWeight: 800 }}>K</div>,
    size,
  );
}
