import DocPage from '@/components/doc-page';

export const metadata = {
  title: 'Privacy policy',
  description: 'What SEO Audit Analyzer processes when you run an audit, and what it does not collect.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <DocPage eyebrow="Legal" title="Privacy policy" updated="14 October 2026"
      intro="SEO Audit Analyzer has no accounts and no advertising trackers. This page explains what is processed when you use it.">
      <h2>What we process</h2>
      <ul>
        <li><b>The URL you submit.</b> Our server fetches that public page to analyse it. The audit result is returned to your browser.</li>
        <li><b>Your IP address.</b> Used only for short-lived, in-memory rate limiting to prevent abuse. It is not written to a database.</li>
        <li><b>Server logs.</b> Standard operational logs (errors, request timing) may be kept by the hosting provider.</li>
      </ul>
      <h2>What stays in your browser</h2>
      <ul>
        <li>The current report is kept in <code>sessionStorage</code> so pages survive a refresh. It is cleared when you close the tab.</li>
        <li>Your light/dark choice is kept in <code>localStorage</code>.</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>No user accounts, no saved report history, no marketing cookies.</li>
        <li>No sale or sharing of submitted URLs or report contents.</li>
      </ul>
      <h2>Third parties</h2>
      <p>The site fetches page fonts from Google Fonts at build time and serves them from our own origin.</p>
      <h2>Contact</h2>
      <p>Privacy questions? Use the details on the contact page.</p>
    </DocPage>
  );
}
