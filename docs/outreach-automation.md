# Outreach Automation

This is the practical outreach setup for Rug-Risk Roast.

The goal is not to blast people. The goal is to find projects with obvious trust gaps, generate a specific message, and send it manually where it makes sense.

## Why Not A Telegram Blast Bot

Normal Telegram bots cannot cold-DM random users. A private message generally requires the user to contact the bot first, and group/channel actions require the bot to be added with the right permissions.

So the v1 automation is:

1. Find public Solana launch prospects.
2. Pull their public Telegram/X links.
3. Generate a personalized outreach queue.
4. Let the operator send manually.

This keeps the operation useful without turning it into spam infrastructure.

## Refresh Prospects

```bash
node scripts/find-prospects.mjs --limit 50
```

This writes private local files under:

```text
prospects/
```

Those files are ignored by git because they are time-sensitive lead lists.

## Create Outreach Queue

All reachable contacts:

```bash
node scripts/prepare-outreach.mjs \
  --csv prospects/YYYY-MM-DD-contact-first-prospects.csv \
  --limit 15 \
  --channel all
```

Telegram-only:

```bash
node scripts/prepare-outreach.mjs \
  --csv prospects/YYYY-MM-DD-contact-first-prospects.csv \
  --limit 10 \
  --channel telegram \
  --out prospects/YYYY-MM-DD-telegram-outreach-queue.md
```

X-only:

```bash
node scripts/prepare-outreach.mjs \
  --csv prospects/YYYY-MM-DD-contact-first-prospects.csv \
  --limit 10 \
  --channel x \
  --out prospects/YYYY-MM-DD-x-outreach-queue.md
```

## Copy And Open One Lead

Copy message number 1 to clipboard:

```bash
node scripts/prepare-outreach.mjs \
  --csv prospects/YYYY-MM-DD-contact-first-prospects.csv \
  --limit 15 \
  --copy 1
```

Open contact number 1:

```bash
node scripts/prepare-outreach.mjs \
  --csv prospects/YYYY-MM-DD-contact-first-prospects.csv \
  --limit 15 \
  --open 1
```

The script does not send anything.

## Sending Rules

- Send 5-10 personalized messages per day at first.
- Use Telegram first when available.
- Use public X replies only when DMs are not possible.
- Do not spam communities with repeated payment links.
- Do not help projects hide risk, fake trust, or mislead buyers.
- Skip obvious protected brand/personality/IP projects unless the advice is simply to change direction.

## Good First Message Shape

```text
Quick trust note on [project]:

- [specific trust issue]
- [specific trust issue]

That doesn't mean the project is bad. It means fast scanners may read missing info as risk.

I run Rug-Risk Roast. It's a $19 manual trust-readiness audit for small crypto launches. I send back a scorecard, red flags, fixed launch copy, and the next 5 things to clean up within 24 hours.

Sample report: https://blight-east.github.io/rug-risk-roast/sample-report.html
```

## After They Reply

Send:

```text
Here is the page:
https://blight-east.github.io/rug-risk-roast/

Payment is manual crypto for now. Once payment + intake are done, the 24-hour clock starts.
```
