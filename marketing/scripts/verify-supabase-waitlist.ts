import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

  const client = createClient(url, key, { auth: { persistSession: false } });
  const testEmail = `unvibe-migration-check+${Date.now()}@example.com`;

  const insert = await client.from("waitlist_entries").insert({
    first_name: "Migration",
    last_name: "Check",
    email: testEmail,
    referral_code: "verify00",
  });
  if (insert.error) throw new Error(`insert failed: ${insert.error.message}`);
  console.log("insert ok");

  const read = await client.from("waitlist_entries").select("*").eq("email", testEmail);
  if (read.error) throw new Error(`read failed: ${read.error.message}`);
  if ((read.data?.length ?? 0) !== 1) throw new Error("read did not find the inserted row");
  console.log("read ok:", read.data![0]);

  const del = await client.from("waitlist_entries").delete().eq("email", testEmail);
  if (del.error) throw new Error(`cleanup delete failed: ${del.error.message}`);
  console.log("cleanup ok. Table is fully working.");
}

main().catch((error) => {
  console.error("verification failed:", error.message);
  process.exitCode = 1;
});
