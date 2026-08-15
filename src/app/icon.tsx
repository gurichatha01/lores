import { ImageResponse } from "next/og";

// Tab favicon: the "lores_" wordmark's signature — ink background, the pink
// underscore accent that distinguishes the brand at any size.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "Arial, sans-serif",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-1px",
          }}
        >
          <span style={{ color: "#f3f3ef" }}>l</span>
          <span style={{ color: "#ff2d78" }}>_</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
