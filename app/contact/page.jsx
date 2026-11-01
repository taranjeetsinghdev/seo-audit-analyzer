import DocPage from '@/components/doc-page';
import { SITE } from '@/lib/site';

export const metadata = {
  title: 'Contact',
  description: 'Get in touch about SEO Audit Analyzer: feedback, bug reports and partnership questions.',
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return (
    <DocPage eyebrow="Company" title="Contact us" intro="Feedback, bug reports, or questions about a report — we read everything.">
      {SITE.contactEmail ? (
        <p>
          Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
        </p>
      ) : (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-muted">
          No contact address is configured yet. Set <code>NEXT_PUBLIC_CONTACT_EMAIL</code> to show it here.
        </p>
      )}
      <h2>When reporting an issue</h2>
      <ul>
        <li>Include the URL you analysed and the time you ran it.</li>
        <li>Say which module page looked wrong and what you expected to see.</li>
        <li>Attach the downloaded JSON report if you can — it contains every value the check used.</li>
      </ul>
    </DocPage>
  );
}
