# Unvibe × OpenAI — outbound email automation brief

## What we need OpenAI to automate

Run a **builder outreach** campaign for Unvibe (unvibe.site): find students and young builders who are actively shipping software with AI coding tools, research each person deeply, score fit, personalize a short formal email, and send only when a **legitimate public contact route** exists.

**Volume:** **10 total** outreach emails for this program. Prefer quality over speed. Send on a weekend (Saturday–Sunday, America/Los_Angeles, roughly 09:30–12:30). Do not send on weekdays unless Unvibe explicitly authorizes.

**Product (one sentence):** Unvibe is a Mac-first desktop layer that helps people understand the code AI shipped—select code, get a level-matched explanation, check understanding, keep learning—without becoming another code generator.

**Channels:** Prefer an agent inbox (e.g. AgentMail) dedicated to outreach. Keep product waitlist mail separate: waitlist users only get thank-you / purchase / feedback / major-update messages, never this cold sequence on repeat.

**Hard rules**
- No purchased lists. No scraped private emails. No guessing emails.
- Skip if GitHub is dead, tutorial-only, no builder signal, no public contact, or already contacted.
- One email per person unless they reply. Never drip the same person.
- Every email must prove research (specific project / commit / hackathon / tool).
- Include a soft opt-out: “Reply stop and I will not email again.”
- Cash referral rewards are real for **waitlist/referral** flows—not in cold first-touch unless Unvibe says otherwise.
- Do not claim partnerships with Cursor, OpenAI, Anthropic, etc.
- Sign every message exactly as in the templates below.

## Who to find

Students and young builders actively shipping now: GitHub, Devpost, university hackathons, AI clubs, OSS, public technical posts. Strong signals: recent commits; hackathon; AI/LLM project; uses VS Code / Claude Code / Copilot / Cursor / Windsurf / Replit / Codex; nontrivial repo; student startup; discusses coding productivity or owning AI-written code.

## Score (0–100)

| Signal | Points |
|--------|--------|
| Actively building software now | +20 |
| Public repo with meaningful recent work | +15 |
| Uses AI to code | +15 |
| Uses IDE / AI coding tools Unvibe sits beside | +10 |
| Hackathon / student startup / open source | +10 |
| Project complex enough that understanding AI code matters | +10 |
| Publicly discusses review debt / learning / AI code ownership | +10 |
| Student / community influence | +5 |
| Clear public professional contact route | +5 |

**80–100:** send. **65–79:** send only if personalization is unusually strong. **&lt;65:** skip.

Internal audit line before send:  
`Fit: NN/100 — Tier A|B|skip — <short reasons>`

## Research checklist (per person)

1. What did they build?  
2. Why Unvibe (AI code they must understand)?  
3. Which moment fits (select → explain → Test me)?  
4. One sentence that proves research?

---

## Email style

- Formal, warm, concise (120–180 words).  
- One purple heart **💜** near the close (not in the subject; not spammy stacks of emoji).  
- One CTA: https://unvibe.site  
- Plain text preferred; HTML optional if the heart renders cleanly.  
- No hype (“revolutionize”), no fake traction, no attachments.

### Required signature (every email)

```
Sincerely,
Preston Susanto
Founder, Unvibe
https://unvibe.site
```

---

## Templates

Replace `[Name]`, `[Specific proof]`, `[Unvibe fit]`. Never send a template without filled research fields.

### Template A — Hackathon / agent project (default)

**Subject:** Your `[Project]` work — and owning the AI-written paths

Dear `[Name]`,

I hope this message finds you well. I recently reviewed `[Specific proof — e.g. your TreeHacks project that chains an LLM with a FastAPI backend]`, and it is clear you are shipping serious systems rather than tutorial demos.

Unvibe is built for builders in that position. When AI tools write orchestration or UI paths, Unvibe sits beside your editor so you can select the code, receive a careful explanation at the depth you choose, and confirm you understand it before you move on.

If that would be useful in your current work, you are welcome to join the waitlist here: https://unvibe.site

Thank you for your time. 💜  
Reply stop and I will not email again.

Sincerely,  
Preston Susanto  
Founder, Unvibe  
https://unvibe.site

---

### Template B — Active GitHub / AI tooling

**Subject:** `[Repo or stack]` and keeping ownership of AI-assisted code

Dear `[Name]`,

I am writing because of your recent work on `[Specific proof — repo + what it does + recent activity]`. The combination of active building and AI-assisted development is exactly where Unvibe is meant to help.

Unvibe is a Mac desktop layer for understanding code you (or an agent) just shipped: select a passage, choose an explanation level, ask a follow-up, and optionally test your understanding—quietly, next to the tools you already use.

If you would like early access, the waitlist is at https://unvibe.site

I appreciate your consideration. 💜  
Reply stop and I will not email again.

Sincerely,  
Preston Susanto  
Founder, Unvibe  
https://unvibe.site

---

### Template C — Student / community builder

**Subject:** A note from Unvibe for student builders

Dear `[Name]`,

I came across your work through `[Specific proof — club, hackathon, OSS, or portfolio piece]`. It stood out because you appear to be learning by shipping real software, including work that likely involves AI-generated code.

Unvibe exists so that speed from AI tools does not come at the cost of understanding. Select the code in question, get a clear explanation grounded in your project context, and keep a short learning trail you can return to.

You may request access at https://unvibe.site whenever convenient.

Thank you again for all that you are building. 💜  
Reply stop and I will not email again.

Sincerely,  
Preston Susanto  
Founder, Unvibe  
https://unvibe.site

---

### Template D — Soft follow-up (only if they opened/replied vaguely; never automatic re-blast)

**Subject:** Re: Unvibe — brief follow-up

Dear `[Name]`,

I wanted to follow up once on my earlier note about Unvibe. No pressure at all—only if understanding AI-assisted code in `[their stack/project]` is still relevant for you.

The waitlist remains here: https://unvibe.site

Wishing you well with `[specific project]`. 💜  
Reply stop and I will not email again.

Sincerely,  
Preston Susanto  
Founder, Unvibe  
https://unvibe.site

---

## Reporting OpenAI should return

Weekly: number researched, scored, sent, bounced, replied, waitlist clicks (if tracked), top objections. Include 5 anonymized example personalizations (no private data beyond what was already public and used to send).

## Success definition

Personalized first-touch emails that sound researched, respect consent, drive waitlist interest among AI-native student builders, and never spam Unvibe’s existing waitlist list.
