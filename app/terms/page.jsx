import DocPage from '@/components/doc-page';

export const metadata = {
  title: 'Terms of use',
  description: 'The terms for using SEO Audit Analyzer.',
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return (
    <DocPage eyebrow="Legal" title="Terms of use" updated="14 October 2026"
      intro="By using SEO Audit Analyzer you agree to these terms.">
      <h2>Acceptable use</h2>
      <ul>
        <li>Only analyse pages you own or are permitted to test.</li>
        <li>Do not attempt to reach private or internal systems, overload the service, or bypass its rate limits.</li>
        <li>Automated or bulk use requires prior agreement.</li>
      </ul>
      <h2>No guarantees</h2>
      <p>
        Results are produced from a documented rubric using the HTML returned to our server at the moment of
        the request. They are informational, may differ from other tools or from what search engines see, and
        are not a prediction or guarantee of search rankings, traffic or indexing.
      </p>
      <h2>Availability</h2>
      <p>The service is provided as is and may change, be rate limited or be unavailable at times.</p>
      <h2>Liability</h2>
      <p>To the extent permitted by law, we are not liable for decisions made or losses arising from use of the reports.</p>
      <h2>Changes</h2>
      <p>We may update these terms; the date above shows the latest revision.</p>
    </DocPage>
  );
}
