#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_RECEIVE_WALLET = '3N4sL9rs7VM1rAf9d2rXVraQsqwNWcG8pohyZVRmsEBs';
const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const MIN_SOL = 0.1;
const MIN_USDC = 19;

const args = parseArgs(process.argv.slice(2));

if (args.help || !args.input) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const repoRoot = path.resolve(import.meta.dirname, '..');
const inputPath = path.resolve(process.cwd(), args.input);
const intake = JSON.parse(await readFile(inputPath, 'utf8'));
const normalized = normalizeIntake(intake);
const payment = await verifyPayment(normalized.paymentTxSignature, {
  skipPayment: args.skipPayment,
  rpcUrl: args.rpcUrl || process.env.SOLANA_RPC_URL || DEFAULT_RPC_URL,
  receiveWallet: args.receiveWallet || process.env.RRR_RECEIVE_WALLET || DEFAULT_RECEIVE_WALLET,
});

const now = new Date();
const date = now.toISOString().slice(0, 10);
const slug = slugify(normalized.projectName || 'unknown-project');
const customerRoot = path.resolve(repoRoot, args.outDir || 'customers');
const customerDir = path.join(customerRoot, `${date}-${slug}`);

if (existsSync(customerDir) && !args.force) {
  throw new Error(`Customer folder already exists: ${customerDir}\nUse --force to overwrite generated files.`);
}

await mkdir(customerDir, { recursive: true });

const draft = buildAuditDraft(normalized, payment, now);
const intakeMarkdown = buildIntakeMarkdown(normalized, payment, now);
const operatorNote = buildOperatorNote(normalized, payment);

await writeFile(path.join(customerDir, 'intake.json'), `${JSON.stringify(intake, null, 2)}\n`);
await writeFile(path.join(customerDir, 'intake.md'), intakeMarkdown);
await writeFile(path.join(customerDir, 'payment-verification.json'), `${JSON.stringify(payment, null, 2)}\n`);
await writeFile(path.join(customerDir, 'audit-draft.md'), draft);
await writeFile(path.join(customerDir, 'operator-note.md'), operatorNote);

if (!args.noLog) {
  await appendScorecard(repoRoot, normalized, payment, now, customerDir);
}

console.log(`Prepared audit folder: ${customerDir}`);
console.log(`Payment status: ${payment.status}`);
console.log(`Draft report: ${path.join(customerDir, 'audit-draft.md')}`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg === '--input') parsed.input = argv[++i];
    else if (arg === '--out-dir') parsed.outDir = argv[++i];
    else if (arg === '--rpc-url') parsed.rpcUrl = argv[++i];
    else if (arg === '--receive-wallet') parsed.receiveWallet = argv[++i];
    else if (arg === '--skip-payment') parsed.skipPayment = true;
    else if (arg === '--no-log') parsed.noLog = true;
    else if (arg === '--force') parsed.force = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/prepare-audit.mjs --input templates/quick-intake-example.json

Options:
  --input <file>           Quick intake JSON exported/copied from Tally.
  --skip-payment           Skip Solana RPC verification for dry runs.
  --out-dir <dir>          Output folder root. Defaults to customers/.
  --receive-wallet <addr>  Override receiving wallet.
  --rpc-url <url>          Override Solana RPC URL.
  --no-log                 Do not append templates/scorecard.csv.
  --force                  Overwrite generated files in an existing customer folder.
