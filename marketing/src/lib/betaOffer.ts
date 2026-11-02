import {
  BETA_MAC_DOWNLOAD_URL,
  BETA_MAC_INTEL_DOWNLOAD_URL,
  BETA_WINDOWS_DOWNLOAD_URL,
} from "@/lib/betaInstallScript";

export const BETA_INSTALL_HOST = "https://unvibe.site";
/** The site's own feedback form (FeedbackWidget opens on ?feedback=1). Typeform kept as fallback only. */
export const BETA_SURVEY_URL = `${BETA_INSTALL_HOST}/?feedback=1`;
export const TYPEFORM_SURVEY_URL =
  "https://5fmnqm5vw5o.typeform.com/to/gtkkixB7";
export const BETA_FEEDBACK_URL = `${BETA_INSTALL_HOST}/feedback`;

export const BETA_INSTALL_COMMAND = `curl -fsSL ${BETA_INSTALL_HOST}/install.sh | bash`;
export const BETA_WINDOWS_INSTALL_COMMAND = `irm ${BETA_INSTALL_HOST}/install.ps1 | iex`;
export const BETA_MAC_DIRECT_DOWNLOAD = BETA_MAC_DOWNLOAD_URL;
export const BETA_MAC_INTEL_DIRECT_DOWNLOAD = BETA_MAC_INTEL_DOWNLOAD_URL;
export const BETA_WINDOWS_DIRECT_DOWNLOAD = BETA_WINDOWS_DOWNLOAD_URL;
export const BETA_INSTALL_VERSION = "v0.1.47";
export const BETA_INSTALL_LABEL = "Free for Mac and Windows";
