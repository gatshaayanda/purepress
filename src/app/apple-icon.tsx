import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          left: 39,
          top: 37,
          width: 51,
          height: 51,
          borderRadius: "50%",
          background: "#EC168C",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 35,
          top: 76,
          width: 41,
          height: 41,
          borderRadius: "50%",
          background: "#FFE500",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 71,
          top: 53,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#00AEEF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 58,
          width: 43,
          height: 42,
          borderRadius: "0 21px 21px 0",
          background: "#FFFFFF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          top: 58,
          width: 9,
          height: 57,
          background: "#FFFFFF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 73,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: "#00AEEF",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 83,
          top: 99,
          width: 5,
          height: 41,
          borderRadius: 3,
          background: "#EC168C",
        }}
      />
    </div>,
    size,
  );
}
