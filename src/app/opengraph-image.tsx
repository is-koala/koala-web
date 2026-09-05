import { ImageResponse } from "next/og";

export const alt = "Koala — Bugünün işi, bugünün insanı";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f4f5f7", color: "#282828", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", fontSize: 52, fontWeight: 800 }}>Koala<span style={{ color: "#f15757" }}>.</span></div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 92, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}><span>Bugünün işi,</span><span>bugünün insanı.</span></div>
    </div>,
    size,
  );
}
