# Twilio — Number, Automation & Verification

Everything Twilio-specific lives here: the phone number, the SMS-based lead flows that
run on it, and phone-number verification. General site/business content decisions stay
in `plan.md`; anything touching Twilio account config, phone numbers, or SMS/voice
automation belongs here instead.

## Number

- **+1 916-251-4798** — already live on the site (header/promo bar "Call" links, hero
  CTA, contact section, footer).
- Currently scoped to the **AI SMS channel only** (see "Text — AI SMS" below) and now also
  the **booking notification SMS** (see below) — not used for the "Call — talk to one of
  us" SMS confirm-flow's outbound messages, nor for the email flow (that's Zapier +
  Gmail, no Twilio involved — see `plan.md`'s Contact Preference Popup section).
- Open question: does this same number also carry live voice calls (forwarded to staff),
  or should voice ring a separate line from the AI SMS number?

---

## Booking Notification SMS (replaces FormSubmit.co email)

**Status: built.** `schedule.html` used to email new bookings via FormSubmit.co (which
also required a one-time "click to activate" step on first use). That's been dropped
entirely — every `schedule.html` submission now texts the boss directly via Twilio's REST
API, called straight from the Apps Script's `doPost` (see
[`google-apps-script.md`](google-apps-script.md)'s "Twilio SMS on new bookings" section
for the full `notifyBossOfBooking_` implementation). No Zapier involved for this one —
it's a direct `UrlFetchApp.fetch` call to `api.twilio.com` using the same
+1 916-251-4798 number as the `TWILIO_FROM_NUMBER`.

This is a **different, simpler flow** than the "Call — talk to one of us" SMS confirm-flow
below — that one is lead-facing (asks the *lead* to reply YES before the boss gets
notified); this one fires immediately, straight to the boss, on every booking, no lead
interaction involved.

**Blocked on**: the boss's phone number (`BOSS_PHONE_NUMBER`) and a Twilio Account
SID/Auth Token, entered as Script Properties in the Apps Script project — not stored in
this repo. See `google-apps-script.md`'s Deployment steps.

---

## Call — "talk to one of us" (SMS confirm → notify boss)

