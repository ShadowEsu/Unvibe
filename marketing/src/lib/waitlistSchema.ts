import { z } from "zod";

/**
 * Shared waitlist schema used by both the client form and the API route so validation
 * stays identical on both sides.
 */

export const waitlistSchema = z.object({
  // Joining only needs an email. Names stay optional for older clients.
  firstName: z.string().trim().max(80, "Keep it under 80 characters"),
  lastName: z.string().trim().max(80, "Keep it under 80 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  // A referral link supplies a short code; the on-page beta offer also accepts the
  // referring friend's email so the server can resolve it without exposing the list.
  referredBy: z.string().trim().max(254).optional().or(z.literal("")),
  promoCode: z.string().trim().max(32).optional().or(z.literal("")),
  utmSource: z.string().trim().max(64).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(64).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(64).optional().or(z.literal("")),
  // The browser's answer on the analytics bar. Only exactly `true` (Allow, no GPC, no ?notrack)
  // lets the server count the signup in PostHog, Mixpanel or the funnel (Security U-L1).
  analytics: z.unknown().optional().transform((value) => value === true),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
