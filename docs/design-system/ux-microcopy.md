# UX and microcopy guidelines

For an application used by accountants, owners and office staff to issue invoices, post entries and meet tax deadlines
in Italy, Switzerland and Germany/France-speaking markets. People use it under deadline and with money at stake: be
exact, calm and short.

## Tone of voice

| Do | Don't |
| --- | --- |
| Say what happened and what to do. | Blame ("You entered a wrong value"). |
| Use the vocabulary of the user's trade: *fattura, nota di credito, IVA, ritenuta, scadenza*; *Rechnung, Gutschrift, MwSt*; *facture, avoir, TVA*. | Invent product words or translate legal terms literally. |
| Be precise with numbers, dates and identifiers: "Invoice 2026/0412", "due 30 Nov 2026". | Say "the document" or "soon". |
| Use plain, active, present tense. | Use jokes, exclamation marks, emoji, "Oops". |
| Keep legal and tax names as they are (SDI, IBAN, QST, AHV). | Abbreviate other words. |

Voice per language: Italian uses the informal imperative ("Inserisci", "Crea"); German uses "Sie"; French uses "vous".
Do not mix registers inside one screen.

## Error messages

An error message answers three questions in one or two sentences: **what is wrong, why it matters, how to fix it.**

| Weak | Good |
| --- | --- |
| "Invalid input" | "Enter the company name. It is required to issue the invoice." |
| "Error 422" | "The customer's VAT number is not valid. Correct it in the customer record and send the invoice again." |
| "Something went wrong" | "The bank connection failed. Reconnect the account and try again." |

Rules:

- Put the message next to the field (`app-form-field` `error`), not only in a toast. Do not repeat the field label as
  the whole message.
- Name the field value or the document ("Invoice 2026/0413") when more than one thing is on screen.
- A server rule violation shows the reason from the API, translated; never the raw status code.
- Never clear what the user typed because of an error.
- Errors are not announced twice: a field error is announced by its own live region; do not also open a toast for it.

## Confirmations of destructive actions

Use `app-modal` with `app-button variant="danger"`.

1. **Title = the question with the object**: "Delete invoice 2026/0412?" not "Are you sure?".
2. **Body = the consequence and whether it can be undone**: "The invoice and its payments will be removed. This cannot be
   undone."
3. **Buttons**: the safe one first and plain (`Cancel`), the destructive one last, with the verb and the object
   ("Delete invoice"), never "Yes" or "OK".
4. Focus starts inside the dialog; Escape cancels. A posted or sent fiscal document is never deleted: offer the legal
   alternative (credit note, cancellation) in the text instead.
5. After the action, confirm with a toast that names what was done: "Invoice 2026/0412 deleted."

## Empty states

Say **what is empty, why that is fine, and the next step.** One heading, one sentence, one button.

> **No quotes yet**
> Create a quote to send it to a customer and turn it into an invoice once accepted.
> [Create quote]

- A filtered list that returns nothing says so and offers to clear the filter: "No invoices match these filters. Clear
  filters."
- A list the user may not see says why: "Only administrators can see bank accounts."
- Do not use an empty state for a loading state or an error.

## Buttons and labels

- A button names the action with a verb and the object: "Issue invoice", "Save draft", "Send reminder". Avoid "Submit",
  "OK", "Yes".
- The same action has the same name everywhere. Keep one key per action and reuse it.
- Labels are nouns, sentence case, no trailing colon: "Company name". Mark required fields with `required`, which adds the
  asterisk and `aria-required`; explain the asterisk once per form if there are optional fields too.
- A hint says the format or where to find the value, not what the label already says: "As it appears on the invoice."
- Amounts and dates follow the locale (use the formatting pipes), not text written by hand.

## Status messages

| Kind | Component | Example |
| --- | --- | --- |
| Result of an action | toast `success` | "Draft saved." |
| Progress, nothing to do | toast `info` | "Synchronising with the bank…" |
| Failure that needs action | toast `danger` (stays until dismissed) or `app-alert` | "The bank connection failed. Reconnect the account and try again." |
| A condition of the page | `app-alert` with a heading | "Payment due soon" |

## Internationalisation rules

1. **No hard-coded text in templates or components.** Every visible string, `aria-label`, `title`, `alt`, placeholder and
   message is a translation key shown with the `translate` pipe or `I18nService.translate`.
2. **Keys are seeded in the API**, in all four languages (`it`, `en`, `de`, `fr`), in
   `database/seeders/Translations/{Italian,English,German,French}FrontendTranslations.php`. The frontend ships no
   dictionary. A key in one language only fails the parity spec.
3. **Key format**: `AREA.NAME_IN_CAPITALS`, for example `DESIGN_SYSTEM.CONFIRM_TITLE`. The area is the feature.
4. **Parameters, not concatenation**: `'Invoice {number} deleted.'` with `{ number }`. Word order differs between
   languages, so never build a sentence from pieces.
5. **Plural and gender**: write the whole sentence per case or rephrase to avoid the problem ("Invoices: 3").
6. **Length**: German and French run 30% longer than English. Components wrap text and never fix a width around it.
7. **Written once, reviewed in all four**: whoever adds an English text adds the other three in the same change.
8. **Do not translate** legal and technical names: SDI, IBAN, QR-bill, QST, AHV, PEC.
9. **API messages** (`message` in the response envelope) are translated by the API from the user's locale; the
   frontend shows them as they are.
