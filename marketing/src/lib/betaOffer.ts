import { downloadPath } from "@/lib/downloadFiles";

export const BETA_INSTALL_HOST = "https://unvibe.site";
/** The site's own feedback form (FeedbackWidget opens on ?feedback=1). Typeform kept as fallback only. */
export const BETA_SURVEY_URL = `${BETA_INSTALL_HOST}/?feedback=1`;
export const TYPEFORM_SURVEY_URL =
  "https://5fmnqm5vw5o.typeform.com/to/gtkkixB7";
export const BETA_FEEDBACK_URL = `${BETA_INSTALL_HOST}/feedback`;

export const BETA_INSTALL_COMMAND = `curl -fsSL ${BETA_INSTALL_HOST}/install.sh | bash`;
export const BETA_WINDOWS_INSTALL_COMMAND = `irm ${BETA_INSTALL_HOST}/install.ps1 | iex`;
/**
 * The download links every button, page, kit and email uses: /download/<file> counts the click (aggregate
 * per day, no ID: src/lib/downloadCounter.ts) and redirects to this release's asset on GitHub. The install
 * scripts and their checksum files keep fetching GitHub directly (betaInstallScript.ts).
 */
export const BETA_MAC_DIRECT_DOWNLOAD = `${BETA_INSTALL_HOST}${downloadPath("mac")}`;
export const BETA_MAC_INTEL_DIRECT_DOWNLOAD = `${BETA_INSTALL_HOST}${downloadPath("mac-intel")}`;
export const BETA_WINDOWS_DIRECT_DOWNLOAD = `${BETA_INSTALL_HOST}${downloadPath("windows")}`;
export const BETA_INSTALL_VERSION = "v0.1.49";
export const BETA_INSTALL_LABEL = "Free for Mac and Windows";
