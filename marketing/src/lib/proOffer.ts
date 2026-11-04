import { AI_MAINTENANCE } from "@/lib/aiMaintenance";

/**
 * How the site says whether Pro exists (Design W17, Security MUST-Q1 and MUST-Q2, 31 Oct): Pro checkout
 * is off, and a new account gets a free month of Pro (the welcome_pro_grants trigger), plus a month for
 * each friend who enters your gift code in the app (lib/giftOffer, up to five). While AI features are
 * paused (lib/aiMaintenance) nobody can try Pro, so the try-now half is dropped everywhere.
 * Surfaces call these helpers; none reads the switch itself.
 */
const NOT_ON_SALE = "Pro isn't on sale yet.";
const FRIEND_MONTHS = "plus a month for each friend who enters your gift code in the app (up to five).";

/** "Pro isn't on sale yet. You can try it now: …", or only "Pro isn't on sale yet." while paused. */
export function proSentence(paused: boolean = AI_MAINTENANCE): string {
  return paused ? NOT_ON_SALE : `${NOT_ON_SALE} You can try it now: new accounts get a free month, ${FRIEND_MONTHS}`;
}

/** The /pricing Pro card's line under its list (the card says "Not on sale yet" under the price); none while paused. */
export function proTryToday(paused: boolean = AI_MAINTENANCE): string | null {
  return paused ? null : `Try Pro today: a new account gets a free month, ${FRIEND_MONTHS}`;
}
