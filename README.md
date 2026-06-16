# Rug-Risk Roast

Rug-Risk Roast is a manual 24-hour launch trust audit for small crypto launches.

Core offer:

```text
Find the reasons your crypto launch looks sketchy before the market does.
```

This is a standalone manual MVP. It is not connected to PayFlux, Depth Over Display, CaseRelay, any meme coin account, or any serious business brand.

## Product

Buyer pays for a manual audit, submits project details, and receives a scored report within 24 hours after payment plus completed intake.

Launch pricing:

- First 10 audits: `$19` or `0.1 SOL` equivalent.
- Standard: `$39` or crypto equivalent.
- Rush: not offered in v1.

## Folder Structure

- `site/` - static landing page, risk page, and thank-you page.
- `docs/audit-framework.md` - scoring rubric and review rules.
- `docs/sample-report.md` - example report output.
- `docs/fulfillment-sop.md` - exact operator workflow.
- `templates/intake-questions.md` - Tally/Google Form fields.
- `templates/audit-report-template.md` - report template to copy per customer.
- `templates/red-flag-library.md` - reusable findings and fixes.
- `templates/email-replies.md` - buyer/customer messages.
- `templates/scorecard.csv` - local customer/order tracker.
- `customers/` - create one folder per customer audit.

## V1 Stack

- Landing page: static HTML/CSS.
- Payment: Helio / MoonPay Commerce payment link.
- Intake: Tally or Google Forms.
- Delivery: manual email, Telegram, or X DM.
- Tracking: local CSV.

## Setup Checklist

1. Create Helio/MoonPay Commerce payment link.
2. Create Tally/Google intake form using `templates/intake-questions.md`.
3. Replace placeholders in `site/index.html` and `site/thanks.html`:
   - `https://example.com/helio-rug-risk-roast`
   - `https://tally.so/r/rug-risk-roast-intake`
4. Open `site/index.html` and verify links.
5. Run the first fake audit from `docs/sample-report.md` and `templates/audit-report-template.md`.
6. Sell 10 audits before building automation.

## Fulfillment SLA

Delivered within 24 hours after payment plus completed intake.

If payment is received but intake is missing, the SLA starts when intake is complete.

If a project is obviously malicious, reject/refund if possible. Do not provide optimization advice.

## Compliance Position

Rug-Risk Roast is an educational trust-readiness review, not financial, legal, tax, investment, or compliance advice. It does not guarantee token success, price performance, liquidity, listings, community growth, legal safety, or buyer trust.

We do not help hide risk, fake trust, create fake volume, or mislead buyers. We surface issues so teams can communicate more clearly and operate more responsibly.
