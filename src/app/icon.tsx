import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#FFFFFF",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 105,
          width: 144,
          height: 144,
          borderRadius: "50%",
          background: "#EC168C",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 215,
          width: 116,
          height: 116,
          borderRadius: "50%",
          background: "#FFE500",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 201,
          top: 150,
          width: 149,
          height: 149,
          borderRadius: "50%",
          background: "#00AEEF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 227,
          top: 165,
          width: 123,
          height: 120,
          borderRadius: "0 60px 60px 0",
          background: "#FFFFFF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 227,
          top: 165,
          width: 24,
          height: 160,
          background: "#FFFFFF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 261,
          top: 208,
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#00AEEF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 237,
          top: 282,
          width: 12,
          height: 116,
          borderRadius: 6,
          background: "#EC168C",
        }}
      />
    </div>,
    size,
  );
}
