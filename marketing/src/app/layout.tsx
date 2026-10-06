import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./paper.css";
import "./polish.css";
import "./vibe.css";
import { Providers } from "@/components/providers/Providers";
import { AmbientEffects } from "@/components/paper/AmbientEffects";
import { SelectionExplain } from "@/components/paper/SelectionExplain";
import { SitePalette } from "@/components/paper/SitePalette";
import { MobileDownloadBar } from "@/components/paper/MobileDownloadBar";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-face",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display-face",
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: "400",
  variable: "--font-serif-face",
  display: "swap",
});

const siteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const siteUrl =
  siteUrlRaw && /^https?:\/\//i.test(siteUrlRaw) && !siteUrlRaw.includes("[SENSITIVE]")
    ? siteUrlRaw
    : "https://unvibe.site";


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Unvibe. Learn the code AI shipped.",
    template: "%s · Unvibe",
  },
  description:
    "Select code in Cursor, VS Code, or Terminal. Press Command U. Unvibe explains it in place so you keep what you ship.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Unvibe. Learn the code AI shipped.",
    description:
      "Select code, press Command U, and keep an explanation you can reopen and quiz yourself on.",
    siteName: "Unvibe",
    locale: "en_US",
    images: [
      {
        url: "/unvibe-social-preview-v6.png",
        width: 1200,
        height: 630,
        alt: "Unvibe. Learn the code AI shipped.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unvibe. Learn the code AI shipped.",
    description:
      "A Mac overlay that explains selected code beside the tools you already use.",
    images: ["/unvibe-social-preview-v6.png"],
  },
  robots: { index: true, follow: true },
  verification: {
    google: "7KTQZKnFINspHj8_DOwYo9FnaD-9-nLZQ-adL2dgH6Q",
  },
  alternates: { canonical: siteUrl },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Unvibe",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS, Windows",
  softwareVersion: BETA_INSTALL_VERSION,
  downloadUrl: `${siteUrl}/beta`,
  description:
    "A desktop overlay for Mac and Windows that explains selected AI-generated code in place.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free at $0 per month. No API key or credit card required.",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Unvibe",
  url: siteUrl,
  logo: `${siteUrl}/icon.png`,
  email: "support@unvibe.site",
  sameAs: [
    "https://www.linkedin.com/company/unvibeapp/",
    "https://www.instagram.com/unvibe_app/",
    "https://x.com/unvibe_app",
    "https://www.tiktok.com/@unvibe_app",
  ],
};

export const viewport: Viewport = {
  themeColor: "var(--paper)",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable} ${serif.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body>
        <Providers>
          <AmbientEffects />
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
          <SelectionExplain />
          <SitePalette />
          <MobileDownloadBar />
        </Providers>
      </body>
    </html>
  );
}
