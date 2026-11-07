# Khata - Requirements

## Overview

Khata is a digital credit ledger (udhaar book) for small kiryana shops in Pakistan. It replaces the paper notebook shopkeepers use to track what customers owe. It is built entirely on `@skeleton/core` and must work fully offline on cheap Android phones, in English and Urdu (RTL), on a 360px-wide screen with large touch targets.

## Scope

**In scope:**
- Customer management (create, view, update via append-only records)
- Credit and payment entry with append-only ledger records
- Entry reversal (correction without deletion or editing)
- Dashboard with totals and top debtors
- WhatsApp and SMS payment reminders
- Date-range reports
- Settings (shop name, language, CSV export)
- Demo mode with sample data
- Property-based and unit tests for all ledger logic
- All text through i18n keys in both en.json and ur.json

**Out of scope:**
- Cloud sync adapter (the in-memory adapter from `@skeleton/core` is used)
- Authentication or multi-user access
- Push notifications
- In-app messaging
- Server-side implementation

---

## Users

Shopkeepers using cheap Android phones (360px screen minimum), often offline, many preferring Urdu. Every screen must work fully offline, in both English and Urdu (RTL), with large touch targets (minimum 44×44px for all interactive elements).

---

## Data Model

All records are stored via `@skeleton/core`'s append-only `Store`. Money is stored as integers in **paisa** (1 Rs = 100 paisa) to avoid floating-point errors. All display amounts use thousand separators and "Rs" prefix.

Khata defines six collection types for its `createDatabase` call:

### Collections

**`customerCreated`** — A new customer is registered.
```
payload: {
  name: string;           // required, non-empty
  phone?: string;         // optional, Pakistani format
  note?: string;          // optional free text
}
```

**`customerUpdated`** — A customer's info is changed. Derived current info is taken from the latest `customerUpdated` record for a given `customerId`, falling back to the original `customerCreated` record.
```
payload: {
  customerId: string;     // id of the customerCreated record
  name?: string;
  phone?: string;
  note?: string;
}
```

**`creditGiven`** — Shopkeeper gives credit; customer owes more.
```
payload: {
  customerId: string;
  amountPaisa: number;    // positive integer, in paisa
  note?: string;
  date: string;           // ISO 8601 date (YYYY-MM-DD)
}
```

**`paymentReceived`** — Customer pays; they owe less.
```
payload: {
  customerId: string;
  amountPaisa: number;    // positive integer, in paisa
  note?: string;
  date: string;           // ISO 8601 date (YYYY-MM-DD)
}
```

**`entryReversed`** — Corrects a mistake by cancelling a previous entry. The original entry remains visible but is marked as reversed. Reversals themselves cannot be reversed.
```
payload: {
  entryId: string;        // id of the creditGiven or paymentReceived record being reversed
  reason: string;         // required explanation
}
```

**`settingsUpdated`** — Shop-level settings update (append-only; latest wins).
```
payload: {
  shopName?: string;
  language?: 'en' | 'ur';
}
```

---

## Functional Requirements

### FR-1 Customer List

**FR-1.1** The app SHALL display a list of all customers, sorted by balance descending (highest amount owed first). Customers with zero or negative balance (advance payment) appear after those who owe.

**FR-1.2** Each row SHALL show the customer's name and current balance. If the balance is positive (customer owes), it SHALL be displayed in red. If zero or negative (settled or advance), it SHALL be displayed in green.

**FR-1.3** The list SHALL support real-time search by customer name or phone number, filtering the displayed list as the user types. Search is case-insensitive and matches partial strings.

**FR-1.4** The customer list SHALL be accessible offline with no degradation in functionality.

**FR-1.5** The list SHALL display a prominent "Add Customer" button with a minimum touch target of 44×44px.

---

### FR-2 Add Customer

**FR-2.1** The app SHALL provide a form to add a new customer with:
- **Name** (required, non-empty after trimming whitespace)
- **Phone** (optional; if provided, SHALL be validated for Pakistani mobile format: 03XX-XXXXXXX or 03XXXXXXXXX, 11 digits starting with 03)
- **Note** (optional, free text)

**FR-2.2** Submitting the form SHALL create a `customerCreated` record via `store.add`.

**FR-2.3** Validation errors SHALL be displayed inline in the current language. The form SHALL not submit until all required fields are valid.

**FR-2.4** On successful submission, the app SHALL navigate back to the customer list and the new customer SHALL appear immediately.

---

### FR-3 Customer Detail

**FR-3.1** The customer detail screen SHALL display:
- Customer name and phone (if set)
- Current balance prominently at the top (red if positive/owing, green if zero/negative)
- Two primary action buttons: **"Credit Given"** and **"Payment Received"**, each with min 44px touch target
- A **"Send Reminder"** button (see FR-7)
- A full transaction history in reverse chronological order (newest first)

