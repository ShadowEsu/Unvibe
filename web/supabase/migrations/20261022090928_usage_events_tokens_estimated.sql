-- Marks usage_events token counts that are a chars/4 estimate rather than counts Gemini reported.
-- Estimates are written when Gemini accepted a request but sent no final usageMetadata (stream cut
-- off, client abort), so AI cost can be reported as "measured X, estimated Y". Additive only;
-- existing rows and measured writes keep the default (false). Counts only, no content.
-- Access is unchanged: usage_events stays service-role only.
--
-- Rollback:
--   alter table public.usage_events drop column if exists tokens_estimated;

alter table public.usage_events
  add column if not exists tokens_estimated boolean not null default false;
