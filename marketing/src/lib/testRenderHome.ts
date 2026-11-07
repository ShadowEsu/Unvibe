// Test helper: the home page as server HTML. HomePage is an async server component (it reads whether payments are
// open); the billing check runs offline here, so it takes its closed fallback, as a build without the backend does.
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "@/app/page";

export async function renderHome(): Promise<string> {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("offline in tests");
  }) as typeof fetch;
  try {
    return renderToStaticMarkup(await HomePage());
  } finally {
    globalThis.fetch = realFetch;
  }
}
