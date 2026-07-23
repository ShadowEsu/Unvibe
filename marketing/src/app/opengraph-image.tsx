import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Unvibe — Don't feel guilty about vibe coding. Make the code yours.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "62px 72px",
        background: "#faf7f0",
        color: "#21172f",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 25, fontWeight: 700 }}>
        <div style={{ width: 24, height: 24, display: "flex", background: "#6f45d2", boxShadow: "10px 10px 0 #cbb9ef" }} />
        Unvibe
      </div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
        <div style={{ color: "#6f45d2", fontSize: 18, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>A learning layer for AI-generated code</div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 22, fontSize: 76, fontWeight: 750, lineHeight: .95, letterSpacing: -4 }}>
          <span>Don&apos;t feel guilty about vibe coding.</span>
          <span style={{ color: "#6f45d2" }}>Make the code yours.</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 21, color: "#655a70" }}>
        <span>AI writes the code. Unvibe helps you understand it.</span>
        <span style={{ fontWeight: 700, color: "#4f2aa9" }}>unvibe.site</span>
      </div>
      <div style={{ position: "absolute", width: 180, height: 180, right: -45, top: 40, display: "flex", background: "#eee5ff", boxShadow: "-40px 40px 0 #e3d6fa, -80px 80px 0 #f3ecff" }} />
    </div>,
    size
  );
}
