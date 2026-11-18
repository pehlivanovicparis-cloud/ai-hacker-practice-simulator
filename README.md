# AI Hacker Practice Simulator

A playable red-team training simulator: five staged scenarios against simulated
chatbots, a prompt journal with Arcanum classification, and a portfolio of
training writeups with a one-click Markdown training-record export.

Copyright © 2026 Paris Pehlivanovic. All rights reserved.

## What it is

The simulator reproduces the hosted AI Hacker Practice Simulator as a
standalone Node.js app (standard library only, zero dependencies). Each
scenario is a turn-based chat against a simulated bot. Prompts are matched
against staged kill-chain gates (Recon → Map → Inject → Amplify → Impact);
stages advance monotonically and a solved scenario stays solved.

The five scenarios:

1. **The Debug Tool** (Apprentice) — discover ShopBot's tools, look up a user
   through the diagnostic database capability, and get the bot to remove the
   account. Based on PortSwigger Lab 1 (LLM06 Excessive Agency).
2. **The Helpful Pipe** (Practitioner) — the newsletter signup passes its
   email to an unsanitized backend shell command. Based on PortSwigger Lab 2.
3. **The Poisoned Review** (Practitioner) — plant a product review carrying an
   instruction, then run the victim simulation: carlos asks about the product
   and the bot obeys the review. Based on PortSwigger Lab 3 (indirect prompt
   injection).
4. **The Raw Render** (Expert) — PageBot's output is rendered as raw HTML on
   the product page. Based on PortSwigger Lab 4 (insecure output handling).
5. **The Vault Word** (Practitioner) — extract a secret word from
   VaultKeeper's system prompt by reframing the request. Based on Lakera
   Gandalf Agent Breaker (system prompt exfiltration).

All training happens against simulated bots in an intentionally vulnerable
practice environment. Do not use these techniques against production systems
or any system without explicit written authorization.

## How to run

Requires Node.js 18 or newer. No install step — there are no dependencies.

```sh
node server.js
```

Then open http://localhost:3000 in a browser. To use a different port:

```sh
PORT=8080 node server.js
```

## How it works

- **Scenarios** — pick one from the list, read the briefing and objective,
  then chat with the simulated bot. The kill-chain bar shows your stage.
  Hints reveal the next step for your current stage and count against the run.
  Resetting a scenario clears its transcript and progress in one atomic step.
- **Prompt journal** — log prompts with Arcanum classification (intent,
  technique, evasion, input channel) and the result (worked / blocked /
  partial / untested). Entries can be tied to one of the five scenario keys;
  the server rejects any other scenario key.
- **Portfolio** — generate a writeup from a solved scenario's transcript
  (attack path, root cause, fix), or write one by hand. Generating a second
  writeup for the same scenario is rejected instead of duplicating.
- **Export report** — downloads the full training record (scenario progress,
  every journal entry, every writeup) as a dated Markdown file.

## Data

Progress is stored in `data/data.json`, created from `data/seed.json` on
first run. `data/data.json` is gitignored (it is your personal training
record); `data/seed.json` ships the empty starting state: no scenario solved,
journal empty, no writeups. Delete `data/data.json` to start over.

## Hardening notes

- Chat turns and scenario resets commit as one atomic batch: each request
  mutates the single in-memory state and persists it with a temp-file +
  rename, and all mutations run through one serialized queue.
- Stages advance monotonically and solved state is sticky — a solved
  scenario cannot be unsolved by later messages.
- Writeup generation re-checks for an existing writeup inside the serialized
  mutation, so two simultaneous generates cannot both succeed.
- Journal entries are validated server-side against the five real scenario
  keys; unknown keys are rejected.
- Destructive actions (reset scenario, delete journal entry, delete writeup)
  require a two-step confirm in the UI.
