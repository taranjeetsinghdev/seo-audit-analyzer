import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../lib/analyze.js';
import { toCsv, toHtml, toMarkdown } from '../lib/report-export.js';
import { MODULES } from '../lib/modules.js';
import { RULES } from '../lib/seo-rules.js';

const report = buildReport({
  html: '<html lang="en"><head><title>A <script>alert(1)</script> title, with comma</title></head><body><h1>x</h1></body></html>',
  finalUrl: 'https://example.com/',
  statusCode: 200,
  headers: { 'content-type': 'text/html' },
});

test('every rule belongs to exactly one module page', () => {
  const owned = MODULES.flatMap((m) => m.checks);
  for (const r of RULES) assert.equal(owned.filter((id) => id === r.id).length, 1, r.id);
});

test('html export escapes content and includes every module', () => {
  const html = toHtml(report);
  assert.ok(!html.includes('<script>alert'));
  for (const m of MODULES) assert.ok(html.includes(m.label.replace('&', '&amp;')), m.label);
});

test('csv quotes commas; markdown has score', () => {
  assert.match(toCsv(report), /"[^"\n]*title, with comma[^"\n]*"/);
  assert.match(toMarkdown(report), /# SEO audit report[\s\S]*https:\/\/example.com\//);
});

import { toJson, toIssuesCsv, toScoresCsv, filenameBase, EXPORT_SCHEMA } from '../lib/report-export.js';

test('CSV is Excel-safe: BOM, CRLF, quoted commas, formula-injection guarded', () => {
  const r = JSON.parse(JSON.stringify(report));
  r.checks[0].evidence = "=cmd|' /C calc'!A0";
  r.checks[1].evidence = 'hello, "world"';
  const out = toCsv(r);
  assert.ok(out.startsWith('﻿module,section,check'));
  assert.ok(out.includes('\r\n'));
  assert.ok(!/(^|,)=cmd/m.test(out)); // formula neutralised with a leading apostrophe
  assert.ok(out.includes("'=cmd"));
  assert.ok(out.includes('"hello, ""world"""'));
});

test('JSON export has a schema envelope; other CSVs parse as rows', () => {
  const j = JSON.parse(toJson(report));
  assert.equal(j.schema, EXPORT_SCHEMA.name);
  assert.equal(j.schemaVersion, EXPORT_SCHEMA.version);
  assert.equal(j.report.url, report.url);
  assert.ok(toIssuesCsv(report).split('\r\n')[0].includes('recommendation'));
  assert.ok(toScoresCsv(report).includes('overall'));
});

test('filename is host + date and filesystem safe', () => {
  assert.match(filenameBase(report), /^seo-report-example\.com-\d{4}-\d{2}-\d{2}$/);
});

test('HTML report is complete and self-contained', () => {
  const html = toHtml(report);
  for (const part of ['Score by section', 'Priority recommendations', 'Page data', 'Not evaluated', '@page']) assert.ok(html.includes(part), part);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/(href|src)=["']https?:/i.test(html)); // no external assets
});
