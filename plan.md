# Design & Theme (current site — keep consistent)

The existing site (`Genesis-Pool-and-Spa-main/`) has an established visual identity. Any
new work (including the contact popup below) should match it rather than introduce a new
style.

**Positioning**: "The Chemistry of Clean" — the brand leans on pool science/water safety
credibility (FUN, HEALTH, SAFE, CLEAN) rather than a luxury/resort spa vibe. Copy reads as
a licensed, trustworthy local technician, not a lifestyle brand.

**Color palette** (all defined as CSS custom properties in `css/styles.css`):
- Primary blue: `#1565C0`, dark `#0D47A1`, light `#42A5F5`, pale tint `#E3F2FD`
- Deep navy accent: `#0D2A6B` (used in hero gradients and dark text-on-light contexts)
- Amber/gold accent: `#FFB300` (used sparingly — badges, the "Free Equipment Repair"
  banner — as the one warm contrast note against all the blue)
- Neutrals: white, gray-50 `#F8FAFB` through gray-800 `#1E293B`, body text `#334155`
- Hero and other feature sections use diagonal blue gradients (e.g.
  `linear-gradient(160deg, #0D2A6B 0%, #1565C0 60%, #1976D2 100%)`), not flat fills.

**Typography**: Poppins (system-ui/-apple-system fallback), sans-serif throughout.
- Headings are bold-to-heavy (700–800 weight), often with tight/negative letter-spacing
  at large sizes (hero h1 uses `clamp(2.75rem, 6.5vw, 5.5rem)` with `-0.025em` tracking)
- Small labels/eyebrows (hero label, section labels, badges) use uppercase, wide letter
  spacing (~0.14em), small size (~0.7rem), bold weight — a consistent "kicker text" pattern
  above every major heading
- Section headings scale fluidly with `clamp()` rather than fixed breakpoints

**Shape & elevation**:
- Rounded corners everywhere: 12px standard radius, 20px for larger cards/panels
- Soft, blue-tinted shadows rather than neutral gray (`rgba(21,101,192,0.10)` and
  `0.16)` for the elevated/hover state) — shadows reinforce the blue theme instead of
  looking like a generic gray drop shadow
- 0.25s ease transitions on interactive elements (buttons, header state, nav links)

**Header behavior**: transparent/white-text over the hero, then flips to a white
background with dark text once scrolled (`#header.scrolled`) — a common pattern for
sites with a full-bleed hero image.

