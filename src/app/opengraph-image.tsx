import { ImageResponse } from "next/og";
import { SITE } from "@/constants/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
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
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          padding: 80,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              color: "#09090b",
            }}
          >
            G
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{SITE.name}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
            Devenez n°1 sur les IA
          </div>
          <div style={{ fontSize: 28, color: "#a1a1aa", maxWidth: 900 }}>
            {`${SITE.tagline} — mesure et corrige votre visibilité sur ChatGPT, Gemini et Google.`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
