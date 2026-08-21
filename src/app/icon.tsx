import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  const squares = Array.from({ length: 16 });
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f0e7" }}>
      <div style={{ width: 392, height: 392, padding: 54, display: "flex", flexWrap: "wrap", background: "#3157ff", borderRadius: 92, position: "relative" }}>
        {squares.map((_, index) => <div key={index} style={{ width: "25%", height: "25%", background: (index + Math.floor(index / 4)) % 2 === 0 ? "#101923" : "#f4f0e7" }} />)}
        <div style={{ position: "absolute", left: 104, top: 212, width: 210, height: 42, borderLeft: "24px solid #c9f65d", borderBottom: "24px solid #c9f65d", transform: "rotate(-45deg)" }} />
      </div>
    </div>,
    { ...size }
  );
}