`);
}

function normalizeIntake(raw) {
  const contact = first(raw.contact, raw.contact_email_telegram_or_x, raw['Contact email, Telegram, or X']);
  const paymentTxSignature = first(raw.payment_tx_signature, raw.paymentTransactionSignature, raw['Payment transaction signature']);
  const projectNameTicker = first(raw.project_name_ticker, raw.projectNameTicker, raw['Project name + ticker']);
  const launchStatus = first(raw.launch_status, raw.launchStatus, raw['Live or pre-launch? Launching where?']);
  const pastedContext = first(raw.pasted_context, raw.pastedContext, raw['Paste everything you want roasted']);
  const urgentFocus = first(raw.urgent_focus, raw.urgentFocus, raw['What feels sketchiest or most urgent?']);

  const { projectName, ticker } = parseProjectNameTicker(projectNameTicker);

  const required = {
    contact,
    paymentTxSignature,
    projectNameTicker,
    launchStatus,
    pastedContext,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing required intake fields: ${missing.join(', ')}`);
  }

  return {
    contact: String(contact).trim(),
    paymentTxSignature: String(paymentTxSignature).trim(),
    projectNameTicker: String(projectNameTicker).trim(),
    projectName,
    ticker,
    launchStatus: String(launchStatus).trim(),
    pastedContext: String(pastedContext).trim(),
    urgentFocus: String(urgentFocus || '').trim(),
  };
}

function first(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');
}

function parseProjectNameTicker(value) {
  const text = String(value || '').trim();
  const slash = text.split('/').map((part) => part.trim()).filter(Boolean);
  if (slash.length >= 2) return { projectName: slash[0], ticker: slash[1].replace(/^\$/, '') };

  const paren = text.match(/^(.+?)\s*\((\$?[A-Za-z0-9_-]+)\)\s*$/);
  if (paren) return { projectName: paren[1].trim(), ticker: paren[2].replace(/^\$/, '') };

  const dollar = text.match(/^(.+?)\s+\$([A-Za-z0-9_-]+)\s*$/);
  if (dollar) return { projectName: dollar[1].trim(), ticker: dollar[2] };

  return { projectName: text, ticker: 'TBD' };
}

async function verifyPayment(signature, options) {
  if (options.skipPayment || signature.startsWith('DRY_RUN')) {
    return {
      status: 'skipped',
      valid: false,
      reason: 'Payment verification skipped for dry run.',
      signature,
      receiveWallet: options.receiveWallet,
      nativeSolReceived: 0,
      usdcReceived: 0,
    };
  }

  let tx;
  try {
    tx = await rpc(options.rpcUrl, 'getTransaction', [
      signature,
      {
        commitment: 'confirmed',
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
      },
    ]);
  } catch (error) {
    return {
      status: 'rpc_error',
      valid: false,
      reason: error.message,
      signature,
      receiveWallet: options.receiveWallet,
      nativeSolReceived: 0,
      usdcReceived: 0,
    };
  }

  if (!tx) {
    return {
      status: 'not_found',
      valid: false,
      reason: 'Transaction was not found by the configured Solana RPC.',
      signature,
      receiveWallet: options.receiveWallet,
      nativeSolReceived: 0,
      usdcReceived: 0,
    };
  }

  if (tx.meta?.err) {
    return {
      status: 'failed',
      valid: false,
      reason: `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
      signature,
      receiveWallet: options.receiveWallet,
      nativeSolReceived: 0,
      usdcReceived: 0,
    };
  }

  const nativeSolReceived = receivedNativeSol(tx, options.receiveWallet);
  const usdcReceived = receivedTokenAmount(tx, options.receiveWallet, USDC_MINT);
  const valid = nativeSolReceived >= MIN_SOL || usdcReceived >= MIN_USDC;

  return {
    status: valid ? 'paid' : 'underpaid_or_wrong_recipient',
    valid,
    reason: valid
      ? 'Transaction meets the configured payment threshold.'
      : `Expected at least ${MIN_SOL} SOL or ${MIN_USDC} USDC to ${options.receiveWallet}.`,
    signature,
    receiveWallet: options.receiveWallet,
    nativeSolReceived,
    usdcReceived,
    slot: tx.slot,
    blockTime: tx.blockTime,
  };
}

async function rpc(url, method, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'rug-risk-roast', method, params }),
  });

  if (!response.ok) {
    throw new Error(`Solana RPC HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`Solana RPC error: ${JSON.stringify(payload.error)}`);
  }
  return payload.result;
}

function receivedNativeSol(tx, receiveWallet) {
  const keys = tx.transaction.message.accountKeys.map((key) => typeof key === 'string' ? key : key.pubkey);
  const index = keys.findIndex((key) => key === receiveWallet);
  if (index === -1) return 0;
  const pre = tx.meta?.preBalances?.[index] || 0;
  const post = tx.meta?.postBalances?.[index] || 0;
  return Math.max(0, post - pre) / 1_000_000_000;
}

