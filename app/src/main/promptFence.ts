/**
 * Wraps untrusted source in a markdown code fence that the source cannot close.
 * The fence is one backtick longer than the longest backtick run inside the text.
 */
export function fenceBlock(text: string, lang = ''): string {
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${lang}\n${text}\n${fence}`;
}
