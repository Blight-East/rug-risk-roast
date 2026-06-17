#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "prospects");

const ENDPOINTS = [
  ["profiles", "https://api.dexscreener.com/token-profiles/latest/v1"],
  ["boosts", "https://api.dexscreener.com/token-boosts/latest/v1"],
  ["ctos", "https://api.dexscreener.com/community-takeovers/latest/v1"],
];

const MIN_ACTIVITY_SCORE = 1;
const REQUEST_DELAY_MS = 250;

function usage() {
  console.log(`Usage: node scripts/find-prospects.mjs [--limit 40]

Finds Solana launch prospects from public DEX Screener feeds and writes:
- prospects/YYYY-MM-DD-dexscreener-prospects.csv
- prospects/YYYY-MM-DD-dexscreener-prospects.md
- prospects/YYYY-MM-DD-contact-first-prospects.csv
- prospects/YYYY-MM-DD-contact-first-prospects.md

No messages are sent.`);
}

function parseArgs(argv) {
  const args = { limit: 40 };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--limit") {
      args.limit = Number(argv[++i]);
      if (!Number.isFinite(args.limit) || args.limit < 1) {
        throw new Error("--limit must be a positive number");
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "rug-risk-roast-prospect-finder/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeUrl(url) {
  if (!url || typeof url !== "string") return "";
  return url.trim();
}

function getLinks(profile = {}) {
  const links = Array.isArray(profile.links) ? profile.links : [];
  const byType = {};
  for (const link of links) {
    const type = String(link.type || link.label || "").toLowerCase();
    const url = normalizeUrl(link.url);
    if (!url) continue;
    if (type.includes("twitter") || type === "x") byType.x = byType.x || url;
    else if (type.includes("telegram")) byType.telegram = byType.telegram || url;
    else if (type.includes("discord")) byType.discord = byType.discord || url;
    else if (type.includes("website") || type.includes("site")) byType.website = byType.website || url;
    else if (!byType.other) byType.other = url;
  }

  if (!byType.website && profile.url && !String(profile.url).includes("dexscreener.com")) {
    byType.website = normalizeUrl(profile.url);
  }

  return byType;
}

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return "";
  if (number >= 1_000_000) return `$${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `$${Math.round(number / 1_000)}k`;
  return `$${Math.round(number)}`;
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(file, rows) {
  const headers = [
    "priority",
    "score",
    "token_name",
    "symbol",
    "dex_url",
    "x",
    "telegram",
    "website",
    "market_cap",
    "liquidity",
    "volume_24h",
    "issues",
    "caution",
    "outreach_message",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row, index) =>
      headers
        .map((header) => csvCell(header === "priority" ? index + 1 : row[header]))
        .join(",")
    ),
  ];
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

function topIssues(issues, count = 2) {
  return issues.slice(0, count);
}

function buildMessage(row) {
  const issues = topIssues(row.issueList);
  const issueLines = issues.map((issue) => `- ${issue}`).join("\n");
  return `Quick trust note: your launch has a couple things that can make degens assume rug faster than they should:

${issueLines}

I run Rug-Risk Roast. It's a $19 manual trust-readiness audit for small crypto launches. You get a scorecard, red flags, fixed token description, fixed X/Telegram copy, and next actions within 24 hours.

Sample: https://blight-east.github.io/rug-risk-roast/sample-report.html`;
}

