import { ImageResponse } from "next/og";

export const alt = "Ayanda Kopano Gatsha — Technical Support and SaaS Customer Success";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f7f2ea",
          color: "#171419",
          padding: "70px 78px",
          position: "relative",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", width: "100%", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontFamily: "Arial, sans-serif", fontSize: 20, letterSpacing: "0.14em", color: "#573d5d" }}>
            PROFESSIONAL DOSSIER · GABORONE, BOTSWANA
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 96, lineHeight: 0.88, letterSpacing: "-0.055em" }}>AYANDA KOPANO</div>
            <div style={{ display: "flex", fontSize: 118, lineHeight: 0.88, letterSpacing: "-0.06em" }}>GATSHA</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", width: 78, height: 5, background: "#c65f46" }} />
            <div style={{ display: "flex", fontFamily: "Arial, sans-serif", fontSize: 24, fontWeight: 700 }}>
              Technical Support · SaaS Customer Success · Product Ops
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", right: 0, top: 0, width: 20, height: "100%", background: "#573d5d" }} />
      </div>
    ),
    size,
  );
}
