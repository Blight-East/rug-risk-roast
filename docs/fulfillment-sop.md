# Fulfillment SOP

## SLA

Deliver within 24 hours after both are true:

- Payment is confirmed.
- Intake is complete.
- Transaction signature is submitted.

If payment is received but intake or transaction signature is missing, send the intake reminder and start the SLA when both are complete.

## Automated Draft Workflow

Use this workflow first for normal orders.

1. Copy the Tally response into a JSON file using the field names from `templates/quick-intake-example.json`.
2. Run:

```bash
node scripts/prepare-audit.mjs --input path/to/tally-response.json
```

3. Open the created customer folder.
4. Read `operator-note.md`.
5. If `payment-verification.json` does not say `paid`, manually resolve payment before delivery.
6. Review and edit `audit-draft.md`.
7. Verify live links manually if the buyer submitted links.
8. Send the final report only after payment and the report are both reviewed.
9. Send 48-hour follow-up.

## Manual Fallback Workflow

Use this if the script fails or the order needs special handling.

1. Check payment manually on Solscan. Confirm transaction success, recipient wallet, token, and amount.
2. Confirm intake form submission.
3. Create customer folder:

```text
/Users/ct/rug-risk-roast/customers/YYYY-MM-DD-project-name
```

4. Copy `templates/audit-report-template.md` into the customer folder.
5. Save customer links and screenshots if useful.
6. Review token page, website, X, Telegram, Discord, image, and planned launch copy.
7. Score all nine categories from `docs/audit-framework.md`.
8. Write top 10 red flags.
9. Rewrite:
   - token description,
   - X bio,
   - Telegram pin,
   - launch post.
10. Add "do not say this" list.
11. Add next 5 actions.
12. Export/send report as Markdown or PDF.
13. Log delivery in `templates/scorecard.csv`.
14. Send 48-hour follow-up.

## Reject / Refund Rule

Reject or refund if possible when:

- The project asks for help hiding team wallets.
- The project asks for fake volume, fake holders, or botting.
- The project uses stolen creator/brand IP and refuses to change it.
- The project asks for price guarantees or manipulation language.
- The project is obviously designed to mislead buyers.

Do not provide optimization advice to projects that ask for deceptive help.

## Delivery Message

Use the delivery template in `templates/email-replies.md`.

Attach or paste:

- final score,
- report file,
- top 5 urgent fixes,
- follow-up offer.

## Quality Bar

The report should feel personalized. If the same report could be sent to any token, it is not done.

The audit should normally take 30-45 minutes. If it takes longer, add reusable findings to `templates/red-flag-library.md`.
