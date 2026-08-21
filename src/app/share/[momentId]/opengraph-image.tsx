import { ImageResponse } from "next/og";
import { loadPublicShareMoment } from "@/lib/boardsignal/server/universePulse";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ momentId: string }> }) {
  const { momentId } = await params;
  const moment = await loadPublicShareMoment(momentId);
  if (!moment) {
    return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#07152f", color: "white", fontSize: 64, fontWeight: 800 }}>BOARD SIGNAL</div>, size);
  }
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#07152f", color: "#f7fbff", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 6 }}>BOARD SIGNAL</div>
        <div style={{ color: "#c9ff45", fontSize: 24, fontWeight: 800 }}>REVIEW MOMENT</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ color: "#c9ff45", fontSize: 30, fontWeight: 800, textTransform: "uppercase" }}>{moment.canonicalUsername}</div>
        <div style={{ fontSize: 78, lineHeight: 1.02, fontWeight: 900, maxWidth: 1020 }}>{moment.headline}</div>
        <div style={{ fontSize: 34, color: "#d9e4f5", maxWidth: 1000, lineHeight: 1.25 }}>{moment.supportingFact}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column" }}><span style={{ fontSize: 54, fontWeight: 900 }}>{moment.statValue}</span><span style={{ color: "#a9b8cf", fontSize: 22 }}>{moment.statLabel}</span></div>
        <div style={{ textAlign: "right", fontSize: 24, color: "#c9ff45", fontWeight: 800 }}>See what happened in your last 7 days.</div>
      </div>
    </div>,
    size,
  );
}
