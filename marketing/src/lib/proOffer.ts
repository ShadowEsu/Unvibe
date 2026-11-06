import { AI_MAINTENANCE } from "@/lib/aiMaintenance";

/**
 * How the site says whether Pro exists (Design W17, Security MUST-Q1 and MUST-Q2, 31 Oct): Pro checkout
 * is off, and a new account gets a free month of Pro (the welcome_pro_grants trigger), plus a month for
 * each friend who signs in and enters your gift code in the app, as the API enforces it (web/src/billing/gifts.ts
 * and claim_gift: email sign-in, one gift per receiving account, five per giver). While AI features are
 * paused (lib/aiMaintenance) nobody can try Pro, so the try-now half is dropped everywhere.
 * Surfaces call these helpers; none reads the switch itself.
 */
const NOT_ON_SALE = "Pro isn't on sale yet.";
const FRIEND_MONTHS = "plus a month for each friend who signs in and enters your gift code in the app, if their account hasn't had a gift yet (up to five).";

/** "Pro isn't on sale yet. You can try it now: …", or only "Pro isn't on sale yet." while paused. */
export function proSentence(paused: boolean = AI_MAINTENANCE): string {
  return paused ? NOT_ON_SALE : `${NOT_ON_SALE} You can try it now: new accounts get a free month, ${FRIEND_MONTHS}`;
}
