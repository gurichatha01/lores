# LORE — Master Build Plan
_Agent-agnostic. Works for Codex **and** Claude Code. Build phase by phase._

This doc + the `/design` folder are the complete source of truth. Read both fully before writing any code.

---

## 0. HOW TO USE THIS DOC (read first — applies to any coding agent)

You may be **Codex or Claude Code**, and the human switches between us mid-build. So we coordinate through files, not memory:

1. **Read `PROGRESS.md` first.** It's the single source of truth for what's done. If it doesn't exist yet, you're starting Phase 0 — create it from the template in §9.
2. **Work one phase at a time, in order.** Do not skip ahead or pull work forward from a later phase. Each phase is a clean, self-contained handoff point.
3. **At the end of every phase:**
   - Make sure the phase's **"Done when"** checklist all passes.
   - `git add -A && git commit` with message `phase N: <summary>`.
   - Update `PROGRESS.md`: tick the phase, note any decisions or deviations, and write one line on where the next agent should start.
4. **Don't refine deferred things.** The LLM prompt quality and pricing/payments are intentionally deferred (see §8). Use the placeholders as-is; don't spend effort tuning them yet.
5. **Match the design; don't invent UI.** `/design` is authoritative for layout, type, and color.
6. If a decision isn't specified here, make the smallest reasonable choice, note it in `PROGRESS.md`, and keep moving. Don't block.

---

## 1. WHAT WE'RE BUILDING

A mobile-first web app. A user uploads their exported WhatsApp chat and gets a **report about a relationship or group** — real stats no one remembers, plus a narrative written in the AI's voice. It's built to be **screenshot-shared** and **gifted** (birthdays, anniversaries). One engine, several **modes** (Sweetheart, Ride or Die, Group Wrapped, Family, Work, Roast) that swing from sweet keepsake to savage roast.

Product name: **lore** (lowercase).

**The value = real numbers + a witty/warm read that feels handcrafted.** The design already sets the copy quality bar; the build's job is to hit it.

---

## 2. NON-NEGOTIABLE PRINCIPLES

1. **Privacy by architecture.** The raw chat is parsed **entirely in the browser**. Only aggregated **stats + a small curated message sample** are ever sent to the server/LLM. The full chat never leaves the device. This is a real selling point, not just a nicety.
2. **Code counts, the LLM only writes.** Every number (counts, reply times, streaks, awards) is computed deterministically in TypeScript. The LLM never produces or alters a statistic — it only writes prose around numbers we give it.
3. **The LLM returns strict JSON**, parsed defensively, so each field maps to a UI slot.
4. **Design is source of truth.** Reproduce `/design`; don't restyle.

---

## 3. TECH STACK & CONVENTIONS

