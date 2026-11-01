import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const ascii = (value) => String(value ?? '').replace(/[^\x20-\x7e]/g, '?');
const wrap = (value, limit = 92) => {
  const words = ascii(value).split(/\s+/).filter(Boolean).flatMap((word) => {
    if (word.length <= limit) return [word];
    return Array.from({ length: Math.ceil(word.length / limit) }, (_, index) => word.slice(index * limit, (index + 1) * limit));
  });
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
};

function reportLines(report) {
  const lines = [
    { text: 'SEO Audit Analyzer Report', heading: true },
    { text: `URL: ${report.url}` },
    { text: `Score: ${report.score ?? 'n/a'} / 100  |  Grade: ${report.grade || 'n/a'}` },
    { text: `HTTP status: ${report.statusCode ?? 'n/a'}  |  Generated: ${report.generatedAt || new Date().toISOString()}` },
    { text: `Checks evaluated: ${report.coverage?.evaluated ?? 'n/a'} of ${report.coverage?.total ?? report.checks.length}` },
    { text: '' },
    { text: 'Priority recommendations', heading: true },
  ];

  if (report.issues?.length) {
    report.issues.forEach((issue, index) => {
      lines.push({ text: `${index + 1}. ${issue.title} - ${issue.severity} (impact ${issue.impact}, confidence ${issue.confidence})` });
      if (issue.message) lines.push({ text: `   ${issue.message}` });
      if (issue.recommendation) lines.push({ text: `   Fix: ${issue.recommendation}` });
    });
  } else {
    lines.push({ text: 'No failed or warning findings.' });
  }

  lines.push({ text: '' }, { text: 'Audit checks', heading: true });
  for (const check of report.checks) {
    lines.push({ text: `${check.title}: ${check.status}${check.weight ? ` (${check.weight} points)` : ''}` });
    if (check.evidence) lines.push({ text: `   Evidence: ${check.evidence}` });
    if (check.recommendation) lines.push({ text: `   Recommendation: ${check.recommendation}` });
  }
  return lines.flatMap((line) => wrap(line.text).map((text, index) => ({ text, heading: line.heading && index === 0 })));
}

/** Generate a text-based PDF without requiring a browser or native runtime APIs. */
export async function generateReportPdf(report) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const pages = [];
  const margin = 48;
  const lineHeight = 13;
  let page;
  let y;

  const addPage = () => {
    page = document.addPage([595.28, 841.89]);
    pages.push(page);
    y = page.getHeight() - margin;
  };
  addPage();

  for (const line of reportLines(report)) {
    if (y < margin + lineHeight) addPage();
    const heading = line.heading;
    page.drawText(line.text, {
      x: margin,
      y,
      size: heading ? 13 : 9,
      font: heading ? bold : regular,
      color: heading ? rgb(0.08, 0.2, 0.35) : rgb(0.12, 0.15, 0.19),
    });
    y -= heading ? lineHeight + 4 : lineHeight;
  }

  pages.forEach((current, index) => {
    current.drawText(`Page ${index + 1} of ${pages.length}`, {
      x: current.getWidth() - margin - 80,
      y: 22,
      size: 8,
      font: regular,
      color: rgb(0.4, 0.43, 0.47),
    });
  });
  return document.save();
}
