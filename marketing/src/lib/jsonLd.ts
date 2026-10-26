/**
 * JSON for a `<script type="application/ld+json">` body. Every `<` becomes `\u003c`, which JSON reads back
 * as the same character, so no value (an FAQ answer, a site URL from the environment) can close the
 * script tag and start markup of its own.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