function receivedTokenAmount(tx, receiveWallet, mint) {
  const pre = new Map();
  for (const balance of tx.meta?.preTokenBalances || []) {
    if (balance.owner === receiveWallet && balance.mint === mint) {
      pre.set(balance.accountIndex, Number(balance.uiTokenAmount.uiAmountString || 0));
    }
  }

  let received = 0;
  for (const balance of tx.meta?.postTokenBalances || []) {
    if (balance.owner !== receiveWallet || balance.mint !== mint) continue;
    const before = pre.get(balance.accountIndex) || 0;
    const after = Number(balance.uiTokenAmount.uiAmountString || 0);
    received += Math.max(0, after - before);
  }
  return received;
}

function buildAuditDraft(intake, payment, now) {
  const signals = analyzeSignals(intake);
  const scores = scoreProject(signals);
  const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
  const findings = buildFindings(signals, intake);

  return `# Rug-Risk Roast Report

Client: ${intake.contact}

Project: ${intake.projectName}

Ticker: ${intake.ticker}

Status: ${intake.launchStatus}

Date: ${now.toISOString().slice(0, 10)}

Reviewer: Rug-Risk Roast

## Payment Check

Status: ${payment.status}

Transaction: ${payment.signature}

SOL received: ${payment.nativeSolReceived}

USDC received: ${payment.usdcReceived}

Operator note: ${payment.reason}

## Overall Score

\`\`\`text
${total} / 100
\`\`\`

Verdict: ${verdictForScore(total)}

## Section Scores

| Category | Score | Notes |
|---|---:|---|
| Identity clarity | ${scores.identityClarity} | ${signals.hasProjectName ? 'Project name is present.' : 'Project identity needs clarification.'} |
| Token/page copy | ${scores.tokenCopy} | ${signals.hasHypeLanguage ? 'Copy contains hype or pressure language.' : 'Copy avoids the most obvious hype phrases.'} |
| Visual trust | ${scores.visualTrust} | ${signals.hasImageSignal ? 'Image or visual notes were provided.' : 'No token image or visual context was provided.'} |
| Social proof | ${scores.socialProof} | ${signals.hasSocialLinks ? 'Some social/link context is present.' : 'No clear social links or link hub were provided.'} |
| Wallet/liquidity disclosure | ${scores.walletDisclosure} | ${signals.hasWalletDisclosure ? 'Wallet/liquidity details were mentioned.' : 'No authority, reserve, wallet, or liquidity disclosure was provided.'} |
| Launch safety | ${scores.launchSafety} | ${signals.hasOfficialLinks ? 'Official link material is present.' : 'Official-link discipline needs work.'} |
| Community readiness | ${scores.communityReadiness} | ${signals.hasTelegramContext ? 'Telegram/community context was mentioned.' : 'Community readiness is unclear.'} |
| Scam-link risk | ${scores.scamLinkRisk} | ${signals.linkCount > 4 ? 'Many links need cleanup and centralization.' : 'Link surface is manageable.'} |
| Compliance language | ${scores.complianceLanguage} | ${signals.hasRiskLanguage ? 'Some risk language is present.' : 'Risk language needs to be added.'} |

## Top 10 Red Flags

${findings.map((finding, index) => `${index + 1}. ${finding.severity} - ${finding.issue} - ${finding.fix}`).join('\n')}

## Fixed Token Description

\`\`\`text
${fixedTokenDescription(intake)}
\`\`\`

## Fixed X Bio

\`\`\`text
${fixedXBio(intake)}
\`\`\`

## Fixed Pinned Telegram Post

\`\`\`text
${fixedTelegramPin(intake)}
\`\`\`

## Fixed Launch Post

\`\`\`text
${fixedLaunchPost(intake)}
\`\`\`

## Do Not Say This

- Guaranteed.
- Next 100x.
- Floor will hold.
- Buy now.
- We are early.
- Legal/safe/certified.
- Trust the dev.
- Dev will never sell.
- Passive income.
- Revenue share unless legally reviewed and real.

## Next 5 Actions

1. Add one official-link source and make the token page, X, and Telegram match it.
2. Publish authority, reserve, and liquidity status in plain language.
3. Replace price, floor, and "early" language with concept and risk language.
4. Pin a Telegram warning that lists official links and warns against fake support DMs.
5. Queue three non-price updates for the first 24 hours after launch.

## Raw Intake

\`\`\`text
${intake.pastedContext}
${intake.urgentFocus ? `\nUrgent focus: ${intake.urgentFocus}` : ''}
\`\`\`

## Disclaimer

Rug-Risk Roast is an educational trust-readiness review, not financial, legal, tax, investment, or compliance advice. We do not guarantee token success, price performance, liquidity, listings, community growth, legal safety, or buyer trust. We do not help hide risk, fake trust, create fake volume, or mislead buyers.
`;
}

