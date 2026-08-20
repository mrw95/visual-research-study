# Feedback balanna — Excel / Google Sheets

## Option A — Email (danata thiyenawa, setup epa)

Submit unama email enne: **mr1.widanagamage@gmail.com**

Excel ekata ganna:
1. Gmail open karanna
2. "Anuradhapura Survey" emails select karanna
3. Copy → Excel paste karanna

---

## Option B — Google Sheet (Excel wage) — RECOMMENDED ✅

Submit unama **automatic** sheet ekata save wenne. Excel ekata download karanna puluwan.

### Step 1 — Google Sheet hadanna
1. https://sheets.google.com → **Blank spreadsheet**
2. Name: `Anuradhapura Survey Results`

### Step 2 — Script add karanna
1. Sheet eke **Extensions** → **Apps Script**
2. `scripts/google-sheet-code.gs` file eke code eka copy karala paste karanna
3. **Deploy** → **New deployment**
4. Type: **Web app**
5. Execute as: **Me**
6. Who has access: **Anyone**
7. **Deploy** → **Web app URL** copy karanna

### Step 3 — URL config ekata danna
1. `static/config.js` open karanna
2. `SHEET_URL = ''` — copy kara URL eka middle eke danna:
   ```javascript
   const SHEET_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
3. GitHub ekata push karanna (PUSH-TO-GITHUB.bat)

### Step 4 — Results balanna
- Google Sheet open karanna — row ekak add wenne submit ekakata
- **File → Download → Microsoft Excel (.xlsx)** click karanna

---

## Sheet eke columns

| Time | Choice 1 | Choice 2 | Choice 3 |
|------|----------|----------|----------|
| 2026-08-20... | Smart Cafe | Mobile Accessories | ... |

---

## Quick open
Sheet bookmark karanna — eka open karala refresh karala results balanna.
