#!/usr/bin/env node

/**
 * Codebase health check — single script, formatted output.
 *
 * Uses the TypeScript compiler API (already a dev dep) for real AST-based
 * cyclomatic complexity, npx jscpd for duplication, and simple fs walking
 * for LOC / hygiene counts.
 *
 * Usage:  node healthcheck/run.mjs
 *
 * Portability:
 *   1. Copy the healthcheck/ folder into any TypeScript project.
 *   2. Copy .cursor/commands/healthcheck.md alongside it.
 *   3. Add to .gitignore:  healthcheck/history.jsonl  and  healthcheck/.jscpd-report/
 *   4. (Optional) edit SOURCE_DIRS below for the project's directory layout.
 */

import { readFileSync, readdirSync, existsSync, appendFileSync, rmSync } from 'fs';
import { join, extname, relative, basename, dirname } from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// ── Config ──────────────────────────────────────────────────────────────────

const SOURCE_DIRS = ['app', 'components', 'lib', 'types'];
const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', '.jscpd-report', 'healthcheck',
]);
const ROOT = process.cwd();
const REPO_NAME = basename(ROOT);
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = join(SCRIPT_DIR, 'history.jsonl');
const JSCPD_DIR = join(SCRIPT_DIR, '.jscpd-report');

// ── File walker ─────────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (SOURCE_EXTS.has(extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

// ── LOC counting ────────────────────────────────────────────────────────────

function countLOC(files) {
  const byExt = {};
  const fileStats = [];
  let total = 0;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n').length;
    const ext = extname(file);
    byExt[ext] = (byExt[ext] || 0) + lines;
    total += lines;
    fileStats.push({ file: relative(ROOT, file).replace(/\\/g, '/'), lines });
  }

  return { total, byExt, fileStats };
}

// ── Cyclomatic complexity (TypeScript compiler API) ─────────────────────────

const BRANCH_KINDS = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ConditionalExpression,
  ts.SyntaxKind.CaseClause,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.DoStatement,
  ts.SyntaxKind.CatchClause,
]);

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function getFunctionName(node, sourceFile) {
  if (node.name) return node.name.getText(sourceFile);
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && parent.name) {
    return parent.name.getText(sourceFile);
  }
  if (parent && ts.isPropertyAssignment(parent) && parent.name) {
    return parent.name.getText(sourceFile);
  }
  if (parent && ts.isPropertyDeclaration(parent) && parent.name) {
    return parent.name.getText(sourceFile);
  }
  return '<anonymous>';
}

function analyzeComplexity(files) {
  const functions = [];

  for (const file of files) {
    const ext = extname(file);
    if (ext !== '.ts' && ext !== '.tsx') continue;

    const content = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ext === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    function visit(node, currentFn) {
      if (isFunctionLike(node)) {
        const name = getFunctionName(node, sourceFile);
        const line =
          sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            .line + 1;
        const fn = {
          name,
          file: relative(ROOT, file).replace(/\\/g, '/'),
          line,
          complexity: 1,
        };
        functions.push(fn);
        ts.forEachChild(node, (child) => visit(child, fn));
        return;
      }

      if (currentFn) {
        if (BRANCH_KINDS.has(node.kind)) {
          currentFn.complexity++;
        }
        if (ts.isBinaryExpression(node)) {
          const op = node.operatorToken.kind;
          if (
            op === ts.SyntaxKind.AmpersandAmpersandToken ||
            op === ts.SyntaxKind.BarBarToken
          ) {
            currentFn.complexity++;
          }
        }
      }

      ts.forEachChild(node, (child) => visit(child, currentFn));
    }

    ts.forEachChild(sourceFile, (child) => visit(child, null));
  }

  return functions;
}

// ── Duplication (jscpd) ─────────────────────────────────────────────────────