function analyzeSignals(intake) {
  const text = `${intake.projectNameTicker}\n${intake.launchStatus}\n${intake.pastedContext}\n${intake.urgentFocus}`.toLowerCase();
  const links = text.match(/https?:\/\/\S+/g) || [];
  const hypeChecks = [
    ['100x', /\b100x\b/],
    ['moon', /\bmoon\b/],
    ['floor', /\bfloor\b/],
    ['buy now', /\bbuy now\b/],
    ['early', /\bearly\b/],
    ['send it', /\bsend it\b/],
    ['guaranteed', /\bguaranteed\b/],
    ['based dev', /\bbased dev\b/],
    ['hold the floor', /\bhold the floor\b/],
    ['safest', /\bsafest\b/],
    ['ape', /\bape\b/],
  ];
  const hypeTerms = hypeChecks.filter(([, regex]) => regex.test(text)).map(([label]) => label);
  const negativeDisclosure = /(wallet|liquidity|lp|reserve|supply|authority)[^\n.]{0,80}(not ready|unknown|none|missing|not prepared)|no [^\n.]{0,40}(wallet|liquidity|lp|reserve|supply|authority)/.test(text);
  const positiveDisclosure = /(reserve wallet|liquidity (locked|burned|status)|lp (locked|burned|link)|supply policy|mint authority|freeze authority|update authority|authority (revoked|retained)|wallet disclosure)/.test(text);
  const positiveOfficialLinks = /(https?:\/\/|official links?:\s*https?:|official mint|official x|official telegram|link hub|pump\.fun)/.test(text);
  return {
    hasProjectName: Boolean(intake.projectName && intake.projectName !== 'unknown-project'),
    hasHypeLanguage: hypeTerms.length > 0,
    hypeTerms,
    hasImageSignal: /image|logo|pfp|avatar|art|visual/.test(text),
    hasSocialLinks: /(https?:\/\/|x\.com|twitter\.com|t\.me|discord\.gg|official x|official telegram|official website)/.test(text),
    hasWalletDisclosure: positiveDisclosure && !negativeDisclosure,
    hasOfficialLinks: positiveOfficialLinks && !/official links?[^\n.]{0,80}(not ready|soon|missing)/.test(text),
    hasTelegramContext: /telegram|t\.me|pin|community|mods|moderator/.test(text),
    hasRiskLanguage: /risk|not financial advice|lose all value|no profit|no guarantee|no utility/.test(text),
    linkCount: links.length,
    hasKnownPlatform: /pump\.fun|creatememes|moonshot|raydium|meteora|jupiter/.test(text),
  };
}

