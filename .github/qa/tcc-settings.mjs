// QA (tcc-shots.sh): in the running Unvibe (debug port 9229), open Settings (the sidebar's Settings button; General is
// its first tab), picture the Accessibility block, press the real "Allow Accessibility" button, wait, picture it
// again. The button asks macOS (promptAccessibility) and opens the Accessibility pane (openAccessibility), as for a
// user. Prints "KEY value" lines. Usage: node tcc-settings.mjs <out dir>
import { chromium } from "playwright";
import { join } from "node:path";

const out = process.argv[2];
const browser = await chromium.connectOverCDP("http://127.0.0.1:9229");
let page = null;
for (let i = 0; i < 40 && !page; i++) {
  page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("companion")) ?? null;
  if (!page) await new Promise((r) => setTimeout(r, 500));
}
if (!page) { console.log("FAIL no companion window"); process.exit(1); }
console.log(`PAGE ${page.url().split("/").pop()}`);
await page.locator(".side-settings").first().click({ timeout: 15000 });
const dlg = page.locator('[role="dialog"][aria-label="Settings"]');
await dlg.waitFor({ timeout: 15000 });
const block = dlg.locator(".perm-block").filter({ hasText: "Accessibility" }).first();
await block.waitFor({ timeout: 15000 });
await block.scrollIntoViewIfNeeded();
console.log(`BEFORE ${(await block.innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
await block.screenshot({ path: join(out, "3-app-accessibility-before.png") });
await dlg.screenshot({ path: join(out, "3-app-settings-general-before.png") });
await block.getByRole("button", { name: "Allow Accessibility" }).click();
console.log("PRESSED Allow Accessibility");
await page.waitForTimeout(6000);
console.log(`AFTER ${(await block.innerText()).replace(/\s+/g, " ").slice(0, 400)}`);
await block.screenshot({ path: join(out, "3-app-accessibility-after.png") });
await browser.close();
