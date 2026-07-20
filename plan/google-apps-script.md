# Google Apps Script — Booking Requests Sheet

Bound to the "Genesis Pool and Spa - Booking Requests" Google Sheet. Not stored anywhere
in this git repo — Apps Script projects live in Google Drive, bound to the spreadsheet —
so this file is the source of truth for what the deployed script should contain. Paste it
into the Sheet's **Extensions → Apps Script** editor (`Code.gs`) and redeploy any time it
changes here.

Receives `doPost` submissions from both site forms (see [`plan.md`](plan.md)'s "Contact
Preference Popup — Lead Routing Plan" section for the client-side wiring):
- `Genesis-Pool-and-Spa-main/schedule.html` (`schedForm`, via `fetch(...,
  {mode:'no-cors'})`, awaited before navigating to `thankyou.html`)
- `Genesis-Pool-and-Spa-main/index.html` `#contact` (`contactForm`, via `fetch(...,
  {mode:'no-cors'})`)

Both forms append a `Form Source` field (`'Schedule Form'` / `'Contact Form'`) that the
script uses to route the row to the correct tab.

**`schedule.html` no longer uses FormSubmit.co.** It used to `POST` directly to
`https://formsubmit.co/contact@genesispoolandspa.com` (email notification, with a
one-time "click to activate" step) and rely on FormSubmit's `_next` hidden field to
redirect to `thankyou.html` after submitting. That's been replaced entirely: the form now
only posts to this Apps Script, which logs the row *and* texts the boss (see "Twilio SMS
on new bookings" below); the page navigates to `thankyou.html` itself once that request
resolves. One side effect worth noting: the old `_next` value
(`https://beautymapped.github.io/pool1/thankyou.html`) was actually pointed at the wrong
site/repo — a latent bug that's now moot since it's gone.

## Change from the original single-sheet design

The first version of this script (described in `plan.md`) logged **both** forms into one
sheet/tab, with a `Form Source` column distinguishing which form a row came from. That's
now been split into **two separate tabs**, per direct instruction:

- **First tab in the spreadsheet — `Booking Requests`**: free-cleaning / schedule
  requests only (`schedule.html`). This is what's visible by default when the Google
  Sheet is opened.
- **Second tab — `Contact Form Submissions`**: `index.html` `#contact` "Send Us a
  Message" submissions only, including the `Service Interested In` column.

Each tab gets its own header row (self-healing — see `ensureHeaders_` below), rather than
one shared 15-column header with a `Form Source` tag. `Form Source` is still read from
the incoming payload to decide *which* tab a row goes to, but it's no longer stored as a
column, since the tab itself now carries that meaning.

**Bundle option**: `index.html`'s contact form service dropdown includes a `bundle`
`<option>` (`Bundle (Signup) — Cleaning + Balancing + Free Tile Cleaning`) — see
`js/main.js`, which reads the *selected option's visible text* (not its `value`) into
`Service Interested In` before posting:

```js
const serviceLabel = serviceSelect.options[serviceSelect.selectedIndex].text;
payload.append('Service Interested In', serviceLabel);
```

No script-side change was actually needed to "support" bundle specifically — `Service
Interested In` is logged as free text, so whatever the dropdown sends (including the
bundle label) is captured automatically. What *was* missing is fixed below: the script
now always writes `Service Interested In` into the `Contact Form Submissions` tab's
column of that name, so a bundle signup is never silently dropped or misfiled.

## Twilio SMS on new bookings (replaces FormSubmit.co email)

Every `Booking Requests` row (i.e. every `schedule.html` submission — not
`Contact Form Submissions`) now also fires an SMS to the boss via Twilio's REST API,
straight from `doPost`, instead of relying on FormSubmit.co's email delivery. See
[`twilio.md`](twilio.md) for the number/account context.

**Credentials are never hardcoded in this script** — they're read at runtime from Apps
Script **Script Properties** (per-project key/value config, not part of the source code),
since `Code.gs` is documented here in a git repo. Set these once in the Apps Script
editor under **Project Settings (gear icon) → Script Properties**:

| Property key          | Value                                                        |
|------------------------|--------------------------------------------------------------|
| `TWILIO_ACCOUNT_SID`    | From the Twilio Console                                      |
| `TWILIO_AUTH_TOKEN`     | From the Twilio Console — keep secret                        |
| `TWILIO_FROM_NUMBER`    | `+19162514798` (the Twilio number already live on the site)  |
| `BOSS_PHONE_NUMBER`     | Whoever should get the "new booking" text, in `+1XXXXXXXXXX` form |

If any of those four properties is missing, `notifyBossOfBooking_` silently no-ops (the
Sheet logging still happens either way — a missing/misconfigured Twilio credential never
blocks a booking from being recorded).

## `Code.gs`

```javascript
/**
 * Genesis Pool and Spa — lead logging Web App.
 * Routes schedule.html and index.html #contact submissions to separate tabs,
 * and texts the boss via Twilio when a new booking comes in.
 */

var BOOKING_SHEET_NAME = 'Booking Requests';
var CONTACT_SHEET_NAME = 'Contact Form Submissions';

var BOOKING_HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Phone',
  'Email',
  'Property Address',
  'Property Type',
  'Preferred Date',
  'Preferred Time',
  'Confirmation Method',
  'Alternate Date',
  'Notes'
];

var CONTACT_HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Phone',
  'Email',
  'Service Interested In',
  'Notes'
];

function doPost(e) {
  var params = (e && e.parameter) || {};
  var formSource = params['Form Source'];
  var isBooking = formSource !== 'Contact Form';

  var sheetName = isBooking ? BOOKING_SHEET_NAME : CONTACT_SHEET_NAME;
  var headers = isBooking ? BOOKING_HEADERS : CONTACT_HEADERS;

  var sheet = getOrCreateSheet_(sheetName, isBooking ? 0 : 1);
  ensureHeaders_(sheet, headers);

  var row = headers.map(function (col) {
    if (col === 'Timestamp') return new Date();
    return params[col] || '';
  });

  sheet.appendRow(row);

  if (isBooking) {
    notifyBossOfBooking_(params);
  }

  return ContentService.createTextOutput('OK');
}

/** Gets the named tab, creating it at the given index (0 = first) if missing. */
function getOrCreateSheet_(name, index) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name, index);
  }
  return sheet;
}

/** Self-heals row 1 to match the expected headers for this tab. */
function ensureHeaders_(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = sheet.getLastRow() > 0 ? range.getValues()[0] : [];
  var matches = headers.every(function (h, i) { return current[i] === h; });
  if (!matches) {
    range.setValues([headers]);
  }
}

/**
 * Texts the boss a new-booking summary via Twilio, replacing the old
 * FormSubmit.co email notification. Reads credentials from Script
 * Properties (Project Settings → Script Properties in the Apps Script
 * editor) — never hardcode them here, since this file is checked into git
 * as documentation.
 */
function notifyBossOfBooking_(params) {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('TWILIO_ACCOUNT_SID');
  var token = props.getProperty('TWILIO_AUTH_TOKEN');
  var fromNumber = props.getProperty('TWILIO_FROM_NUMBER');
  var bossNumber = props.getProperty('BOSS_PHONE_NUMBER');
  if (!sid || !token || !fromNumber || !bossNumber) return;

  var name = [params['First Name'], params['Last Name']].filter(String).join(' ') || 'Someone';
  var when = [params['Preferred Date'], params['Preferred Time']].filter(String).join(' ');
  var body = name + ' (' + (params['Phone'] || 'no phone') + ') booked a free cleaning'
    + (when ? ' for ' + when : '') + '. ' + (params['Property Address'] || '');

  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      payload: { To: bossNumber, From: fromNumber, Body: body },
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
      muteHttpExceptions: true
    });
  } catch (err) {
    // Don't let an SMS failure block the sheet log that already succeeded above.
  }
}
```

## Deployment

1. Open the "Genesis Pool and Spa - Booking Requests" Sheet → **Extensions → Apps
   Script**.
2. Replace `Code.gs` with the script above.
3. **Project Settings (gear icon) → Script Properties** → add the four Twilio keys from
   "Twilio SMS on new bookings" above (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_FROM_NUMBER`, `BOSS_PHONE_NUMBER`). Skippable for now — bookings still log to
   the Sheet without them, just no text goes out — but needed for the SMS to actually
   fire.
4. **Deploy → New deployment → Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone** (the site posts to this anonymously, with `no-cors`
     `fetch` — there's no auth token in either client)
5. Copy the deployed `/exec` URL into `window.APPS_SCRIPT_URL` in
   `Genesis-Pool-and-Spa-main/js/main.js` (currently a
   `'REPLACE_WITH_DEPLOYED_APPS_SCRIPT_URL'` placeholder — both forms' logging calls are
   guarded no-ops until this is set).
6. On first run, `getOrCreateSheet_` / `ensureHeaders_` will create both tabs (or rename
   an existing single combined tab manually beforehand if migrating old data — the script
   itself doesn't migrate existing rows).
7. Re-deploy (**Deploy → Manage deployments → Edit → New version**) any time `Code.gs`
   changes — editing the script alone doesn't update the live `/exec` URL's behavior.

## Open items

- **Boss's phone number** (`BOSS_PHONE_NUMBER`) isn't set anywhere yet — needed before
  the SMS notification can go out. Same open question as in [`twilio.md`](twilio.md).
- Existing rows already logged under the old single-sheet/`Form Source`-column design (if
  any were captured before this split) aren't auto-migrated — split them into the two new
  tabs manually if that history needs to be kept.
- Per [`twilio.md`](twilio.md), the Sheet is also the trigger source for the Twilio/Zapier
  "reply YES → notify the boss" flow (Zap 1 watches for new booking rows) — that's a
  *different* flow from the `notifyBossOfBooking_` SMS added here (this one fires
  immediately on every booking; that one is the lead-facing "reply YES to confirm a
  call" flow). Zap 1's trigger sheet/tab reference should still be repointed at
  `Booking Requests` specifically now that it's a named tab rather than the whole
  spreadsheet's one sheet.

## Raw `Code.gs` (copy-paste)

```javascript
/**
 * Genesis Pool and Spa — lead logging Web App.
 * Routes schedule.html and index.html #contact submissions to separate tabs,
 * and texts the boss via Twilio when a new booking comes in.
 */

var BOOKING_SHEET_NAME = 'Booking Requests';
var CONTACT_SHEET_NAME = 'Contact Form Submissions';

var BOOKING_HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Phone',
  'Email',
  'Property Address',
  'Property Type',
  'Preferred Date',
  'Preferred Time',
  'Confirmation Method',
  'Alternate Date',
  'Notes'
];

var CONTACT_HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Phone',
  'Email',
  'Service Interested In',
  'Notes'
];

function doPost(e) {
  var params = (e && e.parameter) || {};
  var formSource = params['Form Source'];
  var isBooking = formSource !== 'Contact Form';

  var sheetName = isBooking ? BOOKING_SHEET_NAME : CONTACT_SHEET_NAME;
  var headers = isBooking ? BOOKING_HEADERS : CONTACT_HEADERS;

  var sheet = getOrCreateSheet_(sheetName, isBooking ? 0 : 1);
  ensureHeaders_(sheet, headers);

  var row = headers.map(function (col) {
    if (col === 'Timestamp') return new Date();
    return params[col] || '';
  });

  sheet.appendRow(row);

  if (isBooking) {
    notifyBossOfBooking_(params);
  }

  return ContentService.createTextOutput('OK');
}

/** Gets the named tab, creating it at the given index (0 = first) if missing. */
function getOrCreateSheet_(name, index) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name, index);
  }
  return sheet;
}