function scoreProject(signals) {
  return {
    identityClarity: clampScore(5 + (signals.hasProjectName ? 2 : 0) + (signals.hasKnownPlatform ? 1 : 0)),
    tokenCopy: clampScore(7 - (signals.hasHypeLanguage ? 3 : 0) + (signals.hasRiskLanguage ? 1 : 0)),
    visualTrust: clampScore(signals.hasImageSignal ? 6 : 4),
    socialProof: clampScore(3 + (signals.hasSocialLinks ? 2 : 0) + (signals.hasOfficialLinks ? 1 : 0)),
    walletDisclosure: clampScore(signals.hasWalletDisclosure ? 5 : 2),
    launchSafety: clampScore(4 + (signals.hasOfficialLinks ? 2 : 0) + (signals.hasWalletDisclosure ? 1 : 0)),
    communityReadiness: clampScore(3 + (signals.hasTelegramContext ? 2 : 0)),
    scamLinkRisk: clampScore(8 - Math.max(0, signals.linkCount - 4)),
    complianceLanguage: clampScore(6 - (signals.hasHypeLanguage ? 2 : 0) + (signals.hasRiskLanguage ? 1 : 0)),
  };
}

function clampScore(value) {
  return Math.max(0, Math.min(10, value));
}

function buildFindings(signals, intake) {
  const findings = [];

  if (signals.hasHypeLanguage) {
    findings.push({
      severity: 'High',
      issue: `Public copy contains hype/pressure terms: ${signals.hypeTerms.join(', ')}`,
      fix: 'Replace them with factual concept, official-link, and risk language.',
    });
  }

  if (!signals.hasWalletDisclosure) {
    findings.push({
      severity: 'High',
      issue: 'No authority, wallet, reserve, supply, or liquidity disclosure was provided.',
      fix: 'Publish authority status and reserve/liquidity policy before pushing the launch.',
    });
  }

  if (!signals.hasOfficialLinks) {
    findings.push({
      severity: 'High',
      issue: 'Official links are not clearly centralized.',
      fix: 'Create one official-link source and mirror it across token page, X, and Telegram.',
    });
  }

  if (!signals.hasTelegramContext) {
    findings.push({
      severity: 'Medium',
      issue: 'No Telegram pin, rules, or scam-DM warning was provided.',
      fix: 'Pin official links, risk language, and a fake-support DM warning before launch.',
    });
  }

  if (!signals.hasSocialLinks) {
    findings.push({
      severity: 'Medium',
      issue: 'Social proof and public surfaces are unclear.',
      fix: 'Add X/Telegram/website or state that they are intentionally not ready yet.',
    });
  }

  if (!signals.hasImageSignal) {
    findings.push({
      severity: 'Medium',
      issue: 'No token image or visual-readability context was submitted.',
      fix: 'Check the image at tiny avatar size and remove small text or low-contrast details.',
    });
  }

  if (!signals.hasRiskLanguage) {
    findings.push({
      severity: 'Medium',
      issue: 'Risk language is missing or too weak.',
      fix: 'Add no profit promise, no fake utility, no guaranteed roadmap, and meme-coin risk language.',
    });
  }

  if (signals.linkCount > 4) {
    findings.push({
      severity: 'Medium',
      issue: 'There are many links in the submitted material.',
      fix: 'Centralize official links and remove anything that is not essential for launch.',
    });
  }

  const defaults = [
    {
      severity: 'Medium',
      issue: 'The launch needs a first-24-hour content cadence.',
      fix: 'Queue concept, official-links, risk/disclosure, and community-rule posts.',
    },
    {
      severity: 'Medium',
      issue: 'The project needs a single clean one-line identity.',
      fix: `Use a direct line like: "${intake.projectName} is an experimental Solana meme with no profit promise."`,
    },
    {
      severity: 'Medium',
      issue: 'The X bio may not explain what the project is and what it is not.',
      fix: 'Use one concept line plus no profit promise, no fake utility, and official-links-only language.',
    },
    {
      severity: 'Medium',
      issue: 'The Telegram pin should be treated as launch infrastructure, not an afterthought.',
      fix: 'Pin official links, mint, rules, and anti-DM warning before sending traffic.',
    },
    {
      severity: 'Low',
      issue: 'The project should keep one source of truth for official links.',
      fix: 'Choose one link hub or pinned post and mirror it everywhere.',
    },
    {
      severity: 'Low',
      issue: 'The report needs manual verification against live pages.',
      fix: 'Open each submitted link before final delivery and adjust scores to match current public pages.',
    },
  ];

  for (const finding of defaults) {
    if (findings.length >= 10) break;
    if (!findings.some((existing) => existing.issue === finding.issue)) {
      findings.push(finding);
    }
  }

  return findings.slice(0, 10);
}

