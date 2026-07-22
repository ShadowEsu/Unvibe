import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { isProPromoCode, PROMO_PRO_MONTHS, waitlistSchema } from "@/lib/waitlistSchema";
import { notifyFounder } from "@/lib/notifyWaitlist";
import { readLocalEntries, writeLocalEntries, type WaitlistEntry } from "@/lib/waitlistStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_LIMIT = { windowMs: 60_000, max: 8 };
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

function referralCodeFor(email: string): string {
  return createHash("sha256").update(email).digest("hex").slice(0, 8);
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

async function saveToSupabase(entry: WaitlistEntry): Promise<{
  used: boolean;
  duplicate: boolean;
}> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { used: false, duplicate: false };

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from("waitlist_entries").insert({
      email: entry.email,
      tool: entry.tool,
      experience: entry.experience,
      message: entry.message || null,
      referred_by: entry.referredBy || null,
      referral_code: entry.referralCode,
      utm_source: entry.utmSource || null,
      utm_medium: entry.utmMedium || null,
      utm_campaign: entry.utmCampaign || null,
      promo_code: entry.promoCode || null,
      pro_granted: entry.proGranted,
      pro_months: entry.proMonths || null,
      pro_expires_at: entry.proExpiresAt || null,
    });

    if (error) {
      if (error.code === "23505") return { used: true, duplicate: true };
      // Table missing or schema not ready — fall back to local file.
      console.warn("supabase waitlist insert skipped", error.code, error.message);
      return { used: false, duplicate: false };
    }
    return { used: true, duplicate: false };
  } catch (err) {
    console.warn("supabase waitlist unavailable", err);
    return { used: false, duplicate: false };
  }
}

async function saveLocal(entry: WaitlistEntry): Promise<{ duplicate: boolean }> {
  const entries = await readLocalEntries();
  const existing = entries.find((e) => e.email === entry.email);
  if (existing) {
    return { duplicate: true };
  }
  entries.push(entry);
  await writeLocalEntries(entries);
  return { duplicate: false };
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const referralCode = referralCodeFor(email);
  const promoCode = parsed.data.promoCode?.trim() || undefined;
  const proGranted = isProPromoCode(promoCode);
  const proExpiresAt = proGranted
    ? addMonths(new Date(), PROMO_PRO_MONTHS).toISOString()
    : undefined;
  const entry: WaitlistEntry = {
    email,
    tool: parsed.data.tool,
    experience: parsed.data.experience,
    message: parsed.data.message || undefined,
    referredBy: parsed.data.referredBy || undefined,
    referralCode,
    utmSource: parsed.data.utmSource || undefined,
    utmMedium: parsed.data.utmMedium || undefined,
    utmCampaign: parsed.data.utmCampaign || undefined,
    promoCode,
    proGranted,
    proMonths: proGranted ? PROMO_PRO_MONTHS : undefined,
    proExpiresAt,
    createdAt: new Date().toISOString(),
  };

  try {
    const supa = await saveToSupabase(entry);
    let duplicate = supa.duplicate;

    if (!supa.used) {
      const local = await saveLocal(entry);
      duplicate = local.duplicate;
    }

    if (!duplicate) {
      // Fire and forget — do not block the signup response.
      void notifyFounder({
        email: entry.email,
        tool: entry.tool,
        experience: entry.experience,
        message: entry.message,
        referralCode,
        duplicate: false,
        proGranted: entry.proGranted,
        proExpiresAt: entry.proExpiresAt,
      });
    }

    return NextResponse.json({
      referralCode,
      duplicate,
      proGranted: entry.proGranted,
      proMonths: entry.proMonths,
      proExpiresAt: entry.proExpiresAt,
    });
  } catch (err) {
    console.error("waitlist error", err);
    return NextResponse.json(
      { error: "Could not save your entry. Please try again." },
      { status: 500 }
    );
  }
}
