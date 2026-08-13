import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const display = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unvibe.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Unvibe — Learn the Project You Vibe-Coded",
    template: "%s · Unvibe",
  },
  description:
    "Unvibe is a Mac desktop tutor that teaches you the project you vibe-coded, using explanations connected to your selected code and workflow.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Unvibe — Learn the Project You Vibe-Coded",
    description:
      "Select code, press ⌘U, and learn what AI shipped in the context of your project.",
    siteName: "Unvibe",
    images: [{ url: "/unvibe-social-preview-v5.png", width: 1200, height: 630, alt: "Unvibe — learn the AI-generated code you ship" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Unvibe — Learn the Project You Vibe-Coded",
    description:
      "A Mac desktop tutor for learning the AI-generated code in your project without leaving your workflow.",
    images: ["/unvibe-social-preview-v5.png"],
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
    "A Mac desktop tutor that teaches developers the AI-generated code in their project using selected context and their existing workflow.",
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
  ],
};

export const viewport: Viewport = {
  themeColor: "#0f0a17",
};

const themeScript = `
(function() {
  try {
    var root = document.documentElement;
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
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
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
