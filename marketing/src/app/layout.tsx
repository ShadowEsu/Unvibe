import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./paper.css";
import "./polish.css";
import "./vibe.css";
import "./hero.css";
import "./sections.css";
import "./pages.css";
import "./system.css";
import { Providers } from "@/components/providers/Providers";
import { AmbientEffects } from "@/components/paper/AmbientEffects";
import { SelectionExplain } from "@/components/paper/SelectionExplain";
import { SitePalette } from "@/components/paper/SitePalette";
import { MobileDownloadBar } from "@/components/paper/MobileDownloadBar";
import { ScrollVibe } from "@/components/paper/ScrollVibe";
import { FeedbackWidget } from "@/components/paper/FeedbackWidget";
import { ReminderToast } from "@/components/paper/ReminderToast";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";
import { BOOT_SCRIPT } from "@/lib/theme";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-face",
  display: "swap",
});

// Only the two faces the first phone viewport sets in (Inter body, Bricolage headings) are preloaded,
// so they and the CSS don't share the opening bandwidth with faces the fold doesn't need yet.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  display: "swap",
  preload: false,
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-display-face",
  display: "swap",
});

// The italic accent is not one of the two preloaded fold faces; swap shows it as soon as it loads.
const serif = Instrument_Serif({
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: "400",
  variable: "--font-serif-face",
  display: "swap",
  preload: false,
});

const siteUrlRaw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const siteUrl =
  siteUrlRaw && /^https?:\/\//i.test(siteUrlRaw) && !siteUrlRaw.includes("[SENSITIVE]")
    ? siteUrlRaw
    : "https://unvibe.site";


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Unvibe: understand the code AI writes for you",
    template: "%s · Unvibe",
  },
  description:
    "Free for Mac and Windows. Select code in any app, press one shortcut, and Vibe explains it in plain English beside your editor. No API key needed.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Unvibe: understand the code AI writes for you",
    description:
      "Free for Mac and Windows. Select code in any app, press one shortcut, and Vibe explains it in plain English beside your editor. No API key needed.",
    siteName: "Unvibe",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Unvibe: understand the code AI writes for you",
    description:
      "Free for Mac and Windows. Select code in any app, press one shortcut, and Vibe explains it in plain English beside your editor. No API key needed.",
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
        {/* Before first paint: the `js` class scopes motion start states. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
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
          <ScrollVibe />
          <FeedbackWidget />
          <ReminderToast />
        </Providers>
      </body>
    </html>
  );
}
