# Fulfillment SOP

## SLA

Deliver within 24 hours after both are true:

- Payment is confirmed.
- Intake is complete.

If payment is received but intake is missing, send the intake reminder and start the SLA when intake is complete.

## Workflow

1. Check payment in Helio/MoonPay Commerce dashboard.
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
