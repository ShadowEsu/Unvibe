import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Announcement } from "@/components/Announcement";

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unvibe.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Unvibe — Vibe Code Without the Guilt",
    template: "%s · Unvibe",
  },
  description:
    "Vibe code without the guilt. Unvibe helps you understand AI-written code in the depth you need, beside the tools where you build.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Unvibe — Vibe Code Without the Guilt",
    description:
      "Vibe code without the guilt. Select code, choose a depth, and understand what ships — beside the tools where you build.",
    siteName: "Unvibe",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Unvibe" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unvibe — Vibe Code Without the Guilt",
    description:
      "Vibe code without the guilt. Select, explain, and understand what ships.",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: siteUrl },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/icon.png", type: "image/png", sizes: "1024x1024" }],
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Unvibe",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "macOS",
  description:
    "A Mac desktop learning layer for understanding AI-written code beside the tools where you build.",
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
          <Announcement />
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
