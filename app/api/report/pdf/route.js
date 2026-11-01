import { NextResponse } from 'next/server';
import { filenameBase } from '@/lib/report-export';
import { generateReportPdf } from '@/lib/pdf-generator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 2000) hits.clear();
  return recent.length > 10;
}

const fail = (status, code, message) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } });

/** POST { report } → application/pdf. The HTML is generated here from the report data (escaped). */
export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  if (limited(ip)) return fail(429, 'rate_limited', 'Too many PDF requests. Please wait a minute.');
  if (Number(request.headers.get('content-length') || 0) > MAX_BYTES) return fail(413, 'too_large', 'Report is too large.');
  let report;
  try {
    ({ report } = await request.json());
  } catch {
    return fail(400, 'bad_request', 'Body must be JSON: { "report": … }.');
  }
  if (!report || typeof report.url !== 'string' || !Array.isArray(report.checks) || !report.coverage || !report.scoring) {
    return fail(400, 'bad_report', 'That does not look like an SEO Audit Analyzer report.');
  }

  try {
    const pdf = await generateReportPdf(report);
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameBase(report)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return fail(err.code === 'busy' ? 503 : 500, err.code || 'pdf_failed', err.message || 'PDF generation failed.');
  }
}