**Hero**: full-bleed photo background (currently hosted on Wix's CDN) with a dark
navy-to-transparent gradient overlay for text legibility, big bold headline with one
word highlighted in a color span, short supporting line, then CTA buttons (solid
primary-blue button + a ghost/outline button with translucent white border).

**Page structure/rhythm** (`index.html`): Hero → Features → "Free Equipment Repair"
lead-gen banner → Services → Before/After results → About → Service Area (dark blue
`.light` section-header variant) → Testimonials → Contact. Each major section repeats
the same header pattern: small uppercase eyebrow label, bold heading, then centered
supporting paragraph.

**Takeaway for future work**: reuse the existing CSS variables (`--primary`,
`--primary-dark`, `--primary-xl`, `--gray-*`, `--radius`, `--shadow`), Poppins font,
uppercase-eyebrow + bold-heading section pattern, and blue-gradient/rounded-card
treatment. Any new UI (e.g. the contact popup) should look like it was built by the same
designer as the rest of the site — blue-and-white, rounded, soft blue shadows, amber used
only as a rare accent.

---

# Services List

Current services on the live site (`index.html` → `#services`, one `.service-card` each):
- Weekly Pool Cleaning
- Chemical Balancing & Water Testing
- Equipment Repair & Maintenance
- Spa & Hot Tub Service
- Tile Cleaning (planned addition — not yet built into `index.html`; needs its own
  `.service-card` with icon, heading, and description matching the pattern above, per the
  [[Design & Theme]] section)

**Summer promo**: Tile Cleaning is being offered **free to anyone who signs up this
summer** (2026) — a limited-time signup incentive, distinct from Tile Cleaning existing
as a permanent line item in the services grid going forward. This should be featured
somewhere promo-worthy (e.g. a banner styled like the existing "Free Equipment Repair"
banner, or worked into the promo bar copy change below) once built.

---

# Copy Change: Promo Bar ("Free Inspection" → "Free Chemical Balancing + Cleaning")

Decision: retire the "FREE Inspection + Testing" promo bar copy and its 🔍 magnifying-
glass icon (`&#128269;`). New copy: **"FREE Chemical Balancing + Cleaning"** — no
magnifying glass; needs a replacement icon/emoji or no icon at all, consistent with the
site's existing icon style (see [[Design & Theme]]).

Current occurrences of the old copy that would need to change together for consistency:
- `index.html` promo bar (top of every page via shared header)
- `schedule.html` promo bar (same shared markup)
- `schedule.html` `<title>`, meta description, OG/Twitter tags, and the page `<h1>`
  ("Schedule Your Free Inspection + Testing")
- `schedule.html` form CTA button ("Request My Free Inspection")
- `thankyou.html` confirmation copy ("Your free inspection request has been received...")

Open question: does the rename apply everywhere above, or only to the promo bar itself
(with `schedule.html`/`thankyou.html` kept as "Inspection" since that page may still
include an inspection step)? Flagging rather than assuming, since the new copy changes
what's being promised (chemical balancing + cleaning vs. an inspection visit).

---

# Contact Preference Popup — Lead Routing Plan

Architecture notes for the planned popup: "How would you like us to reach you?" with three
independent checkboxes — visitors can select any one, two, or all three.

- [ ] Talk to one of us (call)
- [ ] Have us email you
- [ ] Text me

Twilio (+1 916-251-4798, already live on the site) is scoped to the AI SMS channel only —
it is not used for the call-alert or email flows.

## Call — "talk to one of us"

- **Goal**: get the lead on a live phone call with a sales representative, either almost
  immediately or at a time the lead picks — via a Twilio-driven warm transfer, not a
  direct ring to staff.
- **Form options**: a lead who chooses "talk to one of us" picks between:
  - **ASAP** — Twilio calls them back, likely within 1–2 minutes of submitting.
  - **Scheduled** — a specific date/time they choose, any day, between **6:00 AM and
    7:00 PM**.
- **Twilio call flow** (the lead is never connected straight to a sales rep — Twilio
  always screens the call first):
  1. At the requested time (immediately, or at the scheduled moment), Twilio places an
     outbound call to the lead's number.
  2. The flow **confirms a live human connection** before anything else happens — e.g. a
     "Press 1 to speak with a Genesis Pool and Spa representative" IVR prompt is more
     reliable here than relying solely on Twilio's Answering Machine Detection (AMD),
     which has known false-positive/latency issues; this step exists specifically to
     make sure a person, not voicemail, picked up.
  3. Once confirmed, notify the manager (voice call, SMS, or Slack/push via a webhook)
     that a lead is connected and will be redirected to a sales rep **in 2 minutes** —
     a heads-up buffer so the rep isn't caught by an unannounced call.
  4. The lead is held for that 2-minute window (hold message/music — e.g. "Thanks!
     Connecting you with a specialist now.").
  5. After the buffer, Twilio bridges/conferences the lead's call into the sales
     representative's line.
- **Caveat**: the <2-minute intent only covers the ASAP option's initial outbound dial —
  the 2-minute manager heads-up is a deliberate buffer *after* the lead is already
  confirmed live on the phone, separate from that callback-speed goal. Reliability still
  depends on a sales rep actually being reachable when the bridge happens; consider what
  happens on no answer (see open questions).

### Twilio + Google Sheets — what's needed to build the redirect flow

**Twilio side**:
- A Twilio number with **Programmable Voice** enabled (may be the existing
  916-251-4798 number or a separate one — ties into the open question below about
  splitting voice from the AI SMS channel).
- A call-flow definition — either a **Twilio Studio Flow** (no-code: Trigger → Gather/
  confirm → notify manager → Wait 2 min → Dial/Conference) or a small **serverless
  function** (Vercel/Netlify/etc.) driving the Voice API + TwiML directly, which gives
  more control over retries and no-answer branching.
- The "confirm connection" step: a `<Gather>` press-1 IVR prompt (recommended) or AMD,
  wired into whichever flow engine is chosen above.
- A **conference resource** (Twilio `<Conference>`) to bridge the two legs: the lead
  joins on confirmation, the sales rep's leg is added after the 2-minute wait.
- A trigger for *when* the call fires:
  - ASAP: fire immediately on form submission.
  - Scheduled: Twilio has no built-in delayed-call scheduler, so this needs an external
    scheduler — a cron-triggered serverless function, or a Zapier "Schedule" step —
    that checks pending scheduled times and fires the Twilio API call when one arrives.
- `statusCallback` webhooks on each call leg so the system knows whether the lead
  answered/confirmed, and whether the rep picked up — this is what feeds status back
  into the sheet below.

**Google Sheets side**:
- The sheet acts as the lead/schedule database: one row per form submission (name,
  phone, contact preference, ASAP vs. scheduled time, timestamp, status, assigned rep).
- Form → Sheets connection: either the form posts directly via the Sheets API, or (same
  pattern as the rest of this plan) Zapier sits in between — form submits → Zapier →
  appends a row → Zapier/the serverless function reads that row to trigger Twilio.
- A service account or OAuth credential for whichever tool (Zapier or the serverless
  function) needs to read/write the sheet.
- Status gets written back to the same row as the call progresses (called / no-answer /
  connected / redirected to rep X) so the sheet doubles as a lightweight lead-tracking
  log the manager can glance at.
- Scheduled times should be stored unambiguously with timezone, since the "6 AM–7 PM"
  window is presumably Sacramento local time.

## Email — "have us email you"

- **Goal**: an AI-drafted reply is sent from `contact@genesispoolandspa.com`.
- **Mechanism**: webhook → Zapier → AI step (Zapier's built-in AI action, or a Code step
  calling an LLM API) drafts a reply grounded in the visitor's message and the business's
  services/hours/service-area info → sent via Gmail/Google Workspace integration
  authenticated as `contact@genesispoolandspa.com`.
- **Dependency**: that mailbox needs to be a real inbox Zapier can authenticate against
  (Gmail/Workspace OAuth, or SMTP credentials if using a different provider).

## Text — AI SMS

- **Goal**: the Twilio number carries on a live SMS conversation, with an AI agent
  answering visitor questions.
- **Mechanism**: Twilio Programmable Messaging number → inbound SMS webhook → small
  backend (serverless function, e.g. a Vercel/Netlify function, or Zapier + Code step) →
  AI reply grounded in business info → response sent back via the Twilio API.
- This is the one channel that actually needs Twilio — a live two-way AI conversation loop
  isn't something Zapier alone handles cleanly.
- Open question: does this same number also carry live voice calls (forwarded to staff),
  or should voice ring a separate line from the AI SMS number?

## All three selected

Each flow fires independently and in parallel — no sequencing or priority logic needed.

## Open questions before building

1. Zapier plan tier — needs instant (webhook-based) triggers, not polling, to hit the
   sub-minute call-alert goal.
2. Who/what receives the "call now" alert — a specific phone, a rotation, or a shared
   Slack/push channel?
3. Which LLM/API to use for email drafting and SMS replies.
4. Whether +1 916-251-4798 carries both live voice and AI SMS, or if those should split.
5. Popup trigger timing — on load, exit-intent, or after a delay.
6. Which sales rep gets the redirect — a fixed number, a rotation, or availability-based
   — and where that logic lives (Sheets lookup vs. hardcoded in the Twilio flow).
7. What happens on no-answer/no confirmation, or if no rep is reachable after the
   2-minute buffer — retry, voicemail, or fall back to a callback request?
8. Who is "the manager" for the 2-minute heads-up — a specific phone/Slack channel, or
   a rotation of their own?
9. Twilio Studio Flow (no-code) vs. a custom serverless function for the confirm →
   notify → wait → bridge logic — Studio is faster to stand up, a function gives more
   control over retries/no-answer handling.

## Status

Architecture only — not yet built. Blocked on: Twilio account/number confirmation, a
Zapier account (tier depends on the speed requirement above), Gmail/Workspace access for
`contact@genesispoolandspa.com`, and the open questions above.
