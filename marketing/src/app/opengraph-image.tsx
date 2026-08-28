import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import React from "react";

export const alt = "Unvibe. Learn the code AI shipped.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const root = process.cwd();
  const [photo, newsreader, newsreaderItalic, inter] = await Promise.all([
    readFile(join(root, "public/hero/golden-gate.png")),
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
          position: "relative",
          overflow: "hidden",
          color: "#f7f4ee",
        }}
      >
        <img
          src={`data:image/png;base64,${photo.toString("base64")}`}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: 1200,
            height: 630,
            objectFit: "cover",
            objectPosition: "62% 40%",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(12,16,28,0.16) 0%, rgba(12,16,28,0.1) 38%, rgba(18,12,32,0.58) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 36,
            left: 44,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z"
              stroke="#f7f4ee"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4"
              stroke="#f7f4ee"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span
            style={{
              fontFamily: "Inter",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.04em",
            }}
          >
            Unvibe
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "Newsreader",
                fontSize: 92,
                lineHeight: 0.92,
                letterSpacing: "-0.045em",
                textShadow: "0 0 46px rgba(167,139,250,0.42)",
              }}
            >
              Learn the code
            </div>
            <div
              style={{
                fontFamily: "Newsreader",
                fontSize: 92,
                lineHeight: 0.92,
                letterSpacing: "-0.045em",
                marginTop: 6,
                textShadow: "0 0 46px rgba(167,139,250,0.42)",
              }}
            >
              AI shipped.
            </div>
            <div
              style={{
                fontFamily: "Newsreader",
                fontStyle: "italic",
                fontSize: 28,
                marginTop: 22,
                opacity: 0.9,
              }}
            >
              Select it. Press Command U. Keep it.
            </div>
          </div>
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
