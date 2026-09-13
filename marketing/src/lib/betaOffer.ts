import {
  BETA_MAC_DOWNLOAD_URL,
  BETA_WINDOWS_DOWNLOAD_URL,
} from "@/lib/betaInstallScript";

export const BETA_INSTALL_HOST = "https://unvibe.site";
/** PostHog hosted survey (startup credits). Typeform kept as fallback only. */
export const BETA_SURVEY_URL =
  "https://us.posthog.com/external_surveys/01a03aa5-ab81-0000-b791-03561d8f4f7d";
export const TYPEFORM_SURVEY_URL =
  "https://5fmnqm5vw5o.typeform.com/to/gtkkixB7";
export const BETA_FEEDBACK_URL = `${BETA_INSTALL_HOST}/feedback`;
export const POSTHOG_SURVEY_ID = "01a03aa5-ab81-0000-b791-03561d8f4f7d";

export const BETA_INSTALL_COMMAND = `curl -fsSL ${BETA_INSTALL_HOST}/install.sh | bash`;
export const BETA_WINDOWS_INSTALL_COMMAND = `irm ${BETA_INSTALL_HOST}/install.ps1 | iex`;
export const BETA_MAC_DIRECT_DOWNLOAD = BETA_MAC_DOWNLOAD_URL;
export const BETA_WINDOWS_DIRECT_DOWNLOAD = BETA_WINDOWS_DOWNLOAD_URL;
export const BETA_INSTALL_VERSION = "v0.1.11";
export const BETA_INSTALL_LABEL = "Mac and Windows private beta · 30 explanations";
export const BETA_INVESTOR_LABEL = "Try the beta testing version (30 AI explanations)";
