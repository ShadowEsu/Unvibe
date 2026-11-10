import type { MetadataRoute } from "next";

/** The layout's themeColor: the site's one light background. */
const PAPER = "#faf8f5";

/**
 * Served at /manifest.webmanifest, linked from every page by Next. It lets Chrome and Edge install /explain as
 * a web app and gives Safari's Add to Dock a name and start page. No service worker: the explainer needs the
 * network anyway (it posts to api.unvibe.site), and Chrome does not require one to install.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/explain",
    name: "Unvibe",
    short_name: "Unvibe",
    description: "Paste code and get a short explanation in plain English.",
    start_url: "/explain?utm_source=webapp",
    scope: "/",
    display: "standalone",
    background_color: PAPER,
    theme_color: PAPER,
    icons: [
      { src: "/webapp/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/webapp/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/webapp/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
