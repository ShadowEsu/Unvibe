/**
 * Free chat models available on the company OpenRouter key.
 * Embed / rerank / TTS / safety models are intentionally excluded.
 */

export interface FreeChatModel {
  id: string;
  label: string;
  tag: string;
  blurb: string;
  /** Sort key: lower = cheaper / preferred default. */
  costRank: number;
  recommendedForCode?: boolean;
}

/** Default cheapest free chat model. */
export const DEFAULT_OPENROUTER_MODEL = 'liquid/lfm-2.5-2.6b:free';

export const FREE_CHAT_MODELS: FreeChatModel[] = [
  {
    id: 'liquid/lfm-2.5-2.6b:free',
    label: 'Liquid LFM2.5 2.6B',
    tag: 'Cheapest',
    blurb: 'Default free chat model. Compact and fast for everyday explanations.',
    costRank: 0,
  },
  {
    id: 'cohere/north-mini-code:free',
    label: 'Cohere North Mini Code',
    tag: 'Recommended for code',
    blurb: 'Agentic coding model. Strong default when explaining software changes.',
    costRank: 1,
    recommendedForCode: true,
  },
  {
    id: 'google/gemma-4-26b-a4b:free',
    label: 'Gemma 4 26B A4B',
    tag: 'MoE',
    blurb: 'Instruction-tuned MoE with multimodal input and a large context window.',
    costRank: 2,
  },
  {
    id: 'google/gemma-4-31b:free',
    label: 'Gemma 4 31B',
    tag: 'Strong',
    blurb: 'Dense multimodal model. Strong on coding, reasoning, and documents.',
    costRank: 3,
  },
  {
    id: 'inclusionai/ling-3.0-flash-sante:free',
    label: 'Ling 3.0 Flash Sante',
    tag: 'Flash',
    blurb: 'Mixture-of-experts with strong general reasoning and coding.',
    costRank: 4,
  },
  {
    id: 'thinkingmachines/inkling-small:free',
    label: 'Inkling Small',
    tag: 'Multimodal',
    blurb: 'Efficient MoE for reasoning, coding, and instruction following.',
    costRank: 5,
  },
  {
    id: 'poolside/laguna-xs-2.1:free',
    label: 'Poolside Laguna XS 2.1',
    tag: 'Coding agent',
    blurb: 'Compact coding agent with tool calling and a large context window.',
    costRank: 6,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni:free',
    label: 'Nemotron 3 Nano Omni',
    tag: 'Omni',
    blurb: 'Multimodal perception model for text and broader context reasoning.',
    costRank: 7,
  },
];

const ALLOWED = new Set(FREE_CHAT_MODELS.map((m) => m.id));

export function normalizeOpenRouterModel(raw?: string | null): string {
  const id = (raw ?? '').trim();
  if (id === 'auto' || id === '') return DEFAULT_OPENROUTER_MODEL;
  if (ALLOWED.has(id)) return id;
  return DEFAULT_OPENROUTER_MODEL;
}

export function listFreeChatModels(): FreeChatModel[] {
  return [...FREE_CHAT_MODELS].sort((a, b) => a.costRank - b.costRank);
}
