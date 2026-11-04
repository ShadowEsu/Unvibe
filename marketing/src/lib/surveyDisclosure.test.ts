import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";

// tsx compiles JSX to React.createElement, so rendering pages here needs React in scope.
Object.assign(globalThis, { React });

// The in-app PMF survey (FE-09): Security's exact wording under "Feedback you send".
describe("Survey disclosure", () => {
  it("the privacy page names what the survey sends, the 12-month retention and the AI summary rule", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.match(
      page,
      /<strong>Survey answers:<\/strong> if you answer the short in-app survey and press Send, your answers, the app version and your random install ID\. Kept 12 months\. The team reads them and may use AI tools that don&#x27;t train on your data to summarise them\./,
    );
  });

  it("the optional 'where did you first hear' question: its choices, the Other note, the 12 months, and no code or name", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.ok(
      page.includes(
        "<strong>Where you first heard about Unvibe:</strong> from version 0.1.50 the in-app survey has one optional question with fixed choices (Search, A friend or colleague, Reddit, Hacker News, X, YouTube or TikTok, A directory or list, Other). If you pick one, your choice and the few words you type under Other (at most 80 characters) are sent with your other answers when you press Send, under the same random install ID, and kept with them for 12 months. We use it to see which places bring people to Unvibe. It holds no code, and we don&#x27;t ask for your name, so please don&#x27;t type one under Other.",
      ),
    );
  });
});

// Install command copies carry a first-touch source label (installSource.ts, migration 0012).
describe("Install source disclosure", () => {
  it("the privacy page says what the copy count and label hold, that it needs Allow, the browser copy, and 12 months", () => {
    const page = renderToStaticMarkup(createElement(PrivacyPage)).replace(/\s+/g, " ");
    assert.ok(
      page.includes(
        "From 4 November 2026, if you have pressed Allow on the analytics bar and copy the install command, unvibe.site adds one to that day&#x27;s count of copies, together with one short label for where you first came from. The label is picked from a fixed list (such as search, Reddit, Hacker News, X, a directory, a friend&#x27;s invite link, other, or direct when the link had no tag) using the link you first arrived by. It never includes the link itself, the campaign name or an invite code. Your browser keeps the label so a later copy uses the same one, until you press No thanks or clear this site&#x27;s data. Our server keeps only a count per day and label, with no ID, IP address, page or time, for 12 months, so we can see which places bring people who install Unvibe. It holds no code and no name. If you have not pressed Allow, copying the command sends nothing.",
      ),
    );
  });
});
