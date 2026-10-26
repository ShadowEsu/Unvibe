import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kitMarkdown } from "./kit";

// Try it sends the pasted code to Unvibe's server and Google Gemini. Nothing about it runs in the browser.
describe("Try it disclosure", () => {
  it("the kit says the pasted code goes to Unvibe and Google Gemini, not that it runs in the browser", () => {
    const kit = kitMarkdown();
    assert.match(kit, /try it online on the homepage \(the pasted code goes to Unvibe and Google Gemini\)/);
    assert.doesNotMatch(kit, /in the browser/i);
  });
});
