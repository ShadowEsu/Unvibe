import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { waitlistSchema } from "@/lib/waitlistSchema";
import { notifyFounder } from "@/lib/notifyWaitlist";

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

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "waitlist.json");

interface StoredEntry {
  name?: string;
  email: string;
  role?: string;
  tool?: string;
  experience?: string;
  message?: string;
  referredBy?: string;
  referralCode: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  createdAt: string;
}

async function readLocal(): Promise<StoredEntry[]> {
  try {
    return JSON.parse(await fs.readFile(dataFile, "utf8")) as StoredEntry[];
  } catch {
    return [];
  }
}

async function writeLocal(entries: StoredEntry[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(entries, null, 2), "utf8");
}

async function saveToSupabase(entry: StoredEntry): Promise<{
  used: boolean;
  duplicate: boolean;
  unavailable: boolean;
}> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const production = process.env.NODE_ENV === "production";
  if (!url || !key) {
    return { used: false, duplicate: false, unavailable: production };
  }

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from("waitlist_entries").insert({
      name: entry.name || null,
      email: entry.email,
      role: entry.role || null,
      tool: entry.tool,
      experience: entry.experience,
      message: entry.message || null,
      referred_by: entry.referredBy || null,
      referral_code: entry.referralCode,
      utm_source: entry.utmSource || null,
      utm_medium: entry.utmMedium || null,
      utm_campaign: entry.utmCampaign || null,
    });

    if (error) {
      if (error.code === "23505") {
        return { used: true, duplicate: true, unavailable: false };
      }
      console.warn("supabase waitlist insert skipped", error.code, error.message);
      return { used: false, duplicate: false, unavailable: production };
    }
    return { used: true, duplicate: false, unavailable: false };
  } catch (err) {
    console.warn("supabase waitlist unavailable", err);
    return { used: false, duplicate: false, unavailable: production };
  }
}

async function saveLocal(entry: StoredEntry): Promise<{ duplicate: boolean }> {
  const entries = await readLocal();
  const existing = entries.find((e) => e.email === entry.email);
  if (existing) {
    return { duplicate: true };
  }
  entries.push(entry);
  await writeLocal(entries);
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
  const entry: StoredEntry = {
    name: parsed.data.name || undefined,
    email,
    role: parsed.data.role || undefined,
    tool: parsed.data.tool,
    experience: parsed.data.experience,
    message: parsed.data.message || undefined,
    referredBy: parsed.data.referredBy || undefined,
    referralCode,
    utmSource: parsed.data.utmSource || undefined,
    utmMedium: parsed.data.utmMedium || undefined,
    utmCampaign: parsed.data.utmCampaign || undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    const supa = await saveToSupabase(entry);
    let duplicate = supa.duplicate;

    if (supa.unavailable) {
      return NextResponse.json(
        { error: "The beta waitlist is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    if (!supa.used) {
      const local = await saveLocal(entry);
      duplicate = local.duplicate;
    }

    if (!duplicate) {
      // Fire and forget — do not block the signup response.
      void notifyFounder({
        name: entry.name,
        email: entry.email,
        role: entry.role,
        tool: entry.tool ?? "Not provided",
        experience: entry.experience ?? "Not provided",
        message: entry.message,
        referralCode,
        duplicate: false,
      });
    }

    return NextResponse.json({ referralCode, duplicate });
  } catch (err) {
    console.error("waitlist error", err);
    return NextResponse.json(
      { error: "Could not save your entry. Please try again." },
      { status: 500 }
    );
  }
}
