/**
 * The gift rule as the API enforces it (web/src/billing/gifts.ts and the SQL claim_gift): a
 * friend signs in to the app and enters the giver's code. Joining the waitlist or downloading
 * with a link grants nothing. Pro unlocks Expert depth and project-aware answers; it does not
 * raise the explanation allowance, so the copy doesn't claim more explanations.
 *
 * The shipped app (v0.1.43) shows no gift code and has no box to enter one: it never calls
 * /api/v1/gifts/mine or /api/v1/gifts/claim. The next app release adds both
 * (app/src/main/backend.ts claimGiftCode, renderer companion/gift.tsx). Until it ships, the copy
 * says gift codes arrive with that update. Each constant reads on its own, in either order.
 */
export const GIFT_OFFER =
  "Gift codes arrive with the next app update. Then, when a friend signs in to the Unvibe app and enters the code from your Share page, you each get a month of Pro: Expert depth and answers that use nearby files. Up to five friends.";

/** Invite links (?ref=) only count who joined; they never grant Pro. */
export const GIFT_LINK_NOTE = "A link alone adds no Pro months.";
