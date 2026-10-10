import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#07070c",
          position: "relative",
          color: "#f2ede3",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        {/* halftone-ish glow layers */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 15% 30%, rgba(255,46,99,0.22), transparent 38%), radial-gradient(circle at 85% 75%, rgba(255,200,87,0.14), transparent 32%)",
          }}
        />
        {/* crimson panel edge */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: "180px solid #ff2e63",
            borderLeft: "180px solid transparent",
            opacity: 0.9,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 80px",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              marginBottom: 40,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#ff2e63",
                fontSize: 34,
                fontWeight: 800,
                color: "#07070c",
              }}
            >
              コ
            </div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 6,
              }}
            >
              KOMA Studio
            </div>
          </div>

          <div
            style={{
              fontSize: 74,
              lineHeight: 1.05,
              fontWeight: 800,
              maxWidth: 900,
              textTransform: "uppercase",
              letterSpacing: -2,
            }}
          >
            Open-Source Scanlation Software
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: "rgba(242,237,227,0.65)",
              maxWidth: 860,
            }}
          >
            Free, MIT-licensed and local-first — translate, clean, redraw, typeset, and
            review in one workflow.
          </div>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              gap: 24,
              fontSize: 20,
              letterSpacing: 4,
              color: "#ff2e63",
              textTransform: "uppercase",
            }}
          >
            <span>MIT</span>
            <span style={{ color: "rgba(242,237,227,0.3)" }}>·</span>
            <span style={{ color: "#3ef2b0" }}>Open Source</span>
            <span style={{ color: "rgba(242,237,227,0.3)" }}>·</span>
            <span style={{ color: "#ffc857" }}>Zero Telemetry</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