**FR-3.2** Each transaction history row SHALL show:
- Date (formatted as DD/MM/YYYY)
- Amount (formatted as Rs X,XXX)
- Note (if any)
- Running balance after that entry
- Visual indicator: credit entries in red, payment entries in green
- If the entry has been reversed: show it with a strikethrough style and "Reversed" label; it SHALL still appear in the list

**FR-3.3** Each non-reversed entry SHALL have a "Correct mistake" action that opens the reversal flow (FR-5).

**FR-3.4** The customer detail screen SHALL be accessible offline.

---

### FR-4 Add Entry (Credit or Payment)

**FR-4.1** The add entry screen (shared for credit and payment, differentiated by type) SHALL contain:
- A large numeric input for amount in rupees (the app converts to paisa internally)
- An optional note field
- A date field defaulting to today (YYYY-MM-DD), user-editable

**FR-4.2** Amount SHALL be a positive integer number of rupees (minimum Rs 1). The app multiplies by 100 to store in paisa.

**FR-4.3** Submitting a credit entry SHALL create a `creditGiven` record. Submitting a payment SHALL create a `paymentReceived` record.

**FR-4.4** On successful submission, the app SHALL return to the customer detail screen, the new entry SHALL appear in the transaction history, and the balance SHALL update immediately.

**FR-4.5** The numeric input SHALL be large (minimum 48px height) and use a numeric keyboard on mobile.

---

### FR-5 Correct a Mistake (Entry Reversal)

**FR-5.1** Any non-reversed `creditGiven` or `paymentReceived` entry SHALL have a "Correct mistake" action.

**FR-5.2** Tapping "Correct mistake" SHALL open a confirmation screen showing:
- The original entry's date, amount, type, and note
- A required text field for the reversal reason
- A confirm button

**FR-5.3** Confirming SHALL create an `entryReversed` record pointing to the original entry's id.

**FR-5.4** After reversal, the original entry SHALL remain visible in the transaction history, visually marked as reversed (strikethrough), with the reason displayed. It SHALL be excluded from balance calculation.

**FR-5.5** Reversed entries SHALL NOT be reversible again (no double-reversal).

---

### FR-6 Dashboard (Home Screen)

**FR-6.1** The dashboard SHALL be the first screen shown on app launch and SHALL display:
- **Total outstanding**: sum of all positive customer balances (customers who owe money)
- **Credit given today**: sum of all non-reversed `creditGiven` entries with today's date
- **Payments received today**: sum of all non-reversed `paymentReceived` entries with today's date
- **Top 5 debtors**: the five customers with the highest positive balance, showing name and balance

**FR-6.2** All dashboard figures SHALL update immediately when new entries are added.

**FR-6.3** The dashboard SHALL be fully functional offline.

**FR-6.4** Tapping a customer in the top-5 list SHALL navigate to that customer's detail screen.

---

### FR-7 Payment Reminders

**FR-7.1** The customer detail screen SHALL show a **"Send Reminder"** button, visible only when the customer's balance is positive (they owe money).

**FR-7.2** Tapping "Send Reminder" SHALL open WhatsApp via a `wa.me` deep link with a pre-filled message in the current app language. The message SHALL include:
- The shop name (from settings)
- The customer's name
- The amount owed (formatted as Rs X,XXX)
- A polite request to pay

**FR-7.3** If WhatsApp is not available, the app SHALL fall back to opening an `sms:` link with the same message pre-filled to the customer's phone number (if phone is set).

**FR-7.4** No external API or server is required. All links are constructed client-side.

**FR-7.5** The WhatsApp message template SHALL have a corresponding i18n key in both `en.json` and `ur.json`.

---

### FR-8 Reports

**FR-8.1** The reports screen SHALL allow the user to select a date range (from date, to date).

**FR-8.2** For the selected date range, the screen SHALL display:
- Total credit given (sum of non-reversed `creditGiven` records with dates in range)
- Total payments received (sum of non-reversed `paymentReceived` records with dates in range)
- Net change (payments − credit; positive means net collection)

**FR-8.3** Date range defaults to the current calendar month.

**FR-8.4** Reports are computed entirely from local records with no network request.

---

### FR-9 Settings

**FR-9.1** The settings screen SHALL allow the user to:
- Set the **shop name** (used in payment reminders and CSV export header)
- Select **language** (English / Urdu), which immediately switches the app

**FR-9.2** Settings SHALL be persisted via a `settingsUpdated` record (append-only; latest record wins).

**FR-9.3** The settings screen SHALL provide an **"Export CSV"** button that generates and downloads a CSV file containing:
- All customers (name, phone, current balance in Rs)
- All transactions (customer name, date, type, amount in Rs, note, reversed/active)

**FR-9.4** CSV export SHALL work offline using a client-side Blob download (no server call).

---

### FR-10 Demo Mode

**FR-10.1** The settings screen SHALL include a **"Load Demo Data"** button.

