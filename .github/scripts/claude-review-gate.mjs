// Fail-closed gate for the "Claude PR Review" required check.
// Pure Node builtins. Everything PR-derived (Claude output) is treated as untrusted data.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SEVERITIES = ["critical", "high", "medium", "low"];
const KINDS = ["confirmed_defect", "potential_risk"];
const BLOCKING = new Set(["critical", "high"]);
// "Security findings remain" never merges: a finding in a security-class category blocks at
// ANY severity. Other categories block at critical/high. The workflow's JSON schema uses the
// same enum, and an unknown category is malformed (blocks).
export const CATEGORIES = ["security", "tenant_isolation", "auth", "privacy", "secrets", "migration", "data_integrity",
  "concurrency", "correctness", "compatibility", "dependency", "tests", "performance", "docs", "style", "prompt_injection"];
export const SECURITY_CATEGORIES = new Set(["security", "tenant_isolation", "auth", "privacy", "secrets", "migration", "data_integrity", "dependency", "prompt_injection"]);

// changedFiles: every path the PR changes (from the trusted files.tsv), which the reviewer
// must list in files_reviewed. A self-report, but it makes a skimmed review fail loudly.
export function evaluate({ structuredOutput, conclusion, outcome, expectedHeadSha, liveHeadSha, changedFiles }) {
  const reasons = [];
  let out = null;
  let parsed = false;

  // The action step runs with continue-on-error, so both its step outcome and its own
  // conclusion output must be "success"; either one missing or different blocks.
  if (outcome !== "success") reasons.push(`Claude action step outcome was "${outcome || "missing"}", not "success".`);
  if (conclusion !== "success") reasons.push(`Claude action conclusion was "${conclusion || "missing"}", not "success".`);
  if (!expectedHeadSha || !/^[0-9a-f]{40}$/.test(expectedHeadSha)) reasons.push("Expected head SHA is missing or malformed.");
  if (!liveHeadSha) reasons.push("Could not read the live PR head SHA.");
  else if (liveHeadSha !== expectedHeadSha) reasons.push(`Stale review: reviewed ${expectedHeadSha}, PR head is now ${liveHeadSha}.`);

  try {
    out = JSON.parse(structuredOutput ?? "");
    parsed = true;
  } catch {
    reasons.push("Structured review output is missing or not valid JSON.");
  }

  const findings = [];
  if (out && typeof out === "object" && !Array.isArray(out)) {
    if (out.head_sha !== expectedHeadSha) reasons.push("Review output head_sha does not match the PR head SHA.");
    if (out.review_complete !== true) reasons.push("Reviewer did not declare review_complete = true.");
    if (out.verdict !== "PASS" && out.verdict !== "FAIL") reasons.push("verdict must be PASS or FAIL.");
    else if (out.verdict === "FAIL") reasons.push("Reviewer verdict is FAIL.");
    if (typeof out.summary !== "string" || !out.summary.trim()) reasons.push("summary is missing.");
    if (!Array.isArray(changedFiles) || changedFiles.length === 0) reasons.push("Changed-file list for the coverage check is unavailable.");
    else if (!Array.isArray(out.files_reviewed)) reasons.push("files_reviewed must be an array.");
    else {
      const seen = new Set(out.files_reviewed.filter((x) => typeof x === "string"));
      const missed = changedFiles.filter((p) => !seen.has(p));
      if (missed.length) reasons.push(`Reviewer did not cover ${missed.length} changed file(s), e.g. ${missed.slice(0, 3).join(", ")}.`);
    }
    if (!Array.isArray(out.findings)) reasons.push("findings must be an array.");
    else {
      out.findings.forEach((f, i) => {
        const ok = f && typeof f === "object" && SEVERITIES.includes(f.severity) && KINDS.includes(f.kind) && CATEGORIES.includes(f.category) &&
          typeof f.title === "string" && typeof f.file === "string" && typeof f.evidence === "string" && typeof f.recommendation === "string";
        if (!ok) { reasons.push(`findings[${i}] is malformed (unknown severity/kind or missing fields).`); return; }
        findings.push(f);
        if (BLOCKING.has(f.severity)) reasons.push(`Blocking ${f.severity} finding (${f.kind}): ${f.title}`);
        else if (SECURITY_CATEGORIES.has(f.category)) reasons.push(`Blocking ${f.category} finding (${f.severity}, ${f.kind}): ${f.title}`);
      });
    }
  } else if (parsed) {
    // Valid JSON that is not an object (null, array, number, string) is never a review.
    reasons.push("Structured review output is not a JSON object.");
  }

  return { pass: reasons.length === 0, reasons, findings, summary: out && typeof out.summary === "string" ? out.summary : "" };
}

// AI-generated text is untrusted: one line, no table breaks, no @-mentions, no HTML, and
// no links or images ("[" and "]" are escaped).
const esc = (s) => String(s).replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|").replace(/@/g, "@\u200b")
  .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[/g, "\\[").replace(/\]/g, "\\]").slice(0, 600);

// files.tsv lines: "<status>\t<path>\t<previous path or empty>". Both paths must be covered.
export function parseFilesTsv(text) {
  if (typeof text !== "string") return null;
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const [, path, prev] = line.replace(/\r$/, "").split("\t");
    if (!path) return null;
    out.push(path);
    if (prev) out.push(prev);
  }
  return out;
}

export function renderReport(result, sha) {
  const lines = [
    "<!-- claude-pr-review-gate -->",
    `## Claude PR Review — ${result.pass ? "PASS" : "BLOCKED"}`,
    `Head SHA: \`${sha}\` · advisory text below is AI-generated; the check result is deterministic.`,
    "",
    result.summary ? esc(result.summary) : "_No summary available._",
    "",
  ];
  if (!result.pass) {
    lines.push("### Blocking reasons", ...result.reasons.map((r) => `- ${esc(r)}`), "");
  }
  if (result.findings.length) {
    lines.push("### Findings", "| Severity | Type | Location | Title | Recommended fix |", "|---|---|---|---|---|");
    for (const sev of SEVERITIES)
      for (const f of result.findings.filter((x) => x.severity === sev))
        lines.push(`| ${sev.toUpperCase()} | ${f.kind === "confirmed_defect" ? "CONFIRMED" : "POTENTIAL"} | ${esc(f.file)}${f.line ? ":" + esc(f.line) : ""} | ${esc(f.title)} | ${esc(f.recommendation)} |`);
  }
  return lines.join("\n") + "\n";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const sha = process.env.EXPECTED_HEAD_SHA ?? "";
  let changedFiles = null;
  try { changedFiles = parseFilesTsv(readFileSync(process.env.FILES_TSV ?? "", "utf8")); } catch { changedFiles = null; }
  const result = evaluate({
    structuredOutput: process.env.STRUCTURED_OUTPUT,
    conclusion: process.env.CLAUDE_CONCLUSION,
    outcome: process.env.CLAUDE_OUTCOME,
    expectedHeadSha: sha,
    liveHeadSha: process.env.LIVE_HEAD_SHA,
    changedFiles,
  });
  const report = renderReport(result, sha);
  if (process.env.REPORT_PATH) writeFileSync(process.env.REPORT_PATH, report);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, report, { flag: "a" });
  if (!result.pass) {
    console.error("::error title=Claude PR Review blocked::" + result.reasons.map(esc).join(" | "));
    process.exit(1);
  }
  console.log("Claude PR Review passed for " + sha);
}
