# Model Routing

## Current Configuration

Model assignments are configured in `opencode.json` under `model.router`.

| Agent | Model | Rationale |
|-------|-------|-----------|
| default | deepseek/deepseek-v4-flash | Fast, cheap, sufficient for most work |
| architect | deepseek/deepseek-v4-flash | Good balance of reasoning and cost |
| implementer | deepseek/deepseek-v4-flash | Good for implementation with test-first |
| test-engineer | deepseek/deepseek-chat | Cheapest — test writing is well-scoped |
| security-reviewer | deepseek/deepseek-v4-flash | Needs stronger reasoning for security |
| product-designer | deepseek/deepseek-v4-flash | Design critique benefits from reasoning |
| researcher | deepseek/deepseek-chat | Cheapest — research is read-only |
| integration-reviewer | deepseek/deepseek-v4-flash | Critical review path |

## When Only Free Model Available

When DeepSeek V4 Flash (free tier) is the only model:
1. Reduce task scope — one small change per session.
2. Use stronger process checks (skills fire more frequently).
3. Require current documentation (Context7) before implementation.
4. Require tests with every change.
5. Use independent review passes (architect + security-reviewer).
6. Avoid large autonomous refactors.

## Changing Model

Edit `opencode.json`:

```json
{
  "model": {
    "default": "anthropic/claude-sonnet-5",
    "router": {
      "architect": "anthropic/claude-sonnet-5",
      "implementer": "anthropic/claude-sonnet-5",
      "test-engineer": "deepseek/deepseek-chat",
      ...
    }
  }
}
```

## Model Selection Principles

- **Cost**: Use cheaper models for scanning, tests, docs, simple fixes.
- **Reasoning quality**: Use stronger models for architecture, security, difficult bugs.
- **Availability**: If only free-tier is available, stack process checks instead of relying on model power.
- **Context window**: Smaller models work better with smaller context — load only essential skills.
