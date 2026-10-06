import { createHash } from "node:crypto";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Stars plus up to 100 words. Shared by the site form and the desktop app. */
export const FEEDBACK_MAX_WORDS = 100;

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z
    .string()
    .trim()
    .max(1200, "Keep it under 100 words")
    .refine((value) => wordCount(value) <= FEEDBACK_MAX_WORDS, "Keep it under 100 words")
    .default(""),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  source: z.enum(["site", "app"]).default("site"),
  page: z.string().trim().max(200).optional(),
  appVersion: z.string().trim().max(40).optional(),
  // Honeypot: real people never fill this hidden field.
  website: z.string().max(0).optional().or(z.literal("")),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "local";
}

export function hashIp(ip: string): string {
  const salt = process.env.FEEDBACK_IP_SALT?.trim() || "unvibe-feedback";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** Strip control characters and collapse whitespace so stored text is plain. */
export function cleanText(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
}

let cached: SupabaseClient | null = null;
export function feedbackDb(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  cached ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
