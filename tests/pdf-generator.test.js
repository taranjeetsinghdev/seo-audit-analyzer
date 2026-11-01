import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReportPdf } from '../lib/pdf-generator.js';

test('generates a PDF report without a browser', async () => {
  const pdf = await generateReportPdf({
    url: 'https://example.com',
    score: 82,
    grade: 'B',
    statusCode: 200,
    generatedAt: '2026-10-23T00:00:00.000Z',
    coverage: { evaluated: 1, total: 1 },
    issues: [{ title: 'Missing description', severity: 'medium', impact: 'medium', confidence: 'high', recommendation: 'Add a description.' }],
    checks: [{ title: 'Page title exists', status: 'pass', weight: 6, evidence: 'Example page' }],
  });

  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), '%PDF-');
});
