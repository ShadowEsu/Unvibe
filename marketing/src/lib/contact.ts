/** Official Unvibe inboxes. Keep website + product copy pointed here. */
export const SUPPORT_EMAIL = "support@unvibe.site";
export const LINKEDIN_URL = "https://www.linkedin.com/company/unvibeapp/";
export const INSTAGRAM_URL = "https://www.instagram.com/unvibe_app/";
export const X_URL = "https://x.com/unvibe_app";
export const GITHUB_URL = "https://github.com/ShadowEsu/Unvibe";

/**
 * The profiles Unvibe controls, in Design's order. The Organization JSON-LD `sameAs` and the footer's Follow column
 * read this one list, so they can't drift. X and TikTok stay out until those accounts exist; YouTube stays out because
 * the only channel is Preston's personal one (BOSS, 6 Nov).
 */
export const OFFICIAL_PROFILES = [
  ["GitHub", GITHUB_URL],
  ["Instagram", INSTAGRAM_URL],
  ["LinkedIn", LINKEDIN_URL],
] as const;

export const supportMailto = `mailto:${SUPPORT_EMAIL}`;
