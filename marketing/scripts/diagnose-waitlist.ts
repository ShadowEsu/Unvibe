import { get, list } from "@vercel/blob";
import { decryptWaitlistJson } from "../src/lib/waitlistCrypto";

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const secret = process.env.WAITLIST_ADMIN_TOKEN?.trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN missing");
  if (!secret) throw new Error("WAITLIST_ADMIN_TOKEN missing");

  const all = await list({ prefix: "waitlist/", limit: 1000, token });
  console.log(`Blobs under waitlist/: ${all.blobs.length} (hasMore=${all.hasMore})`);
  for (const blob of all.blobs) {
    console.log(` - ${blob.pathname} (${blob.size} bytes, uploaded ${blob.uploadedAt})`);
  }

  const items = await list({ prefix: "waitlist/item/", limit: 1000, token });
  console.log(`\nPer-item entries: ${items.blobs.length}`);

  const marker = all.blobs.find((b) => b.pathname === "waitlist/migrated-v2.marker");
  console.log(`Migration marker present: ${Boolean(marker)}`);

  for (const legacyPath of ["waitlist/entries.v2.enc", "waitlist/entries.v1.enc"]) {
    const found = all.blobs.find((b) => b.pathname === legacyPath);
    if (!found) {
      console.log(`\nLegacy blob ${legacyPath}: not found`);
      continue;
    }
    console.log(`\nLegacy blob ${legacyPath}: found, ${found.size} bytes`);
    let result;
    try {
      result = await get(found.url, { access: "public", token, useCache: false });
    } catch (error) {
      console.log(`  sdk get failed: ${(error as Error).message}`);
      continue;
    }
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.log(`  sdk get failed: statusCode=${result?.statusCode}`);
      continue;
    }
    const body = await new Response(result.stream).text();
    try {
      const parsed = decryptWaitlistJson<unknown>(body, secret);
      console.log(`  decrypted ok. isArray=${Array.isArray(parsed)} length=${Array.isArray(parsed) ? parsed.length : "n/a"}`);
      if (Array.isArray(parsed)) {
        for (const entry of parsed as Array<Record<string, unknown>>) {
          console.log(`    - ${entry.email ?? "(no email)"} createdAt=${entry.createdAt ?? "?"}`);
        }
      }
    } catch (error) {
      console.log(`  decrypt failed: ${(error as Error).message}`);
    }
  }

  console.log("\nPer-item entries detail:");
  for (const blob of items.blobs) {
    let result;
    try {
      result = await get(blob.url, { access: "public", token, useCache: false });
    } catch (error) {
      console.log(` - ${blob.pathname}: sdk get failed: ${(error as Error).message}`);
      continue;
    }
    if (!result || result.statusCode !== 200 || !result.stream) {
      console.log(` - ${blob.pathname}: could not read`);
      continue;
    }
    const body = await new Response(result.stream).text();
    try {
      const entry = decryptWaitlistJson<Record<string, unknown>>(body, secret);
      console.log(` - ${blob.pathname}: ${entry.email} createdAt=${entry.createdAt}`);
    } catch (error) {
      console.log(` - ${blob.pathname}: decrypt failed: ${(error as Error).message}`);
    }
  }
}

main().catch((error) => {
  console.error("\nDiagnosis stopped early:", error);
  process.exitCode = 1;
});
