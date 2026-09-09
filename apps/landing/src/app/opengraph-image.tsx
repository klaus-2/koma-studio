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
          background: "#060810",
          position: "relative",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 20% 30%, rgba(168,85,247,0.25), transparent 35%), radial-gradient(circle at 80% 70%, rgba(6,182,212,0.18), transparent 30%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 80px",
            width: "100%",
            zIndex: 1,
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
                borderRadius: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg,#a855f7,#7c3aed)",
                fontSize: 34,
                fontWeight: 800,
              }}
            >
              K
            </div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>KOMA Studio</div>
          </div>

          <div style={{ fontSize: 74, lineHeight: 1.05, fontWeight: 800, maxWidth: 900 }}>
            Open-Source Scanlation Software for Manga, Manhwa, and Comics
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: "rgba(241,245,249,0.82)",
              maxWidth: 860,
            }}
          >
            Free, MIT-licensed and self-hosted — translate, clean, redraw, typeset, and review
            in one workflow.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
