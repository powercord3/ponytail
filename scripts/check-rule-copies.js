#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8').replace(/\r\n/g, '\n').trim();
}

function stripFrontmatter(text) {
  return text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
}

const agents = read('AGENTS.md');
const canonical = agents.replace(/\n\n\(Yes, this file also applies[\s\S]*?\)$/, '').trim();

// Compact copies: same body as AGENTS.md, host-specific frontmatter stripped.
const copies = [
  ['.cursor/rules/ponytail.mdc', stripFrontmatter],
  ['.windsurf/rules/ponytail.md', text => text.trim()],
  ['.clinerules/ponytail.md', text => text.trim()],
  ['.agents/rules/ponytail.md', text => text.trim()],
  ['.github/copilot-instructions.md', text => text.trim()],
  ['.kiro/steering/ponytail.md', stripFrontmatter],
];

let failed = false;

for (const [relPath, normalize] of copies) {
  const actual = normalize(read(relPath));
  if (actual !== canonical) {
    console.error(`${relPath} drifted from AGENTS.md`);
    failed = true;
  }
}

// SKILL.md is the runtime source of truth and is longer than the compact body,
// so it cannot be byte-compared. ponytail: canary, not full equality. Assert the
// load-bearing rules survive verbatim in both the source and AGENTS.md. Changing
// a rule's wording trips this, which is the reminder to propagate it everywhere.
// Upgrade path: generate the copies from SKILL.md if this ever misses a real drift.
const INVARIANTS = [
  'naive heuristic',                       // ceiling-comment rule
  'ONE runnable check',                    // test reflex
  'flimsier algorithm',                    // robust-variant rule
  // the four "not lazy about" safety carve-outs: pin each so a reword in either
  // file can't silently drop one. Only validation was pinned before. These are the
  // continuous substrings present in both files ("prevents data loss" because the
  // full "error handling that prevents data loss" wraps a line in SKILL.md).
  'input validation at trust boundaries',
  'prevents data loss',
  'security',
  'accessibility',
  'Lazy code without its check is unfinished', // one-check promoted to headline
];

const skill = read('skills/ponytail/SKILL.md');
// The hook's hardcoded fallback is a rule copy like any other, and the only one
// no check covered: it had already lost "naive heuristic" and "flimsier
// algorithm" before this line was added. It fires only when SKILL.md is
// unreadable, which is exactly why nobody notices it drifting.
const { getFallbackInstructions } = require('../hooks/ponytail-instructions');
const fallback = getFallbackInstructions('full');
const sources = [
  ['skills/ponytail/SKILL.md', skill],
  ['AGENTS.md', agents],
  ['hooks/ponytail-instructions.js (fallback)', fallback],
];
for (const phrase of INVARIANTS) {
  for (const [label, text] of sources) {
    if (!text.includes(phrase)) {
      console.error(`${label} is missing rule invariant: "${phrase}"`);
      failed = true;
    }
  }
}

// The ladder is the skill's spine, and ponytail-help summarises it. That summary
// had silently dropped rungs 2 and 5 — including "already in this codebase",
// which SKILL.md itself calls the most common slop. Byte-comparing is wrong here
// (a summary is meant to be shorter), so assert each rung's concept survives.
const LADDER_RUNGS = [
  ['yagni', /yagni/i],
  ['already in this codebase', /already (in this codebase|here|exist)|reuse what/i],
  ['stdlib', /stdlib|standard library/i],
  ['native', /native/i],
  ['already-installed dependency', /already-installed|installed dep/i],
  ['one line', /one[- ]line/i],
  ['minimum', /minimum/i],
];
const ladderSources = [
  ['skills/ponytail/SKILL.md', skill],
  ['skills/ponytail-help/SKILL.md', read('skills/ponytail-help/SKILL.md')],
  ['hooks/ponytail-instructions.js (fallback)', fallback],
];
for (const [rung, pattern] of LADDER_RUNGS) {
  for (const [label, text] of ladderSources) {
    if (!pattern.test(text)) {
      console.error(`${label} is missing ladder rung: "${rung}"`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('Update the copied rule text, AGENTS.md, or SKILL.md so the shared rules match.');
  process.exit(1);
}

console.log(
  `Rule copies match AGENTS.md; ${INVARIANTS.length} rule invariants present in ` +
  `${sources.length} sources; all ${LADDER_RUNGS.length} ladder rungs present in ${ladderSources.length} sources.`
);
