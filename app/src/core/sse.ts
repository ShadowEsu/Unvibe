import type { StreamEvent } from './protocol';

/**
 * Incremental SSE parser. Feed raw chunks (which may split events anywhere);
 * get back complete parsed StreamEvents. Pure — unit tested.
 */
export class SseParser {
  private buffer = '';

  feed(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf('\n\n')) !== -1) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      for (const line of block.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            events.push(JSON.parse(line.slice(6)) as StreamEvent);
          } catch {
            // Malformed event — skip rather than kill the stream.
          }
        }
      }
    }
    return events;
  }
}
