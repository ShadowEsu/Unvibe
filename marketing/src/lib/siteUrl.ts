const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();

/** The site's origin for metadata and structured data; a missing, relative or redacted env value means production. */
export const SITE_URL = raw && /^https?:\/\//i.test(raw) && !raw.includes("[SENSITIVE]") ? raw.replace(/\/+$/, "") : "https://unvibe.site";
