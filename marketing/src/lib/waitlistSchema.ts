import { z } from "zod";

/**
 * Shared waitlist schema used by both the client form and the API route so validation
 * stays identical on both sides.
 */

export const tools = [
  "cursor",
  "vscode",
  "claude-code",
  "github",
  "other",
] as const;

export const experiences = [
  "just-starting",
  "student",
  "beginner-builder",
  "intermediate",
  "experienced",
] as const;

export const toolLabels: Record<(typeof tools)[number], string> = {
  cursor: "Cursor",
  vscode: "VS Code",
  "claude-code": "Claude Code",
  github: "GitHub",
  other: "Other",
};

export const experienceLabels: Record<(typeof experiences)[number], string> = {
  "just-starting": "Just starting",
  student: "Student",
  "beginner-builder": "Beginner builder",
  intermediate: "Intermediate developer",
  experienced: "Experienced developer",
};

export const waitlistSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(80, "Keep it under 80 characters"),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(80, "Keep it under 80 characters"),
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

export const waitlistDetailsSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  tool: z.enum(tools).optional(),
  experience: z.enum(experiences).optional(),
  message: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});

export type WaitlistDetailsInput = z.infer<typeof waitlistDetailsSchema>;
