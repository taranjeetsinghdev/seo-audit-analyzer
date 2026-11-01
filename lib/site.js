export const SITE = {
  name: 'SEO Audit Analyzer',
  tagline: 'Evidence-backed SEO audits',
  description:
    'Free single-page SEO audit. Check titles, meta descriptions, headings, canonical, robots, Open Graph, Twitter Cards, images, links and structured data — with a documented score, evidence for every finding and a downloadable report.',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
};
