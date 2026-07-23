import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SiteAnnouncement } from "@/components/SiteAnnouncement";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unvibe.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Unvibe — Make AI-Written Code Yours",
    template: "%s · Unvibe",
  },
  description:
    "Unvibe is a Mac desktop learning layer that helps developers understand AI-generated code using explanations connected to their repository and workflow.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Unvibe — Make AI-Written Code Yours",
    description:
      "Select AI-generated code, choose an explanation depth, and make the code yours.",
    siteName: "Unvibe",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Unvibe — make AI-written code yours" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unvibe — Make AI-Written Code Yours",
    description:
      "A Mac desktop learning layer for understanding AI-generated code in the context of your workflow.",
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
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
  operatingSystem: "macOS",
  description:
    "A Mac desktop learning layer that helps developers understand AI-generated code using explanations connected to their repository and workflow.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free at $0 per month. No API key or credit card required.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0f14" },
  ],
};

const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('unvibe_theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = stored === 'light' || stored === 'dark' ? stored : system;
    var root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </head>
      <body>
        <Providers>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <SiteAnnouncement />
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
