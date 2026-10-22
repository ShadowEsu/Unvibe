/**
 * The gift rule as the API enforces it (web/src/billing/gifts.ts and the SQL claim_gift): a
 * friend signs in to the app and enters the giver's code. Joining the waitlist or downloading
 * with a link grants nothing. Pro unlocks Expert depth and project-aware answers; it does not
 * raise the explanation allowance, so the copy doesn't claim more explanations.
 */
export const GIFT_OFFER =
  "When a friend signs in to the Unvibe app and enters your code, you each get a month of Pro: Expert depth and answers that use nearby files. Up to five friends.";

export const GIFT_CODE_HOME = "Your code is on the Share page in the Unvibe app.";
