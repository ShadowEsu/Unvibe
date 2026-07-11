import type { ReviewRequestPayload, StreamEvent } from '../protocol';

/**
 * POST a review payload to the Uncode AI service and consume the SSE stream. All network I/O
 * lives here in the extension host (never the webview), so the secret filter cannot be bypassed.
 * Each SSE message is a single `data: {json}` line describing a StreamEvent.
 */
export async function streamReview(
  backendUrl: string,
  payload: ReviewRequestPayload,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${backendUrl.replace(/\/$/, '')}/api/v1/reviews`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    onEvent({ type: 'error', message: `Cannot reach Uncode service: ${errMessage(err)}` });
    return;
  }

  if (!res.ok || !res.body) {
    onEvent({ type: 'error', message: `Uncode service returned ${res.status}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) >= 0) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseData(rawEvent);
        if (event) {
          onEvent(event);
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      return;
    }
    onEvent({ type: 'error', message: `Stream interrupted: ${errMessage(err)}` });
  }
}

function parseSseData(rawEvent: string): StreamEvent | undefined {
  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      const json = line.slice(5).trim();
      if (!json) {
        continue;
      }
      try {
        return JSON.parse(json) as StreamEvent;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
