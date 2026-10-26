/**
 * The gift rule as the API enforces it (web/src/billing/gifts.ts and the SQL claim_gift): a
 * friend signs in to the app and enters the giver's code. Joining the waitlist or downloading
 * with a link grants nothing. Pro unlocks Expert depth and project-aware answers; it does not
 * raise the explanation allowance, so the copy doesn't claim more explanations.
 *
 * From app 0.1.44 the Share page shows a signed-in person's gift code and a box to enter a
 * friend's (app/src/main/backend.ts claimGiftCode, renderer companion/gift.tsx). 0.1.43 and
 * older show neither, so the copy names the version. Each constant reads on its own, in either
 * order.
 */
export const GIFT_OFFER =
  "When a friend signs in to the Unvibe app and enters the code from your Share page, you each get a month of Pro: Expert depth and answers that use nearby files. Up to five friends. Gift codes need app version 0.1.44 or later.";

/** Invite links (?ref=) only count who joined; they never grant Pro. */
export const GIFT_LINK_NOTE = "A link alone adds no Pro months.";
