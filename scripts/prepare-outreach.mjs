#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");

function usage() {
  console.log(`Usage: node scripts/prepare-outreach.mjs --csv prospects/YYYY-MM-DD-contact-first-prospects.csv [options]

Options:
  --limit N          Number of prospects to queue. Default: 10
  --channel all|telegram|x
                     Prefer contacts by channel. Default: all
  --copy N          Copy message number N from the generated queue to clipboard
  --open N          Open contact URL for message number N
  --out FILE        Output markdown file. Default: prospects/YYYY-MM-DD-outreach-queue.md

This does not send messages.`);
}

function parseArgs(argv) {
  const args = { limit: 10, channel: "all" };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--csv") {
      args.csv = argv[++i];
      continue;
    }
    if (arg === "--limit") {
      args.limit = Number(argv[++i]);
      continue;
    }
    if (arg === "--channel") {
      args.channel = argv[++i];
      continue;
    }
    if (arg === "--copy") {
      args.copy = Number(argv[++i]);
      continue;
    }
    if (arg === "--open") {
      args.open = Number(argv[++i]);
      continue;
    }
    if (arg === "--out") {
      args.out = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.csv) throw new Error("--csv is required");
  if (!["all", "telegram", "x"].includes(args.channel)) {
    throw new Error("--channel must be all, telegram, or x");
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...body] = rows.filter((item) => item.length > 1);
  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
  );
}

function firstTwoIssues(row) {
  return row.issues
    .split(";")
    .map((issue) => issue.trim())
    .filter(Boolean)
    .filter((issue) => issue !== "Has enough activity to care about perception")
    .slice(0, 2);
}

function contactFor(row, channel) {
  if (channel === "telegram") return row.telegram ? { channel: "Telegram", url: row.telegram } : null;
  if (channel === "x") return row.x ? { channel: "X", url: row.x } : null;
  if (row.telegram) return { channel: "Telegram", url: row.telegram };
  if (row.x) return { channel: "X", url: row.x };
  return null;
}

function needsSkip(row) {
  return /protected brand|personality|IP/i.test(row.caution);
}

function meridianMessage(row) {
  const issues = firstTwoIssues(row);
  const issueText = issues.length
    ? issues.map((issue) => `- ${issue}`).join("\n")
    : "- The project info is hard to verify quickly";

  return `Quick trust note on ${row.token_name || row.symbol}:

${issueText}

That doesn't mean the project is bad. It means fast scanners may read missing info as risk.

I run Rug-Risk Roast. It's a $19 manual trust-readiness audit for small crypto launches. I send back a scorecard, red flags, fixed launch copy, and the next 5 things to clean up within 24 hours.

Sample report: https://blight-east.github.io/rug-risk-roast/sample-report.html`;
}

function queueRows(rows, args) {
  return rows
    .map((row) => ({ row, contact: contactFor(row, args.channel) }))
    .filter(({ contact }) => Boolean(contact))
    .filter(({ row }) => !needsSkip(row))
    .slice(0, args.limit)
    .map(({ row, contact }, index) => ({
      number: index + 1,
      row,
      contact,
      message: meridianMessage(row),
    }));
}

function defaultOutPath(csvPath) {
  const basename = path.basename(csvPath).replace(/contact-first-prospects\.csv$/, "outreach-queue.md");
  return path.join(path.dirname(csvPath), basename);
}

function absolute(file) {
  return path.isAbsolute(file) ? file : path.join(ROOT, file);
}

function writeQueue(file, queue) {
  const lines = [
    "# Rug-Risk Roast Outreach Queue",
    "",
    "These are generated in a Meridian-style voice: specific, human, direct, and not hypey.",
    "",
    "Send manually. Do not mass-post the same message everywhere.",
    "",
  ];

  for (const item of queue) {
    lines.push(`## ${item.number}. ${item.row.token_name} (${item.row.symbol || "unknown"})`, "");
    lines.push(`- Contact: ${item.contact.channel} - ${item.contact.url}`);
    lines.push(`- DEX: ${item.row.dex_url}`);
    lines.push(`- Caution: ${item.row.caution || "none"}`, "");
    lines.push("```text");
    lines.push(item.message);
    lines.push("```", "");
  }

  fs.writeFileSync(file, `${lines.join("\n")}\n`);
}

function copyToClipboard(text) {
  const result = spawnSync("pbcopy", { input: text, encoding: "utf8" });
  if (result.status !== 0) throw new Error("pbcopy failed");
}

function openUrl(url) {
  const result = spawnSync("open", [url], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`open failed: ${url}`);
}

function main() {
  const args = parseArgs(process.argv);
  const csvPath = absolute(args.csv);
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const queue = queueRows(rows, args);
  const outPath = absolute(args.out || defaultOutPath(csvPath));

  writeQueue(outPath, queue);
  console.log(`Wrote ${queue.length} outreach items: ${outPath}`);

  if (args.copy) {
    const item = queue[args.copy - 1];
    if (!item) throw new Error(`No queue item ${args.copy}`);
    copyToClipboard(item.message);
    console.log(`Copied message ${args.copy} to clipboard.`);
  }

  if (args.open) {
    const item = queue[args.open - 1];
    if (!item) throw new Error(`No queue item ${args.open}`);
    openUrl(item.contact.url);
    console.log(`Opened ${item.contact.url}`);
  }
}

main();
