import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { GET as getMacScript } from "@/app/api/install/route";
import { GET as getWindowsScript } from "@/app/api/install-windows/route";
import { getBetaInstallCounts } from "./betaInstallStats";

// With no Supabase or Blob configured, fetches are counted in the on-disk store; start each case from empty.
const stores = [path.join(process.cwd(), ".data", "beta-install.json"), path.join("/tmp", "unvibe-beta-install", "beta-install.json")];
const ENV = ["BLOB_READ_WRITE_TOKEN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

async function withEmptyStore(run: () => Promise<void>) {
  const saved = ENV.map((key) => process.env[key]);
  for (const key of ENV) delete process.env[key];
  const clear = () => Promise.all(stores.map((file) => fs.rm(file, { force: true }).catch(() => undefined)));
  await clear();
  try {
    await run();
  } finally {
    ENV.forEach((key, i) => (saved[i] === undefined ? delete process.env[key] : (process.env[key] = saved[i])));
    await clear();
  }
}

async function served(res: Response) {
  return { body: await res.text(), headers: Array.from(res.headers.entries()) };
}

for (const [name, get, url] of [
  ["/install.sh", getMacScript, "https://unvibe.site/install.sh"],
  ["/install.ps1", getWindowsScript, "https://unvibe.site/install.ps1"],
] as const) {
  describe(`${name} fetch count`, () => {
    it("serves the same script with and without ?notrack=1, and counts only the fetch without it", () =>
      withEmptyStore(async () => {
        const ours = await served(await get(new Request(`${url}?notrack=1`)));
        assert.equal((await getBetaInstallCounts()).fetched, 0, "a ?notrack=1 fetch is not counted");
        const theirs = await served(await get(new Request(url)));
        assert.equal((await getBetaInstallCounts()).fetched, 1, "a plain fetch is counted");
        assert.deepEqual(ours, theirs, "the script bytes and headers are identical");
      }));

    it("leaves out only notrack=1 exactly; other values and other params still count", () =>
      withEmptyStore(async () => {
        for (const search of ["?notrack=0", "?notrack=true", "?notrack=", "?NOTRACK=1", "?utm_source=x"]) {
          await get(new Request(`${url}${search}`));
        }
        await get(new Request(`${url}?utm_source=x&notrack=1`));
        assert.equal((await getBetaInstallCounts()).fetched, 5);
      }));
  });
}
