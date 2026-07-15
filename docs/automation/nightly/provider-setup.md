# Night Lab — Provider setup

## Current provider: DeepSeek

DeepSeek is configured as the default AI provider for the Night Lab. It offers
competitive pricing, large context windows, and strong coding ability.

OpenCode supports DeepSeek natively. The provider identifier is `deepseek`.

## GitHub secrets required

### Required (set these in GitHub repo → Settings → Secrets and variables → Actions)

| Secret name | Value |
|-------------|-------|
| `DEEPSEEK_API_KEY` | Your DeepSeek platform API key |

### Required for OpenCode GitHub Action authentication

The workflow uses `GITHUB_TOKEN` (built-in, auto-created per run) for creating
branches and PRs. No additional secret needed.

### Optional (alternative providers)

| Secret name | Provider | Notes |
|-------------|----------|-------|
| `ANTHROPIC_API_KEY` | Anthropic Claude | More expensive, stronger at code review |
| `OPENAI_API_KEY` | OpenAI | Use if switching to GPT models |
| `GEMINI_API_KEY` | Google Gemini | Cheaper, good for simple tasks |

## Model identifiers

Configured via GitHub repository variables (Settings → Secrets and variables →
Variables). Change without editing YAML.

### Default values

| Variable | Default model | Purpose |
|----------|---------------|---------|
| `OPENCODE_NIGHT_MODEL` | `deepseek/deepseek-chat` | Main work (reviews, fixes, analysis) |
| `OPENCODE_REVIEW_MODEL` | `deepseek/deepseek-chat` | PR review, architecture assessment |
| `OPENCODE_SMALL_MODEL` | `deepseek/deepseek-chat` | Summaries, classification, routing |

To use a different model, set the corresponding variable in the GitHub UI.
Examples:

- `deepseek/deepseek-reasoner` — stronger reasoning, higher cost
- `deepseek/deepseek-v4-pro` — DeepSeek's most capable model
- `anthropic/claude-sonnet-4-20250514` — strong code review (needs ANTHROPIC_API_KEY)
- `anthropic/claude-haiku-3-5-20241022` — fast, cheap review
- `openai/gpt-4o-mini` — cheap, fast (needs OPENAI_API_KEY)

OpenCode model identifier format: `provider/model-id`
See: https://opencode.ai/docs/providers/

## Strategy

### Default tiered approach (cost-aware)

| Work type | Model | Rationale |
|-----------|-------|-----------|
| Repository scanning, tests, lint fixes | `OPENCODE_SMALL_MODEL` | Routine, low creativity |
| Code fixes, documentation, research | `OPENCODE_NIGHT_MODEL` | Main workhorse |
| Architecture review, failure analysis | `OPENCODE_REVIEW_MODEL` | Stronger when needed |
| Summaries, labels, routing | `OPENCODE_SMALL_MODEL` | Cheap, fast |

### How to change models

1. Go to GitHub repo → Settings → Secrets and variables → Variables
2. Edit `OPENCODE_NIGHT_MODEL`, `OPENCODE_REVIEW_MODEL`, or `OPENCODE_SMALL_MODEL`
3. Changes take effect on next scheduled run

### How to disable a paid model

1. Set the model variable to `deepseek/deepseek-chat` (free tier if available)
2. Or set `NIGHT_LAB_ENABLED=false` to stop all runs
3. Or remove the corresponding API key from Secrets

## Cost estimation

DeepSeek pricing (approximate, as of July 2026):

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|-------------------|-------------------|
| deepseek-chat | ~$0.27 | ~$1.10 |
| deepseek-reasoner | ~$0.55 | ~$2.19 |
| deepseek-v4-pro | ~$2.00 | ~$8.00 |

Per-night estimate (all 7 missions, deepseek-chat):
- ~50k–200k input tokens × 7 runs = 350k–1.4M input tokens
- ~10k–50k output tokens × 7 runs = 70k–350k output tokens
- Estimated cost: **$0.20–$0.80/night**
- Monthly: **$6–$24** (running every night)

Cost controls:
- Each mission has a 15-minute timeout
- Concurrency group prevents overlapping runs
- Emergency disable via `NIGHT_LAB_ENABLED` variable
- One mission per run, one PR maximum
- Cheap model for routine work by default

## Manual provider testing

To test the provider before the first scheduled run:

1. Create a test workflow dispatch from GitHub UI
2. Select mission `repository-health` (cheapest — no model calls if tests pass)
3. Or run `auto` which scans first then decides
4. Check workflow logs for model call success/failure

To verify OpenCode's DeepSeek integration locally:
```bash
# Requires opencode CLI installed locally
opencode github install  # interactive — follow prompts
```

## Local models vs GitHub-hosted execution

| Aspect | GitHub runner | Local machine |
|--------|---------------|---------------|
| OS | Ubuntu Linux | macOS (your machine) |
| GPU | None | Available (Apple Silicon) |
| Local models | Not available | Ollama, LM Studio |
| Network | Full outbound | Full outbound |
| Cost | GitHub Actions free quota | Your electricity |
| Security | Runs in isolated VM | Your machine |

GitHub runners cannot access local models. The workflow must use a cloud
provider (DeepSeek, Anthropic, OpenAI, etc.) configured via GitHub Secrets.

## Switching provider

To switch from DeepSeek to another provider:

1. Add the new provider's API key as a GitHub Secret
2. Update model variables to use `new-provider/model-id`
3. Run a manual dispatch to verify

To switch back, reverse the model variables.
