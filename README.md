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
- Payment: manual SOL/USDC transfer to a dedicated Solana receiving wallet.
- Intake: Tally or Google Forms, with transaction signature included.
- Delivery: manual email, Telegram, or X DM.
- Tracking: local CSV.

## Setup Checklist

1. Solana receiving wallet is configured in `site/payment.html`.
2. Tally intake form is live at `https://tally.so/r/5BOaeN`.
3. Open `site/index.html` and verify links.
4. Run the first fake audit from `docs/sample-report.md` and `templates/audit-report-template.md`.
5. Sell 10 audits before building automation or checkout integrations.

## Manual Payment Flow

Buyer sends one of:

- `0.1 SOL`
- `$19 USDC` on Solana

Then buyer submits the transaction signature, contact info, and project details. Verify the transaction manually on Solscan before starting the 24-hour audit window.

## Fulfillment SLA

Delivered within 24 hours after payment plus completed intake.

If payment is received but transaction signature or intake is missing, the SLA starts when both are complete.

If a project is obviously malicious, reject/refund if possible. Do not provide optimization advice.

## Compliance Position

Rug-Risk Roast is an educational trust-readiness review, not financial, legal, tax, investment, or compliance advice. It does not guarantee token success, price performance, liquidity, listings, community growth, legal safety, or buyer trust.

We do not help hide risk, fake trust, create fake volume, or mislead buyers. We surface issues so teams can communicate more clearly and operate more responsibly.