**Status: simplified — decision made.** The original design (Twilio auto-dials the lead,
IVR-confirms a live human, notifies the manager, holds for 2 minutes, then bridges into a
sales rep's line) was **scrapped as overbuilt**. No warm transfer, no conference bridging,
no automated outbound call, no sales-rep routing logic. Replaced with a plain two-step SMS
handoff:

1. Lead requests a call → Twilio sends them an SMS: *"Hi [Name], this is Genesis Pool and
   Spa. Reply YES to confirm you'd like a call to schedule your free chemical balancing +
   cleaning visit."*
2. Lead replies (e.g. "YES") → Twilio sends **the boss** an SMS: *"[Name] ([Phone])
   confirmed — give them a call."*
3. The boss calls the lead directly, manually, no automation beyond the two texts.

This removes essentially every open question and moving part from the original design —
no IVR, no Twilio Studio Flow, no `<Conference>`, no manager 2-minute buffer, no
no-answer/rep-availability branching. It also means the earlier "ASAP vs. scheduled
6 AM–7 PM time" form option is unnecessary for this flow specifically, since there's no
outbound call being scheduled — only an SMS, sent immediately on request.

**This flow should only fire for a phone number that's passed verification** — see "Lead
Phone Number Verification" below. Sending an automated "reply YES" text to an unverified,
possibly-fake or possibly-someone-else's number is exactly the risk verification exists
to close off.

### Building it with Zapier — two Zaps, no custom backend needed

**Zap 1 — send the confirmation SMS**
- Trigger: new lead wants a call (new row in the Booking Requests Google Sheet, filtered
  to the relevant contact preference — or whatever triggers this once the Contact
  Preference Popup exists).
- Action: Twilio → **Send SMS** to the lead's phone number with the "reply YES" message.

**Zap 2 — notify the boss on confirmation**
- Trigger: Twilio **inbound SMS** to the business number (Zapier's native Twilio trigger,
  or Twilio's messaging webhook pointed at a Zapier "Catch Hook" if the native trigger
  doesn't cover it).
- Filter: message body is "YES" (case-insensitive/trimmed) — so unrelated replies don't
  fire a false alert.
- Action: Twilio → **Send SMS** to the boss's phone number with the lead's name/phone.
  Since the inbound SMS only carries the lead's *phone number*, not their name, this step
  likely needs a lookup action first (e.g. "Find Row" in the Sheet by phone number) to
  pull the name back in before composing the boss's text.

No Twilio Studio Flow, serverless function, or custom backend required — both Zaps use
Twilio's and Google Sheets' native Zapier integrations directly.

**Open questions specific to this flow**:
- Boss's phone number for the notification SMS.
- Exact confirmation keyword — strictly "YES," or accept loose variants ("yes", "yeah",
  "sure")?
- What happens if the lead never replies — anything (a reminder text, an expiry), or does
  it just sit unconfirmed with no automated follow-up?
- Which entry point actually triggers Zap 1 — the not-yet-built Contact Preference Popup,
  or the already-live `schedule.html` booking form (its "How should we confirm before we
  arrive?" field is a *different* thing — day-of arrival confirmation for an already
  booked visit — not the same as this initial "want a call" lead flow; flagging so these
  two don't get conflated when wiring up Zaps)?

---

## Text — AI SMS

- **Goal**: the Twilio number carries on a live SMS conversation, with an AI agent
  answering visitor questions.
- **Mechanism**: Twilio Programmable Messaging number → inbound SMS webhook → small
  backend (serverless function, e.g. a Vercel/Netlify function, or Zapier + Code step) →
  AI reply grounded in business info → response sent back via the Twilio API.
- This is the one channel that actually needs Twilio directly for a live loop — a
  two-way AI conversation isn't something Zapier alone handles cleanly.

---

## Lead Phone Number Verification (Twilio Verify)

**Decision: leads must verify they actually own the phone number they submit, before
it's treated as a real lead.** Without this, anyone can type in any number — including a
stranger's — and trigger SMS traffic. That's a real spam/harassment/cost risk, especially
once the "reply YES → notify the boss" flow above fires an automated text to whatever
number gets submitted on a form.

**Mechanism: Twilio Verify** (Twilio's purpose-built phone verification product —
separate from the Programmable Messaging/Voice APIs used elsewhere in this doc):
1. When a lead submits a form (`schedule.html` booking, the `#contact` form, or the
   future Contact Preference Popup) with a phone number, a one-time verification code is
   sent to that number via Twilio Verify before anything else happens with it.
2. The lead enters that code back on the site — a small "Enter the code we texted you"
   step shown immediately after submission, before the normal thank-you/success state.
3. Only once verified does the submission get treated as a real, actionable lead —
   logged to the Sheet as verified, and/or the "reply YES" SMS confirm-flow only fires
   for numbers that passed verification.

**What's needed to build this**:
- A Twilio Verify Service configured in the Twilio console — a separate resource from
  the Programmable Messaging number already in use.
- A small backend or Zapier step to call Verify's `start` (send code) and `check` (verify
  code) endpoints. This needs real request/response/pass-fail handling, which is harder
  to do as a pure no-code Zap than the simple "send an SMS" actions used elsewhere in
  this plan — likely needs a small serverless function, or a Zapier Code step calling
  Twilio's REST API directly.
- UI work on the site: an inline "Enter verification code" step after form submission,
  for both `schedule.html` and the `#contact` form (and the future popup) — not yet
  designed.

**Open questions**:
- Does an unverified submission still get logged to the Sheet at all (marked
  "unverified"), or does verification gate the submission from being saved entirely?
- What happens if the code is never entered — does the lead just fall away with no
  automated follow-up, or does something retry/remind?
- Where does the verification step live for `schedule.html` specifically, since that
  form currently submits via FormSubmit.co and navigates straight to `thankyou.html` —
  a verification step needs to happen *before* that navigation, which means the current
  submit flow has to change shape, not just gain a bolt-on step.
- Cost: Twilio Verify charges per verification attempt, separately from SMS/voice
  pricing — worth knowing before enabling it broadly across every form on the site.

**Status**: Decision made (verification is required); architecture not yet designed in
detail. Flagging as the next thing to figure out once the SMS confirm-flow itself is
closer to being built, since verification is meant to gate that flow.

---

## Open questions — Twilio/Zapier, general

1. Zapier plan tier — needs instant (webhook-based) triggers, not polling, so the
   confirmation SMS goes out promptly and the boss's alert isn't delayed.
2. Which LLM/API to use for AI SMS replies.
3. Whether +1 916-251-4798 carries both live voice and AI SMS, or if those should split.
4. (Flow-specific open questions live inline above, under "Call" and "Verification.")

## Status

Architecture only — not yet built. Blocked on: Twilio account/number confirmation, a
Twilio Verify Service for phone verification, a Zapier account (tier depends on the
speed requirement above), the boss's phone number for SMS alerts, and the open questions
above.
