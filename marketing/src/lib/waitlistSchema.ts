import { z } from "zod";

/**
 * Shared waitlist schema used by both the client form and the API route so validation
 * stays identical on both sides.
 */

export const waitlistSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(80, "Keep your first name under 80 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(80, "Keep your last name under 80 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email"),
  referredBy: z.string().trim().max(32).optional().or(z.literal("")),
  utmSource: z.string().trim().max(64).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(64).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(64).optional().or(z.literal("")),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;
