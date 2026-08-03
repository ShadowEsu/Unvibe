import type { StreamEvent } from './protocol';

/**
 * Incremental SSE parser. Feed raw chunks (which may split events anywhere);
 * get back complete parsed StreamEvents. Pure — unit tested.
 *
 * Tolerates LF (`\n\n`) and CRLF (`\r\n\r\n`) event separators and the
 * optional space after `data:` — all valid per the SSE spec (WHATWG). Servers
 * or proxies that emit CRLF or omit the space are parsed instead of dropped.
 */
export class SseParser {
  private buffer = '';

  feed(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];
    const separator = /(?:\r\n|\r|\n){2}/;
    let match: RegExpExecArray | null;
    while ((match = separator.exec(this.buffer)) !== null) {
      const block = this.buffer.slice(0, match.index);
      this.buffer = this.buffer.slice(match.index + match[0].length);
      for (const raw of block.split(/\r\n|\r|\n/)) {
        const line = raw.trim();
        if (line.startsWith('data:')) {
          try {
            events.push(JSON.parse(line.slice('data:'.length).trim()) as StreamEvent);
          } catch {
            // Malformed event — skip rather than kill the stream.
          }
        }
      }
    }
    return events;
  }
}
