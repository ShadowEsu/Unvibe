/**
 * Wording and limits shared by the /survey page and its POST handler (webSurvey.ts). Question 1 and
 * its options A to E are the emailed PMF survey's (Security 20261029-2357); D and E both store as
 * `na`, which the score leaves out. The comment is that survey's question 4.
 */
export const WEB_SURVEY_QUESTION = "How would you feel if you could no longer use Unvibe?";
export const WEB_SURVEY_OPTIONS = [
  { id: "very", label: "Very disappointed", q1: "very" },
  { id: "somewhat", label: "Somewhat disappointed", q1: "somewhat" },
  { id: "not", label: "Not disappointed", q1: "not" },
  { id: "no-longer", label: "N/A, I no longer use it", q1: "na" },
  { id: "not-yet", label: "N/A, I haven't used it", q1: "na" },
] as const;
export type WebSurveyAnswer = (typeof WEB_SURVEY_OPTIONS)[number]["id"];
export const WEB_SURVEY_COMMENT_LABEL = "How can we improve Unvibe for you? (optional)";
export const WEB_SURVEY_MAX_COMMENT = 2000;
