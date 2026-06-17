# Automation v0

This is the first fulfillment automation for Rug-Risk Roast.

Goal:

```text
Turn a 45-minute manual audit into a 10-minute review.
```

The automation does not send reports automatically. It prepares a draft for human review.

## Flow

1. Buyer pays SOL or USDC.
2. Buyer submits the quick Tally form.
3. Operator copies the Tally response into a JSON file.
4. Run `scripts/prepare-audit.mjs`.
5. Script verifies the Solana transaction when not in dry-run mode.
6. Script creates a customer folder.
7. Script writes:
   - `intake.json`
   - `intake.md`
   - `payment-verification.json`
   - `audit-draft.md`
   - `operator-note.md`
8. Operator reviews and edits `audit-draft.md`.
9. Operator sends the final report manually.

## Quick Test

```bash
node scripts/prepare-audit.mjs \
  --input templates/quick-intake-example.json \
  --skip-payment \
  --out-dir /tmp/rug-risk-roast-customers \
  --no-log \
  --force
```

## Real Order

Create a JSON file from the Tally response:

```json
{
  "Contact email, Telegram, or X": "@buyer",
  "Payment transaction signature": "REAL_SOLANA_TX_SIGNATURE",
  "Project name + ticker": "ProjectName / TICKER",
  "Live or pre-launch? Launching where?": "Pre-launch on Pump.fun",
  "Paste everything you want roasted": "Paste buyer links, copy, socials, wallet notes, and rough drafts here.",
  "What feels sketchiest or most urgent?": "Optional buyer concern."
}
```

Run:

```bash
node scripts/prepare-audit.mjs --input path/to/tally-response.json
```

The default receiving wallet is:

```text
3N4sL9rs7VM1rAf9d2rXVraQsqwNWcG8pohyZVRmsEBs
```

The script accepts payment when either condition is true:

- at least `0.1 SOL` reached the receiving wallet
- at least `19 USDC` reached the receiving wallet

## Important Limits

- Always review the generated report before sending.
- Do not treat the draft as legal, compliance, or investment advice.
- If payment verification says `underpaid_or_wrong_recipient`, do not deliver until manually resolved.
- If the buyer asks for fake volume, fake holders, hidden wallets, or misleading copy, reject/refund where possible.

## Later Upgrade

After a few sales, this can be connected to:

- Tally webhook
- Make.com or Zapier
- Google Sheet/Airtable order table
- Telegram notification
- optional AI drafting API

Keep final report delivery manual until there is enough customer volume to justify stricter safeguards.
