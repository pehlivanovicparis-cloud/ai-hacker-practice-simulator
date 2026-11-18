# AI Hacker Practice Simulator — Build Log

Built 2026-11-18 from the hosted artifact `ai-hacker-practice-simulator`
(probed live via list_actions + read/state actions; scenario content, bot
replies, writeup format and dedupe behavior recovered from the artifact, not
from source). Stack: Node.js standard library only, zero dependencies.

Smoke test (2026-11-18, local server on port 3217):
- GET / → 200; GET /api/state → 5 scenarios, journal 0, writeups 0.
- Scenario 1, 3 turns: discovery → stage 2 (tool list incl. debug_sql);
  lookup carlos → stage 4 (carlos row returned); delete carlos → stage 5,
  status solved, 2 replies. Further messages keep it solved (sticky).
- Writeup generated (id 1, 3 attack-path prompts); second generate → 409
  with the hosted artifact's dedupe message. Journal add works; invalid
  scenario_key → 400. Export returns dated Markdown containing the scenario
  table, journal entry, and writeup. Victim sim without a planted review →
  stage 4, not solved. Hint returns stage-appropriate hint, hints_used 1.
- Restart persistence: after kill + restart, Scenario 1 still solved,
  journal 1, writeups 1. Reset returns Scenario 1 to not_started/stage 0
  with the greeting re-seeded. data/data.json removed after testing so the
  shipped tree starts from the seed state.
- Payload sweep: no literal exploit payload strings in the tree. Scenario 2's
  hints 3–5 in the hosted artifact contained literal shell-command strings;
  replaced with "[technique described, payload withheld]".

Self-score:
1) Goal hit? Yes — all 5 probed scenarios reproduced, smoke tests green, pushed.
2) Tools right? Yes — artifact probe recovered the real content; GitHub CLI + read tools verified the repo state before pushing.
3) Waste — what I'd skip next time? The first smoke-test port (3101) was already in use on the shared box; check the port with ss before starting the server instead of debugging a dead bind.