function fixedTokenDescription(intake) {
  return `${intake.projectName} is an experimental Solana meme launch. It has no profit promise, no fake utility, and no guaranteed roadmap. Official links should be posted in the project bio, token page, and Telegram pin. Meme coins are risky and can lose all value.`;
}

function fixedXBio(intake) {
  const ticker = intake.ticker === 'TBD' ? '' : ` $${intake.ticker}`;
  return `Experimental Solana meme${ticker}. No profit promise, no fake utility, no guaranteed roadmap. Official links only.`;
}

function fixedTelegramPin(intake) {
  return `Welcome to ${intake.projectName}.

Official mint: [insert when live]
Official launch page: [insert link]
Official X: [insert link]

Rules:
- No fake support DMs.
- No random links.
- No price promises.
- No coordinated pumps.
- No fake endorsements.

This is an experimental meme, not financial advice. Meme coins are risky and can lose all value.`;
}

function fixedLaunchPost(intake) {
  return `${intake.projectName} is live.

Experimental Solana meme.
No profit promise.
No fake utility.
No guaranteed roadmap.

Mint: [insert mint]
Official links: [insert link hub]
Risk: meme coins can lose all value.`;
}

function verdictForScore(score) {
  if (score < 40) return 'High-risk public presentation. Do not push harder until the basics are fixed.';
  if (score < 60) return 'Weak trust posture. The launch may be legitimate, but it currently looks rushed or under-disclosed.';
  if (score < 75) return 'Acceptable but fragile. Fix high-severity gaps before wider promotion.';
  if (score < 90) return 'Strong public presentation. Remaining issues are mostly polish.';
  return 'Very strong public presentation. Keep disclosures current as the launch changes.';
}

function buildIntakeMarkdown(intake, payment, now) {
  return `# Quick Intake - ${intake.projectName}

Date: ${now.toISOString()}

## Buyer

- Contact: ${intake.contact}
- Payment transaction signature: ${intake.paymentTxSignature}
- Payment status: ${payment.status}

## Project

- Project name + ticker: ${intake.projectNameTicker}
- Parsed project: ${intake.projectName}
- Parsed ticker: ${intake.ticker}
- Status/platform: ${intake.launchStatus}

## Pasted Context

\`\`\`text
${intake.pastedContext}
\`\`\`

## Urgent Focus

\`\`\`text
${intake.urgentFocus || 'Not provided.'}
\`\`\`
`;
}

function buildOperatorNote(intake, payment) {
  const warnings = [];
  if (payment.status !== 'paid') warnings.push('Do not deliver until payment is manually verified or intentionally waived.');
  if (!intake.pastedContext.includes('http')) warnings.push('No URLs were submitted. You may need to ask for links before final scoring.');

  return `# Operator Note

## Status

- Payment: ${payment.status}
- Buyer: ${intake.contact}
- Project: ${intake.projectName} / ${intake.ticker}

## Warnings

${warnings.length ? warnings.map((warning) => `- ${warning}`).join('\n') : '- None.'}

## Next Step

Open \`audit-draft.md\`, verify every finding manually, then send the final report only after payment is confirmed.
`;
}

async function appendScorecard(repoRoot, intake, payment, now, customerDir) {
  const scorecardPath = path.join(repoRoot, 'templates', 'scorecard.csv');
  const current = await readFile(scorecardPath, 'utf8');
  const orderId = `RRR-${now.getTime()}`;
  const row = [
    orderId,
    csv(intake.contact),
    csv(intake.contact),
    csv(payment.signature),
    csv(payment.status),
    csv(intake.projectName),
    csv(intake.launchStatus),
    csv('quick intake'),
    now.toISOString(),
    'drafted',
    '',
    '',
    csv(`Generated by prepare-audit.mjs: ${customerDir}`),
  ].join(',');
  await writeFile(scorecardPath, `${current.trimEnd()}\n${row}\n`);
}

function csv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function slugify(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unknown';
}
