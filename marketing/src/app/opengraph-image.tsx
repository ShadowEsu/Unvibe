import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import React from "react";

export const alt = "Unvibe: understand the code AI writes for you. Free for Mac and Windows.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f7f4ee";
const INK = "#1b1a17";
const LILAC = "#b8a6ff";
const ACCENT = "#5b3fd1";

/** Vibe, same shape and colours as src/components/paper/Vibe.tsx, without the animation. */
function VibeBlob({ size: px }: { size: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="45.5" rx="12" ry="1.8" fill={INK} fillOpacity="0.14" />
      <path
        d="M24 8C33 8 38.5 14 40 22.5C41.5 31 43 38 37.5 41C32 43.6 16 43.6 10.5 41C5 38 6.5 31 8 22.5C9.5 14 15 8 24 8Z"
        fill={LILAC}
        stroke={INK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <ellipse cx="18.6" cy="24.2" rx="3.3" ry="4.6" fill={INK} />
      <circle cx="17.6" cy="22.6" r="1.15" fill="#fff" />
      <ellipse cx="29.4" cy="24.2" rx="3.3" ry="4.6" fill={INK} />
      <circle cx="28.4" cy="22.6" r="1.15" fill="#fff" />
    </svg>
  );
}

export default async function Image() {
  const root = process.cwd();
  const [newsreader, newsreaderItalic, inter] = await Promise.all([
    readFile(join(root, "src/app/og/Newsreader-Regular.ttf")),
    readFile(join(root, "src/app/og/Newsreader-Italic.ttf")),
    readFile(join(root, "src/app/og/Inter-SemiBold.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          background: PAPER,
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <VibeBlob size={40} />
          <span style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em" }}>
            Unvibe
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 800 }}>
            <div
              style={{
                fontFamily: "Newsreader",
                fontSize: 88,
                lineHeight: 1,
                letterSpacing: "-0.035em",
              }}
            >
              Understand the code
            </div>
            <div
              style={{
                fontFamily: "Newsreader",
                fontStyle: "italic",
                fontSize: 88,
                lineHeight: 1,
                letterSpacing: "-0.035em",
                marginTop: 8,
                color: ACCENT,
              }}
            >
              AI writes for you.
            </div>
            <div
              style={{
                fontFamily: "Inter",
                fontSize: 25,
                whiteSpace: "nowrap",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                marginTop: 34,
                opacity: 0.72,
              }}
            >
              Free for Mac and Windows · Select code, press one shortcut
            </div>
          </div>
          <div style={{ display: "flex", marginRight: 4, transform: "rotate(-6deg)" }}>
            <VibeBlob size={260} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span style={{ fontFamily: "Inter", fontSize: 22, fontWeight: 600, opacity: 0.6 }}>unvibe.site</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: newsreader, style: "normal", weight: 400 },
        { name: "Newsreader", data: newsreaderItalic, style: "italic", weight: 400 },
        { name: "Inter", data: inter, style: "normal", weight: 600 },
      ],
    },
  );
}
