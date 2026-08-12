# LORE — Build Progress

Last agent: codex   Last updated: 2026-08-12

## Status
- [x] Phase 0 — scaffold & design system
- [x] Phase 1 — parser
- [ ] Phase 2 — stats & awards
- [ ] Phase 3 — LLM layer (Sweetheart, placeholder prompt)
- [ ] Phase 4 — report render (CHECKPOINT: show human)
- [ ] Phase 5 — all modes + share cards
- [ ] Phase 6 — PDF
- [ ] Phase 7 — full funnel UX
- [ ] Phase 8 — LATER: payments/pricing/credibility

## Where the next agent should start
Start Phase 2 — implement deterministic stats and awards. Keep all numeric outputs out of the LLM layer.

## Decisions & deviations
- The Phase 0 demo follows the locked Round 2 editorial system; the earlier hero-directions file is treated as exploratory context.
- The unlock button intentionally has no price because pricing is deferred.
- Used Next.js 16.3.0 with React 19.2.8 after npm flagged older scaffold versions; the final dependency audit reports zero vulnerabilities.
- Kept both editorial and soft Sweetheart treatments available on `StatCard` and `AwardBadge`, matching the design without implementing later report screens.
- Phase 1 returns `{ messages: Message[], mediaCount }`; ZIP parsing uses `jszip`, counts archive attachments without double-counting their transcript references, and adds genuinely omitted media markers.
- Ambiguous dates default to DMY after file-wide detection; callers can override `dateOrder`, and `participants` can disambiguate a one-off sender name containing a colon.
- The real-export sanity check produced 125 messages across 2 participants, 6 media items, and a 743-day span. The private ZIP is ignored and was not added to Git.
- `next-env.d.ts` is ignored rather than tracked, per the bundled Next.js 16 TypeScript guidance, because `next dev` and `next build` regenerate different references.

## Known issues / TODO
- None currently.
