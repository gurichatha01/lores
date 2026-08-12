# LORE — Build Progress

Last agent: codex   Last updated: 2026-08-12

## Status
- [x] Phase 0 — scaffold & design system
- [x] Phase 1 — parser
- [x] Phase 2 — stats & awards
- [x] Phase 3 — LLM layer (Sweetheart, placeholder prompt)
- [x] Phase 4 — report render (CHECKPOINT: show human)
- [ ] Phase 5 — all modes + share cards
- [ ] Phase 6 — PDF
- [ ] Phase 7 — full funnel UX
- [ ] Phase 8 — LATER: payments/pricing/credibility

## Where the next agent should start
STOP at the Phase 4 human checkpoint. Review the real Sweetheart output before authorizing Phase 5; do not tune prompts or start additional modes yet.

## Decisions & deviations
- The Phase 0 demo follows the locked Round 2 editorial system; the earlier hero-directions file is treated as exploratory context.
- The unlock button intentionally has no price because pricing is deferred.
- Used Next.js 16.3.0 with React 19.2.8 after npm flagged older scaffold versions; the final dependency audit reports zero vulnerabilities.
- Kept both editorial and soft Sweetheart treatments available on `StatCard` and `AwardBadge`, matching the design without implementing later report screens.
- Phase 1 returns `{ messages: Message[], mediaCount }`; ZIP parsing uses `jszip`, counts archive attachments without double-counting their transcript references, and adds genuinely omitted media markers.
- Ambiguous dates default to DMY after file-wide detection; callers can override `dateOrder`, and `participants` can disambiguate a one-off sender name containing a colon.
- The real-export sanity check produced 125 messages across 2 participants, 6 media items, and a 743-day span. The private ZIP is ignored and was not added to Git.
- `next-env.d.ts` is ignored rather than tracked, per the bundled Next.js 16 TypeScript guidance, because `next dev` and `next build` regenerate different references.
- Phase 2 reply time counts only an immediate response to a different sender and excludes gaps over 6 hours; the same >6h boundary defines a new conversation start. Same-minute replies remain valid at 0 minutes.
- Streaks require every participant to send at least once on each consecutive calendar day; longest silence counts complete inactive calendar days between active days. Metric and award ties resolve by participant/day first appearance.
- Top words exclude URLs plus common English and Hindi/Hinglish function words; top emoji/word ties preserve first-seen order. Awards are derived only from `PersonStats`.
- The real Phase 2 run produced 125 messages, 408 words, 6 media items, a 744-day inclusive span, a 24-message busiest day, a 1-day all-participant streak, and a 142-day longest silence. All six awards were computed.
- WhatsApp dates remain naive local wall-clock values from parsing through stats. Hour, weekday, and day buckets use local getters; `Date.UTC` only encodes already-local calendar fields as a day ordinal. Tests run in Asia/Kolkata and cover a 00:15 message whose UTC instant is on the previous date.
- Phase 3 serializes report dates as local `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm:ss` strings without `Z`; the API rejects UTC-suffixed timestamps and unsupported top-level fields such as a full raw chat.
- Sample curation selects 25 messages per person by longest-message, laughter, keyword, and deterministic pseudo-random time-spread heuristics (configurable only within the planned 20–30 range).
- The LLM provider switch implements Gemini 3.5 Flash with a server-only key, structured JSON schema, strict runtime validation, code-fence stripping, and exactly one retry for invalid output. The Sweetheart prompt is intentionally a placeholder.
- The real Phase 3 route check used all 125 parsed messages to compute stats, curated 50 messages (25 per person), and returned valid `ReportContent` through a mocked provider response; no Gemini key is configured locally, so no live provider call was made.
- Gemini 3.5 compatibility is regression-tested: generation requests contain no `temperature`, `top_p`, or `top_k`, always end on a `user` turn, and keep `LLM_MODEL` independently swappable (including `gemini-3.5-flash-lite`).
- Phase 4 adds a minimal `/create` → `/report` browser flow. ZIP/TXT parsing, stats, awards, and curation stay client-side; only the serialized derived payload reaches `/api/generate`. The saved report session drops the curated sample and user context after generation.
- The Sweetheart full-state report follows the locked Round 2 soft treatment: rose accent, four rounded deterministic stat cards, pill awards with AI lines, message-bubble highlights, narrative, and local calendar date labels. Share cards and PDF actions remain deferred.
- The first live Gemini run completed through the real route using the private 125-message export and rendered `The Cozy Rhythm of Late Nights & Location Pins`. The browser showed no console warnings/errors at 390px or desktop width. This is the required human quality checkpoint.

## Known issues / TODO
- Human review of the first real Sweetheart report is pending. Do not continue to Phase 5 until the output is approved.
