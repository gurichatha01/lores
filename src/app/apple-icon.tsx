import { ImageResponse } from "next/og";

// iOS home-screen / bookmark icon: room to show the full wordmark.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Arial, sans-serif",
            fontWeight: 900,
            fontSize: 56,
            letterSpacing: "-2px",
          }}
        >
          <span style={{ color: "#f3f3ef" }}>lores</span>
          <span style={{ color: "#ff2d78" }}>_</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