function scoreProspect(profile, pair, sourceSet) {
  const links = getLinks(profile);
  const description = String(profile.description || pair?.baseToken?.name || "").trim();
  const dexUrl = profile.url || pair?.url || "";
  const liquidityUsd = Number(pair?.liquidity?.usd || 0);
  const volume24h = Number(pair?.volume?.h24 || 0);
  const marketCap = Number(pair?.marketCap || pair?.fdv || 0);
  const issueList = [];
  let score = 0;

  if (!description) {
    issueList.push("No DEX Screener description");
    score += 3;
  } else if (description.length < 80) {
    issueList.push("Very thin description");
    score += 2;
  }

  if (!links.website) {
    issueList.push("No website");
    score += 2;
  }
  if (!links.telegram) {
    issueList.push("No Telegram");
    score += 2;
  }
  if (!links.x) {
    issueList.push("No X account");
    score += 2;
  } else if (links.x.includes("/i/communities/")) {
    issueList.push("Uses X community instead of clear project account");
    score += 2;
  }

  if (/\b(100x|moon|pump|send|guaranteed|safe|no rug|based dev|diamond)\b/i.test(description)) {
    issueList.push("Hype/trust language needs cleaner risk framing");
    score += 2;
  }

  if (sourceSet.has("ctos")) {
    issueList.push("CTO/community takeover needs clean trust framing");
    score += 2;
  }

  if (liquidityUsd > 0 && liquidityUsd < 20_000) {
    issueList.push("Small active liquidity range");
    score += 1;
  }

  let activityScore = 0;
  if (volume24h >= 5_000) activityScore += 1;
  if (marketCap >= 10_000) activityScore += 1;
  if (liquidityUsd >= 2_000) activityScore += 1;

  if (activityScore >= MIN_ACTIVITY_SCORE) {
    issueList.push("Has enough activity to care about perception");
    score += 1;
  }

  const caution = [];
  if (links.x?.includes("/i/communities/")) caution.push("X contact is community, not clear project account");
  if (!links.telegram) caution.push("no Telegram");
  if (!links.website) caution.push("no website");
  if (/\b(elon|apple|google|nvidia|tesla|dennis rodman|trump|ansem|lightyear)\b/i.test(`${profile.tokenAddress} ${profile.header || ""} ${description} ${pair?.baseToken?.name || ""}`)) {
    caution.push("possible protected brand/personality/IP angle");
  }

  const row = {
    score,
    token_name: pair?.baseToken?.name || profile.name || profile.header || profile.tokenAddress,
    symbol: pair?.baseToken?.symbol || profile.symbol || "",
    dex_url: dexUrl,
    x: links.x || "",
    telegram: links.telegram || "",
    website: links.website || "",
    market_cap: money(marketCap),
    liquidity: money(liquidityUsd),
    volume_24h: money(volume24h),
    issues: issueList.join("; "),
    issueList,
    caution: caution.join("; "),
  };
  row.outreach_message = buildMessage(row);
  return row;
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const profiles = new Map();

  for (const [source, url] of ENDPOINTS) {
    const data = await fetchJson(url);
    const items = Array.isArray(data) ? data : data?.items || [];
    for (const item of items) {
      if (item.chainId !== "solana" || !item.tokenAddress) continue;
      const existing = profiles.get(item.tokenAddress) || { ...item, sources: new Set() };
      existing.sources.add(source);
      existing.links = [...(existing.links || []), ...(item.links || [])];
      existing.description = existing.description || item.description || "";
      existing.url = existing.url || item.url || "";
      profiles.set(item.tokenAddress, existing);
    }
  }

  const prospects = [];
  for (const [address, profile] of profiles) {
    await sleep(REQUEST_DELAY_MS);
    let pair = null;
    try {
      const data = await fetchJson(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
      pair = Array.isArray(data) ? data[0] : null;
    } catch {
      pair = null;
    }

    const row = scoreProspect(profile, pair, profile.sources);
    if (row.score > 0) prospects.push(row);
  }

  prospects.sort((a, b) => {
    const aContact = Number(Boolean(a.telegram || a.x));
    const bContact = Number(Boolean(b.telegram || b.x));
    return bContact - aContact || b.score - a.score;
  });

  const raw = prospects.slice(0, args.limit);
  const contactFirst = raw
    .filter((row) => row.telegram || row.x)
    .sort((a, b) => {
      const aDirect = Number(Boolean(a.telegram || (a.x && !a.x.includes("/i/communities/"))));
      const bDirect = Number(Boolean(b.telegram || (b.x && !b.x.includes("/i/communities/"))));
      return bDirect - aDirect || b.score - a.score;
    });

  const date = today();
  const rawCsv = path.join(OUT_DIR, `${date}-dexscreener-prospects.csv`);
  const contactCsv = path.join(OUT_DIR, `${date}-contact-first-prospects.csv`);
  const rawMd = path.join(OUT_DIR, `${date}-dexscreener-prospects.md`);
  const contactMd = path.join(OUT_DIR, `${date}-contact-first-prospects.md`);

  writeCsv(rawCsv, raw);
  writeCsv(contactCsv, contactFirst);
  writeMarkdown(rawMd, `DEX Screener Prospects - ${date}`, raw);
  writeMarkdown(
    contactMd,
    `Contact-First Rug-Risk Roast Prospects - ${date}`,
    contactFirst,
    "Use this list before the raw CSV. These have public contact surfaces. Personalize before sending. If caution mentions protected brand/personality/IP, skip unless your message is only a high-level warning and they are willing to change direction."
  );

  console.log(`Wrote ${raw.length} raw prospects: ${rawCsv}`);
  console.log(`Wrote ${contactFirst.length} contact-first prospects: ${contactCsv}`);
  console.log(`Readable files:`);
  console.log(`- ${rawMd}`);
  console.log(`- ${contactMd}`);
}

function writeMarkdown(file, title, rows, intro = "") {
  const lines = [`# ${title}`, ""];
  if (intro) lines.push(intro, "");
  rows.forEach((row, index) => {
    lines.push(`## ${index + 1}. ${row.token_name} (${row.symbol || "unknown"})`, "");
    lines.push(`- Score: ${row.score}`);
    lines.push(`- DEX: ${row.dex_url || "missing"}`);
    lines.push(`- X: ${row.x || "missing"}`);
    lines.push(`- Telegram: ${row.telegram || "missing"}`);
    lines.push(`- Website: ${row.website || "missing"}`);
    lines.push(`- Market cap: ${row.market_cap || "unknown"}`);
    lines.push(`- Liquidity: ${row.liquidity || "unknown"}`);
    lines.push(`- 24h volume: ${row.volume_24h || "unknown"}`);
    lines.push(`- Issues: ${row.issues || "none scored"}`);
    lines.push(`- Caution: ${row.caution || "none"}`, "");
    lines.push("Suggested first message:", "");
    lines.push("```text");
    lines.push(row.outreach_message);
    lines.push("```", "");
  });
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
