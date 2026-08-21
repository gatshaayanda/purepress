import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f0e7" }}>
      <div style={{ width: 144, height: 144, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 36, background: "#3157ff", color: "#c9f65d", fontSize: 82, fontWeight: 900 }}>B</div>
    </div>,
    { ...size }
  );
}

