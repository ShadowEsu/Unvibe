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
});