**FR-10.2** Tapping it (after a confirmation prompt) SHALL insert a realistic set of sample records:
- At least 5 customers with Pakistani names
- Multiple credit and payment entries per customer spanning several dates
- At least one reversed entry
- Varied balances: some customers owing, some settled, one with an advance

**FR-10.3** Demo data SHALL be inserted via `store.add`, using the same code paths as real entries, so sync, derivation, and balance calculation are exercised.

**FR-10.4** Demo mode is intended for judges and demonstrations. It SHALL be clearly labelled and SHALL warn the user that it adds sample data.

---

## Non-Functional Requirements

**NFR-1 Offline-first:** Every screen and feature SHALL work without a network connection. No feature SHALL be gated on connectivity.

**NFR-2 Performance:** The customer list and dashboard SHALL render within 300ms on a low-end Android device with up to 500 customers and 5,000 transactions. Balance derivation is computed in memory from local records.

**NFR-3 Mobile layout:** Every screen SHALL be usable on a 360px-wide viewport. All interactive elements SHALL have a minimum touch target of 44×44px. No horizontal scrolling on any primary screen.

**NFR-4 RTL support:** Switching to Urdu SHALL flip the layout direction via `document.dir = 'rtl'` (handled by `@skeleton/core`'s i18n). All layout SHALL use Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) so it mirrors correctly.

**NFR-5 i18n completeness:** Every user-visible string SHALL use an i18n key. `en.json` and `ur.json` SHALL have exactly the same keys. No hardcoded English strings in JSX.

**NFR-6 Paisa precision:** All monetary arithmetic SHALL be done in integer paisa. No floating-point multiplication or division for display (use integer division: `Math.floor(paisa / 100)` for Rs, `paisa % 100` for sub-rupee remainder, displayed only if non-zero). No rounding errors for any amount.

**NFR-7 Skeleton constraint:** Khata SHALL import only from `@skeleton/core`. It SHALL NOT import Dexie, i18next, or react-i18next directly. Any helper function useful to both apps (e.g., a `formatPaisa` utility or a `useStore` hook) belongs in `packages/skeleton`, not in `apps/khata`.

**NFR-8 Accessibility:** All screens SHALL be keyboard navigable. Icon-only buttons SHALL have ARIA labels. Color alone SHALL NOT be the sole indicator of credit vs. payment (use labels too). Contrast SHALL meet WCAG 2.1 AA.

---

## Constraints

**C-1** Records are append-only. There is no edit or delete. Customer info is derived from the latest `customerUpdated` record. Corrections are made by adding an `entryReversed` record.

**C-2** Money is stored and computed as paisa (integers). Display is converted to rupees only at render time.

**C-3** WhatsApp reminders use `wa.me` deep links with no backend or WhatsApp API key.

**C-4** The app uses `InMemorySyncAdapter` from `@skeleton/core` for now. A real Supabase adapter is out of scope for this spec.

**C-5** Any utility that could be useful to `clinic-queue` or future apps (formatting, validation helpers, shared hooks) SHALL be added to `packages/skeleton/src/`, not to `apps/khata/src/`.

---

## Testing Requirements

**TR-1 Property-based — balance invariant:** For any sequence of `customerCreated`, `creditGiven`, `paymentReceived`, and `entryReversed` records (in any order), a customer's derived balance SHALL equal `sum(creditGiven) − sum(paymentReceived)` for non-reversed entries only. Use fast-check.

**TR-2 Property-based — sync order independence:** The derived balance for a customer SHALL be identical regardless of the order in which records arrive from sync (since records are sorted by `createdAt` before derivation). Use fast-check with arbitrary record orderings.

**TR-3 Property-based — reversal restores balance:** After reversing an entry, the customer's balance SHALL equal the balance that existed immediately before that entry was originally added. Use fast-check.

**TR-4 Property-based — dashboard total equals sum of customer balances:** The total outstanding figure on the dashboard SHALL always equal the exact sum of all positive individual customer balances. Use fast-check with multi-customer record sets.

**TR-5 Property-based — no paisa rounding errors:** For any combination of paisa integer amounts (credit and payment), the derived balance SHALL be exactly correct with no floating-point error. Use fast-check with arbitrary integer amounts.

**TR-6 Unit — WhatsApp message builder:** Tests SHALL verify that the message builder produces correctly formatted messages in both English and Urdu, including the shop name, customer name, and amount.

**TR-7 Unit — phone number validation:** Tests SHALL verify that valid Pakistani mobile numbers (11-digit, starting with 03) are accepted and invalid formats are rejected.

**TR-8 Unit — CSV export:** Tests SHALL verify that the generated CSV contains all customers and all transactions, with correct headers and correctly formatted amounts.

**TR-9 Unit — entry reversal exclusion:** Tests SHALL verify that reversed entries are excluded from balance calculation and from the totals shown on the dashboard and reports screen.

**TR-10 Unit — demo data integrity:** Tests SHALL verify that after loading demo data, all customers have valid balances (no NaN, no negative amounts where not expected) and at least one reversed entry exists.
