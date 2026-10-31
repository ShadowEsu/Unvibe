/** One turn of the open Chat conversation, as the panel keeps it. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
}

/** What the panel sends with `chat:ask` (main: askChat). */
export interface ChatAskRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  question: string;
  wipeGeneration?: number;
}

/**
 * The `chat:ask` request for `question`, with the earlier turns as context and the conversation's
 * stamp (the store's wipe generation when it started, or null before it is known). Main refuses a
 * conversation that started before a wipe, before anything is sent.
 */
export function chatAskRequest(earlier: ChatTurn[], question: string, threadStamp: number | null): ChatAskRequest {
  return {
    messages: earlier.map((item) => ({ role: item.role, content: item.content })),
    question,
    wipeGeneration: threadStamp ?? undefined,
  };
}
