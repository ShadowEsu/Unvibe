import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
// Glisse's own CSS first, bundled as a 'self' stylesheet, so server HTML is styled before hydration
// and the site's CSS below wins ties. GlisseStylesMarker stops Glisse adding an inline copy (Security).
import "glisse/styles.css";
import "./globals.css";
import "./paper.css";
import "./polish.css";
import "./vibe.css";
import "./sections.css";
import "./pages.css";
import "./n.css";
import "./system.css";
import "./home-ux.css";
import "./glass.css";
import "@/site/dia/dia.css";
import "@/site/dia/demo.css";
import "@/site/dia/motion/dia-motion.css";
import "@/site/dia/site.css";
import "@/site/dia/listed.css";
import { GlisseStylesMarker } from "@/components/glass/GlisseStylesMarker";
import { Providers } from "@/components/providers/Providers";
import { AnalyticsConsentBar } from "@/components/AnalyticsConsentBar";
import { AmbientEffects } from "@/components/paper/AmbientEffects";
import { OG_CARD_SIZE, OG_CARDS } from "@/lib/pageMeta";
import { OFFICIAL_PROFILES } from "@/lib/contact";
import { SelectionExplain } from "@/components/paper/SelectionExplain";
import { SitePalette } from "@/components/paper/SitePalette";
import { FeedbackWidget } from "@/components/paper/FeedbackWidget";
import { ReminderToast } from "@/components/paper/ReminderToast";
import { SiteHeader } from "@/site/dia/SiteHeader";
import { SiteFooter } from "@/site/dia/SiteFooter";
import { OsClass } from "@/site/dia/os";
import { OS_BOOT } from "@/site/dia/osBoot";
import { PRODUCT_FEATURES, PRODUCT_HOW, PRODUCT_SENTENCE } from "@/lib/productFacts";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";
import { BOOT_SCRIPT } from "@/lib/theme";
import { jsonLdScript } from "@/lib/jsonLd";
import { SITE_URL } from "@/lib/siteUrl";

// One face for everything but code (Design, ledger 443): Inter, preloaded for the first viewport.
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans-face",
  display: "swap",
});

// Direction D's display face (PLAN §2, font 1): Playfair Display, OFL, built in and served from this origin by
// next/font (no runtime CDN call). Roman and italic 400 only. `optional` + preload: a face that misses the first frame
// is never swapped in later, so it can't move the wordmark (CLS 0); next/font's metric-matched fallback holds the
// space either way.
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
  display: "optional",
});
// Inter is the only face preloaded, so it and the CSS don't share the opening bandwidth.
// JetBrains Mono goes further: no font variable on <html>, so no first-layout text asks for it (any laid-out
// text would, even far below the fold, and Lighthouse then counts it before the first paint). The script
// at the end of <body> sets the variable on the first scroll, tap or key press, or 4 s after load,
// whichever comes first. Setting it right at load was not late enough: in some Lighthouse runs the
// observed first paint came after load, the font landed before it and the simulated FCP grew 450 ms.
// Until then mono text uses the metric-matched system faces in globals.css, which is also why
// next/font's Arial fallback is off.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

// jsonLdScript escapes "<", so nothing in the string can close this inline <script> (Security X-U31).
const monoWhenWanted = `(function(){var done=false,events=["scroll","pointerdown","keydown"];function use(){if(done)return;done=true;events.forEach(function(e){removeEventListener(e,use)});var s=document.createElement("style");s.textContent=${jsonLdScript(
  `:root{--font-mono-face:${mono.style.fontFamily}}`,
)};document.head.appendChild(s)}events.forEach(function(e){addEventListener(e,use,{passive:true})});addEventListener("load",function(){setTimeout(use,4000)})})()`;

const siteUrl = SITE_URL;

const defaultTitle = "Unvibe: explain AI-written code in plain English";
const defaultDescription = `${PRODUCT_SENTENCE} Select code in any app, press one shortcut, and read it beside your editor. No API key needed.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: defaultTitle,
    template: "%s · Unvibe",
  },
  description: defaultDescription,
  // Fallback for pages without pageMetadata() (404, private pages). No og:url here: a page that
  // inherited one would point its preview at the home page.
  openGraph: {
    type: "website",
    title: defaultTitle,
    description: defaultDescription,
    siteName: "Unvibe",
    locale: "en_US",
    images: [{ url: OG_CARDS.home.file, ...OG_CARD_SIZE, alt: OG_CARDS.home.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [{ url: OG_CARDS.home.file, alt: OG_CARDS.home.alt }],
  },
  robots: { index: true, follow: true },
  verification: {
    google: "7KTQZKnFINspHj8_DOwYo9FnaD-9-nLZQ-adL2dgH6Q",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

/** The app, on every page. No aggregateRating or review: there are no public reviews to cite. */
const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/#app`,
  name: "Unvibe",
  url: siteUrl,
  applicationCategory: "DeveloperApplication",
  applicationSubCategory: "Code explainer",
  operatingSystem: "macOS, Windows 10, Windows 11",
  // The release the site installs (betaInstallScript.test pins it to the install tag), without the tag's "v".
  softwareVersion: BETA_INSTALL_VERSION.replace(/^v/, ""),
  downloadUrl: `${siteUrl}/beta`,
  releaseNotes: `${siteUrl}/releases`,
  screenshot: `${siteUrl}/product/unvibe-0148-debounce-1180.webp`,
  description: `${PRODUCT_SENTENCE} ${PRODUCT_HOW}`,
  featureList: PRODUCT_FEATURES,
  isAccessibleForFree: true,
  inLanguage: "en",
  publisher: { "@id": `${siteUrl}/#org` },
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
  "@id": `${siteUrl}/#org`,
  name: "Unvibe",
  url: siteUrl,
  // public/icon.png is 1024 × 1024 (Google's logo guidance: at least 112 × 112, square works).
  logo: { "@type": "ImageObject", url: `${siteUrl}/icon.png`, width: 1024, height: 1024 },
  description: "Unvibe makes a free desktop app for Mac and Windows that explains AI-written code in plain English.",
  email: "support@unvibe.site",
  // Only profiles Unvibe controls (contact.ts, the same list as the footer's Follow column).
  sameAs: OFFICIAL_PROFILES.map(([, url]) => url),
};

export const viewport: Viewport = {
  themeColor: "#faf8f5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable}`}
      // The site has one light theme; this pins Glisse to its light values for visitors whose system is dark.
      data-theme="light"
    >
      <head>
        {/* First in <head>, before any Glisse code runs: see GlisseStylesMarker. */}
        <GlisseStylesMarker />
        {/* Before first paint: the `js` class, which scopes the motion start states. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
        {/* Before first paint: os-win / os-phone, so OS-aware copy (Control+U vs Ctrl+Alt+U) never swaps (MUST-D12). */}
        <script dangerouslySetInnerHTML={{ __html: OS_BOOT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(organizationJsonLd) }}
        />
      </head>
      <body>
        <Providers>
          <AmbientEffects />
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          {/* Fixed at the bottom of the view, but early in the HTML: it paints with the first frame (it was the
              home page's LCP when it came after the page), and keyboard and screen-reader users meet it first. */}
          <AnalyticsConsentBar />
          <OsClass />
          {/* The one header on every page (Preston: "only 1 glass effect header"). */}
          <SiteHeader />
          <main id="main" tabIndex={-1}>{children}</main>
          <SiteFooter />
          <SelectionExplain />
          <SitePalette />
          <FeedbackWidget />
          <ReminderToast />
        </Providers>
        <script dangerouslySetInnerHTML={{ __html: monoWhenWanted }} />
      </body>
    </html>
  );
}