- **Framework:** Next.js (App Router) + **TypeScript** + **Tailwind CSS**.
- **Client-side parsing:** all parsing/stats run in the browser. Use `jszip` for `.zip` exports.
- **Server:** a single Next.js API route (`/api/generate`) proxies the LLM call and holds the API key. It receives only `{ mode, subtype, userContext, stats, awards, sample }` — never raw chat.
- **LLM provider:** behind one swappable module `lib/llm.ts`. Implement **Google Gemini Flash** first (has a free tier). Provider selected via env `LLM_PROVIDER`.
- **Image export (share cards):** `html-to-image` or `html2canvas`.
- **PDF:** render an HTML template → PDF (e.g. `@react-pdf/renderer` or print-to-PDF via a headless route; agent's choice, note it in PROGRESS).
- **Testing:** `vitest` for parser/stats unit tests.
- **Fonts:** Archivo (display, weights 400–900) + Space Mono (mono labels, 400/700), via Google Fonts.
- **Env vars:** `LLM_PROVIDER=gemini`, `LLM_API_KEY=...`. Provide `.env.example`.
- **Commits:** one per phase minimum, message prefixed `phase N:`.

---

## 4. REPO STRUCTURE (target)

```
/design/                 # exported design HTML/CSS — the visual reference (READ-ONLY)
/src
  /app
    page.tsx             # landing
    /create              # the funnel steps
    /report/[id]         # report render (or client state)
    /api/generate/route.ts
  /lib
    parseWhatsApp.ts     # zip/txt → Message[]
    computeStats.ts      # Message[] → ChatStats
    assignAwards.ts      # ChatStats → Award[]
    curateSample.ts      # Message[] + stats → sample Message[]
    llm.ts               # provider-agnostic generateReport()
    types.ts             # all shared types
  /components
    report/              # report UI (matches /design)
    cards/               # 9:16 share cards
    /ui                  # buttons, chips, stat card, award badge
/tests                   # vitest specs + sample exports
PROGRESS.md              # handoff log (see §9)
.env.example
```

---

## 5. DESIGN TOKENS (from `/design` — use these exact values)

- **Type:** `Archivo` display (900 for hero numbers, tight tracking ~-3px), `Space Mono` for uppercase labels (.1em tracking).
- **Base:** ink `#0a0a0a`, off-white surface `#f3f3ef`, card white `#ffffff`, hairline border `#cfcfc8`.
- **Brand accents:** pink `#ff2d78`, acid/lime `#ccff00`.
- **Per-mode accent:**
  | Mode | Accent | Treatment |
  |---|---|---|
  | Sweetheart | `#f0568a` rose | light, soft, rounded, pink shadows |
  | Ride or Die | `#ff5c1a` hot-orange | light, punchy |
  | Group Wrapped | `#2b2bef` cobalt | light, scoreboard |
  | Family | `#e8940c` amber | light, cozy |
  | Work | `#0f8f8f` teal | light, cool |
  | Roast | `#e11400` red | **dark** bg, heat, warning-tape |
- **Share cards:** dark base `#0b0b0c` (roast `#120a08`), 9:16, `lore_` watermark (underscore in accent).
- **Report has two states:** `teaser` (locked/blurred + sticky unlock bar) and `full` (paid).

---

## 6. DATA MODEL (define in `lib/types.ts` — descriptive)

```ts
export type Mode = 'sweetheart' | 'rideordie' | 'group' | 'family' | 'work' | 'roast';

export interface Message {
  timestamp: Date;
  sender: string;
  text: string;
  wordCount: number;
  hasEmoji: boolean;
  emojis: string[];
}

export interface PersonStats {
  name: string;
  messageCount: number;
  messageShare: number;        // 0..1
  wordCount: number;
  avgWordsPerMessage: number;
  medianReplyTimeMin: number;  // median gap when replying to the other person
  conversationStarts: number;  // first msg after a >6h gap
  lastOfDayCount: number;       // "goodnight-er"
  lateNightCount: number;       // msgs sent 00:00–04:00
  laughCount: number;           // haha/lol/😂/💀 etc.
  topEmojis: { emoji: string; count: number }[];
  topWords: string[];
}

export interface ChatStats {
  isGroup: boolean;
  people: PersonStats[];
  totalMessages: number;
  totalWords: number;
  novelsEquivalent: number;     // totalWords / 80000, rounded
  mediaCount: number;
  firstMessageDate: Date;
  lastMessageDate: Date;
  spanDays: number;
  busiestDay: { date: Date; count: number };
  longestStreakDays: number;    // consecutive days all active
  longestSilenceDays: number;
  messagesByHour: number[];     // length 24
  messagesByWeekday: number[];  // length 7 (Mon..Sun)
}

export interface Award { id: string; label: string; emoji: string; who: string; }

// What the LLM returns (words only — never numbers):
export interface ReportContent {
  title: string;
  heroLine: string;                                   // framing under the big number
  highlights: { label: string; body: string; bubble?: string }[];
  awardLines: { awardId: string; line: string }[];    // one witty line per award
  narrative: string;                                  // the on-screen read
  chapters?: { title: string; body: string }[];       // for the PDF, month/theme based
}
```

---

## 7. THE PHASES

> Milestone to care about: **end of Phase 4** = first real report rendered from a real chat. That's the "is this actually good?" checkpoint. Everything before it is plumbing; everything after is expansion.

### PHASE 0 — Scaffold & design system
**Goal:** running Next.js app with the design tokens wired.
**Tasks:** init Next+TS+Tailwind; load Archivo + Space Mono; put mode accents + base colors into Tailwind config; build base UI primitives (`Button`, `Chip`, `StatCard`, `AwardBadge`) to match `/design`; create `.env.example`; create `PROGRESS.md`.
**Files:** app skeleton, `tailwind.config`, `/components/ui/*`, `PROGRESS.md`.
**Done when:** app runs; a demo page shows the primitives styled like `/design`; fonts + colors correct.

### PHASE 1 — Parser (the engine, part 1)
**Goal:** turn any WhatsApp export into `Message[]`.
**Tasks:** `parseWhatsApp.ts`. Accept `.zip` (unzip in-browser, find `_chat.txt`, count media files) **and** raw `.txt`. Handle **iOS** (`[dd/mm/yy, h:mm:ss AM/PM] Name: msg`) and **Android** (`dd/mm/yyyy, HH:mm - Name: msg`) formats, both date orders, 12h/24h. Merge multi-line messages (continuation lines belong to the previous message). Filter system lines (`<Media omitted>`, "This message was deleted", "X added/removed Y", encryption notice, group changes) but count media into `mediaCount`. Output `Message[]`.
**Files:** `lib/parseWhatsApp.ts`, `/tests/parse.spec.ts`, sample `.txt` fixtures (iOS + Android, 1:1 + group).
**Done when:** unit tests pass for both formats, multi-line, and system-line filtering; parsing a real export produces sane counts.

### PHASE 2 — Stats & awards (the engine, part 2)
**Goal:** `Message[]` → `ChatStats` + `Award[]`, deterministic.
**Tasks:** `computeStats.ts` implementing every field in §6 (see definitions in comments there). `assignAwards.ts` mapping metrics → awards: Certified Ghost 👻 (highest median reply time), Main Character 🎭 (highest message share), 3AM Overthinker 🌙 (most late-night), One-Word Warrior 🗿 (lowest avg words), Comedian 🎤 (most laughs), The Initiator 🚀 (most conversation starts), plus room for more. Awards are computed, never AI-chosen.
**Files:** `lib/computeStats.ts`, `lib/assignAwards.ts`, `/tests/stats.spec.ts`.
**Done when:** tests cover the tricky ones (median reply time, streak, busiest day); running on a real chat gives believable numbers.

### PHASE 3 — LLM layer (one mode, placeholder prompt)
**Goal:** given engine output, get `ReportContent` back as strict JSON.
**Tasks:** `lib/curateSample.ts` — pick ~20–30 messages per person by heuristics (longest, high-laugh, keyword hits, plus a random time spread). `lib/llm.ts` — `generateReport(input): Promise<ReportContent>` behind a provider switch; implement Gemini Flash. `/api/generate/route.ts` — POST receiving `{ mode, subtype, userContext, stats, awards, sample }`, returns `ReportContent`; API key server-side only. Write **one placeholder system prompt** for **Sweetheart** mode that returns the schema (don't over-tune — that's deferred). Parse defensively: strip ``` fences, try/catch, one retry on invalid JSON.
**Files:** `lib/curateSample.ts`, `lib/llm.ts`, `app/api/generate/route.ts`, `.env` wiring.
**Done when:** calling the route with real engine output returns valid `ReportContent`; only stats+sample cross the network (verify no raw chat is sent).

### PHASE 4 — Report render, full state ⭐ (the checkpoint)
**Goal:** a real, designed report page from a real chat.
**Tasks:** build the **full-state** report component matching `/design`: hero stat (from stats), stat cards, awards (badges + AI lines), highlights/receipts (bubbles), narrative. Wire the whole flow end-to-end for a hardcoded uploaded file → parse → stats → awards → curate → generate → render. Sweetheart mode only.
**Files:** `/components/report/*`, a minimal `/create` → `/report` flow.
**Done when:** you upload a **real exported chat** and see a complete, on-brand Sweetheart report. **Stop here and show the human** — this is the "is the output good?" gate before building the rest.

### PHASE 5 — All modes + share cards
**Goal:** mode presets + the viral unit.
**Tasks:** turn mode into a preset (which stats surface + which system prompt/voice) for all six modes, each with a placeholder prompt. Build the report in each mode's treatment (soft for Sweetheart/Family, dark/heat for Roast, etc.). Build the **9:16 dark share-card** renderer with image export; generate a set (hero stat, each award, a savage line); `lore_` watermark.
**Done when:** every mode renders; share cards export as images that match `/design`.

### PHASE 6 — The Wrapped share card ⭐ (the ONE share surface)
**Why:** the per-stat share cards from Phase 5 are clutter — the stats already live on the report page and in the PDF, so a menu of shareables is friction for no benefit. There should be exactly **one** shareable card: a Spotify-Wrapped-style summary that condenses the whole report into one 9:16 image. A stranger seeing it on someone's story should get the whole story in one tap and think "I need mine." This is the app's main acquisition surface.
**Tasks:**
- **Delete** the per-stat share cards built in Phase 5 (the hero-number card, award card, roast/verdict card — the 9:16 PNG shareables). Do NOT touch the stat cards on the report page — those are the report, not shareables, and they stay.
- Build ONE `WrappedCard` (9:16, 1080×1920 export, per-mode treatment) that packs, densely but designed like a poster (not a wall of text):
  - relationship framing + span (e.g. `💕 Guri & Sanj · 2 years`)
  - the hero number (messages / words)
  - 3–4 tightest stats (e.g. texts-first %, streak, late-nights, reply time)
  - the headline award (one, with badge)
  - ONE punchy line — the sweet or savage one-liner for the mode
  - `lore_` watermark + `get yours → lore.app`
- This single card is the whole share surface. All values come from the engine; the one-liner comes from `ReportContent`.
**Done when:** one Wrapped card exports as a clean 9:16 PNG per mode, readable as a self-contained story; the old per-stat share cards are gone; the report-page stat cards are untouched.

### PHASE 7 — PDF keepsake
**Goal:** the paid, printable artifact.
**Tasks:** multi-page PDF matching `/design`: cover, deep-metrics page (month bars, hour heatmap, weekday, response distribution, emoji, busiest day), awards + per-person top words + milestones, month/theme **chapters** narrative (uses `ReportContent.chapters`), closing keepsake page. Printable A4/Letter. **Note:** some design-mock stats aren't computed yet (e.g. good-mornings count, "I love you" count, reply-time distribution buckets) — list what the PDF shows that `computeStats` lacks and add those stats here.
**Done when:** a report generates a downloadable PDF that looks like the design's PDF pages.

### PHASE 8 — Full funnel UX
**Goal:** the real user flow, incl. the teaser state.
**Tasks:** landing (hero + CTA + credibility slots as placeholders); "who's this chat with?" mode picker + partner sub-type chips; optional freeform **context box**; source = WhatsApp; **export-instructions screen** with clear platform-specific (Android/iOS) steps + images (this is the drop-off cliff — make it easy); upload with privacy reassurance; generating/loading state; the **teaser/locked report state** (hero sharp, rest blurred with lock pills, receipt teased, narrative cut to line one, sticky unlock bar). Payment button is a stub for now.
**Done when:** a user can go landing → pick mode → export help → upload → generate → see teaser, all on-brand.

### PHASE 9 — Payments (Razorpay, dynamic currency)
**Goal:** unlock the full report + PDF + Wrapped card after a real payment, with India priced in INR and everyone else in USD.

**Pricing (single source of truth — put in one config object, never scatter):**
```ts
export const PRICING = {
  IN: { currency: 'INR', amount: 14900, display: '₹149' }, // amount in paise
  US: { currency: 'USD', amount: 299,   display: '$2.99' }, // amount in cents
} as const;
// India → INR; everyone else → USD. One unlock, unlocks everything.
```
Note the two aren't equal ($2.99 ≈ ₹249) — that's an intentional India-specific price, not a bug.

**PREREQUISITE — verify before building the USD path:** accepting non-INR/foreign cards on Razorpay requires **International Payments enabled on the account** (extra KYC/approval). If it's not yet approved, build **INR-only now** and gate the USD path behind a flag so it switches on later — do NOT block launch on international approval.

**Country → price:** detect country server-side (request geo / IP header). India → INR config, else → USD config. Don't over-engineer anti-VPN logic — for a ₹149 product the stakes are cents; a VPN saving ₹100 doesn't matter.

**Flow (the critical part — never trust the client that payment succeeded):**
1. Client requests unlock → **server** creates a Razorpay **order** with the amount+currency for the detected country (server decides the price, never the client).
2. Razorpay Checkout opens; user pays (UPI/cards).
3. On success, Razorpay returns a payment id + signature → **server verifies the signature** (HMAC with the key secret). Only a verified signature unlocks. A client saying "I paid" means nothing without server verification.
4. On verified payment, mark that report unlocked and serve the full report + PDF + Wrapped card.

**Tasks:** `PRICING` config; `/api/order` (server-side order creation, country→price); Razorpay Checkout on the teaser's unlock button; `/api/verify` (signature verification, server-side); flip the teaser → full report on verified unlock; keys in env (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`), secret never exposed to client. Handle failure/cancel states gracefully.
**Done when:** an Indian user pays ₹149 via UPI and unlocks everything; a non-India user is quoted $2.99 (or, if international isn't approved yet, the USD path is cleanly flagged off); payment is verified server-side; no client-side price or unlock trust.

### PHASE 10 — LATER (do not build until told): landing credibility, launch
Populate landing credibility with **real** proof only (no fabricated logos/testimonials/counts); analytics; ad funnel. Do the deferred **prompt tuning** passes and **award-fit thresholds** if not already done.

---

## 8. DEFERRED — DO NOT SPEND EFFORT HERE YET

- **LLM prompt quality.** Use simple placeholder prompts that return the schema. We tune wit/voice against real chats *after* Phase 4, as a dedicated pass. Just make the plumbing solid and the schema strict.
- **Pricing & payments.** Undecided (likely two tiers). No hardcoded final price; keep the unlock a stub until Phase 9.
- **Fake credibility.** Credibility slots are placeholders only; nothing fabricated ships.

---

## 9. `PROGRESS.md` TEMPLATE (create in Phase 0, update every phase)

```markdown
# LORE — Build Progress

Last agent: <codex|claude-code>   Last updated: <date>

## Status
- [ ] Phase 0 — scaffold & design system
- [ ] Phase 1 — parser
- [ ] Phase 2 — stats & awards
- [ ] Phase 3 — LLM layer (Sweetheart, placeholder prompt)
- [ ] Phase 4 — report render (CHECKPOINT: show human)
- [ ] Phase 5 — all modes + share cards
- [ ] Phase 6 — PDF
- [ ] Phase 7 — full funnel UX
- [ ] Phase 8 — LATER: payments/pricing/credibility

## Where the next agent should start
<one or two lines>

## Decisions & deviations
- <e.g. "used @react-pdf/renderer for PDF">

## Known issues / TODO
- <...>
```

---

## 10. FIRST INSTRUCTION (paste to whichever agent you open)

> Read this whole doc and the `/design` folder, then read `PROGRESS.md` (create it if missing). Start at the first unchecked phase and do **only that phase**. Match `/design`; don't invent UI. When the phase's "Done when" passes, commit as `phase N:`, update `PROGRESS.md`, and stop. Don't tune the LLM prompt or touch pricing — those are deferred. At Phase 4, stop and show me the report before continuing.
