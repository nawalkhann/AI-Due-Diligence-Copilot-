import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name}: ${site.tagline}`;
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
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b1120 0%, #1d4ed8 100%)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 34, opacity: 0.85, marginBottom: 24 }}>{site.name}</div>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 950 }}>
          {site.tagline}
        </div>
        <div style={{ fontSize: 30, opacity: 0.85, marginTop: 32, maxWidth: 950 }}>
          Filings, financials and investor decks in. Cited risk assessments out.
        </div>
      </div>
    ),
    size,
  );
}
