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
export const BETA_INSTALL_VERSION = "v0.1.11";
export const BETA_INSTALL_LABEL = "Beta Testing App (30 AI Explanations), give it a try!";
export const BETA_INVESTOR_LABEL = "Try the beta testing version (30 AI explanations)";
