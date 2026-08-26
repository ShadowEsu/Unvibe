export const ANALYTICS_EVENTS = [
  "page_viewed",
  "waitlist_viewed",
  "waitlist_started",
  "waitlist_completed",
  "waitlist_cta_clicked",
  "demo_started",
  "demo_completed",
  "depth_changed",
  "code_example_selected",
  "faq_opened",
  "referral_copied",
  "referral_shared",
  "outbound_social_clicked",
  "privacy_opened",
  "pricing_viewed",
  "billing_interval_selected",
  "plan_cta_clicked",
  "release_download_clicked",
  "beta_install_viewed",
  "beta_install_os_selected",
  "beta_install_copied",
  "beta_install_fetched",
  "survey_opened",
  "feedback_opened",
  "story_beat_viewed",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const ANALYTICS_EVENT_SET = new Set<string>(ANALYTICS_EVENTS);