/** Self-heals row 1 to match the expected headers for this tab. */
function ensureHeaders_(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = sheet.getLastRow() > 0 ? range.getValues()[0] : [];
  var matches = headers.every(function (h, i) { return current[i] === h; });
  if (!matches) {
    range.setValues([headers]);
  }
}

/**
 * Texts the boss a new-booking summary via Twilio, replacing the old
 * FormSubmit.co email notification. Reads credentials from Script
 * Properties (Project Settings → Script Properties in the Apps Script
 * editor) — never hardcode them here, since this file is checked into git
 * as documentation.
 */
function notifyBossOfBooking_(params) {
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('TWILIO_ACCOUNT_SID');
  var token = props.getProperty('TWILIO_AUTH_TOKEN');
  var fromNumber = props.getProperty('TWILIO_FROM_NUMBER');
  var bossNumber = props.getProperty('BOSS_PHONE_NUMBER');
  if (!sid || !token || !fromNumber || !bossNumber) return;

  var name = [params['First Name'], params['Last Name']].filter(String).join(' ') || 'Someone';
  var when = [params['Preferred Date'], params['Preferred Time']].filter(String).join(' ');
  var body = name + ' (' + (params['Phone'] || 'no phone') + ') booked a free cleaning'
    + (when ? ' for ' + when : '') + '. ' + (params['Property Address'] || '');

  var url = 'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json';
  try {
    UrlFetchApp.fetch(url, {
      method: 'post',
      payload: { To: bossNumber, From: fromNumber, Body: body },
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
      muteHttpExceptions: true
    });
  } catch (err) {
    // Don't let an SMS failure block the sheet log that already succeeded above.
  }
}
```