function analyzeDuplication() {
  const jscpdReport = join(JSCPD_DIR, 'jscpd-report.json');
  try {
    const dirs = SOURCE_DIRS.filter((d) => existsSync(join(ROOT, d))).join(' ');
    if (!dirs) return null;
    execSync(
      `npx jscpd ${dirs} --min-lines 5 --reporters json --output ${relative(ROOT, JSCPD_DIR).replace(/\\/g, '/')}`,
      { cwd: ROOT, stdio: 'pipe', timeout: 90_000 },
    );
    if (existsSync(jscpdReport)) {
      const report = JSON.parse(readFileSync(jscpdReport, 'utf8'));
      const stats = report.statistics?.total || {};
      const dupes = report.duplicates || [];
      return {
        percentage: stats.percentage ?? 0,
        duplicatedLines: stats.duplicatedLines ?? 0,
        clones: dupes.length,
        largeBlocks: dupes.filter((d) => (d.lines || 0) > 50).length,
      };
    }
  } catch {
    // jscpd failed or timed out
  } finally {
    // Always clean up temp jscpd output
    if (existsSync(JSCPD_DIR)) {
      try { rmSync(JSCPD_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
  return null;
}

// ── Type errors ─────────────────────────────────────────────────────────────

function countTypeErrors() {
  try {
    execSync('npx tsc --noEmit', { cwd: ROOT, stdio: 'pipe', timeout: 120_000 });
    return 0;
  } catch (e) {
    const output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
    return output.split('\n').filter((l) => l.includes('error TS')).length;
  }
}

// ── Hygiene checks ──────────────────────────────────────────────────────────

function checkHygiene(files) {
  let consoleLogs = 0;
  let anyTypes = 0;

  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (rel === 'lib/logger.ts') continue;

    const content = readFileSync(file, 'utf8');
    for (const line of content.split('\n')) {
      if (/console\.log\b/.test(line)) consoleLogs++;
      if (/:\s*any\b/.test(line) || /\bas\s+any\b/.test(line)) anyTypes++;
    }
  }

  return { consoleLogs, anyTypes };
}

// ── Score ────────────────────────────────────────────────────────────────────

function calcScore(m) {
  let s = 0;
  s += Math.min(m.filesOver500, 2);
  s += Math.min(m.hotspots, 2);
  if (m.dupePct > 20) s += 3;
  else if (m.dupePct > 10) s += 2;
  else if (m.dupePct > 5) s += 1;
  if (m.typeErrors > 5) s += 2;
  else if (m.typeErrors > 0) s += 1;
  if (m.consoleLogs > 0) s += 0.5;
  if (m.anyTypes > 0) s += 0.5;
  return Math.min(Math.round(s), 10);
}

// ── Main ────────────────────────────────────────────────────────────────────

const t0 = Date.now();
const files = SOURCE_DIRS.flatMap((d) => walkDir(join(ROOT, d)));

process.stdout.write('Counting LOC...\r');
const loc = countLOC(files);

process.stdout.write('Analyzing complexity...\r');
const fns = analyzeComplexity(files);

process.stdout.write('Detecting duplication...\r');
const dupe = analyzeDuplication();

process.stdout.write('Checking types...       \r');
const typeErrors = countTypeErrors();

process.stdout.write('Checking hygiene...     \r');
const hygiene = checkHygiene(files);

process.stdout.write('                        \r');

// Derived metrics
const filesOver300 = loc.fileStats.filter((f) => f.lines > 300).length;
const filesOver500 = loc.fileStats.filter((f) => f.lines > 500).length;
const maxFn = fns.reduce(
  (best, f) => (f.complexity > best.complexity ? f : best),
  { complexity: 0, name: '-', file: '-', line: 0 },
);
const avgComplexity = fns.length
  ? fns.reduce((sum, f) => sum + f.complexity, 0) / fns.length
  : 0;
const hotspots = fns.filter((f) => f.complexity > 15);
const dupePct = dupe?.percentage ?? 0;
const dupeBlocks = dupe?.largeBlocks ?? 0;

const score = calcScore({
  filesOver500,
  hotspots: hotspots.length,
  dupePct,
  typeErrors,
  consoleLogs: hygiene.consoleLogs,
  anyTypes: hygiene.anyTypes,
});

// Language breakdown (top 3)
const langs = Object.entries(loc.byExt)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([ext, n]) => `${ext} ${n}`)
  .join(', ');

const dupeStr = dupe
  ? `${dupePct.toFixed(1)}%`
  : 'N/A (jscpd failed)';
const dupeBlockStr = dupe ? `${dupeBlocks}` : 'N/A';
const dupeRatioStr = dupe
  ? dupePct > 10 ? 'yes' : 'no'
  : 'N/A';

// ── Print ───────────────────────────────────────────────────────────────────

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

const output = [
  `Repo: ${REPO_NAME}`,
  `Date: ${new Date().toISOString().slice(0, 10)}`,
  ``,
  `Total LOC:          ${loc.total}`,
  `Languages:          ${langs}`,
  ``,
  `Max Complexity:     ${maxFn.complexity}   (${maxFn.name} in ${maxFn.file}:${maxFn.line})`,
  `Avg Complexity:     ${avgComplexity.toFixed(1)}`,
  `Files >300 LOC:     ${filesOver300}`,
  `Duplication %:      ${dupeStr}`,
  `Duplication blocks: ${dupeBlockStr}   (>50 lines)`,
  ``,
  `Type errors:        ${typeErrors}`,
  `console.log:        ${hygiene.consoleLogs}`,
  `any types:          ${hygiene.anyTypes}`,
  ``,
  `Urgency indicators:`,
  `- High complexity hotspots (>15):   ${hotspots.length}`,
  `- Large files (>500 LOC):           ${filesOver500}`,
  `- Dupe ratio >10%:                  ${dupeRatioStr}`,
  ``,
  `Score (higher = more urgent): ${score}/10`,
].join('\n');

console.log(output);

// Hotspot details
const largeFiles = loc.fileStats
  .filter((f) => f.lines > 300)
  .sort((a, b) => b.lines - a.lines)
  .slice(0, 5);

if (largeFiles.length > 0 || hotspots.length > 0) {
  console.log('\n--- Hotspots ---');
  if (largeFiles.length > 0) {
    console.log('Large files (>300 LOC):');
    for (const f of largeFiles) console.log(`  ${f.lines} LOC  ${f.file}`);
  }
  if (hotspots.length > 0) {
    console.log('Complex functions (CCN >15):');
    for (const f of hotspots.slice(0, 5))
      console.log(`  CCN ${f.complexity}  ${f.name} in ${f.file}:${f.line}`);
  }
}

console.log(`\n(${elapsed}s)`);

// ── History ─────────────────────────────────────────────────────────────────

const entry = {
  date: new Date().toISOString().slice(0, 10),
  loc: loc.total,
  maxComplexity: maxFn.complexity,
  avgComplexity: +avgComplexity.toFixed(1),
  filesOver300,
  filesOver500,
  dupePct: dupe ? +dupePct.toFixed(1) : null,
  dupeBlocks: dupe ? dupeBlocks : null,
  typeErrors,
  consoleLogs: hygiene.consoleLogs,
  anyTypes: hygiene.anyTypes,
  hotspots: hotspots.length,
  score,
};

appendFileSync(HISTORY_FILE, JSON.stringify(entry) + '\n');
