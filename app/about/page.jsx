import Link from 'next/link';
import DocPage from '@/components/doc-page';

export const metadata = {
  title: 'About us',
  description: 'Why SEO Audit Analyzer exists: transparent, evidence-backed SEO audits with an honest account of what is and is not measured.',
  alternates: { canonical: '/about' },
};

export default function About() {
  return (
    <DocPage eyebrow="Company" title="About SEO Audit Analyzer"
      intro="We build SEO audits you can check for yourself — every finding shows what was inspected, the evidence found and why it matters.">
      <h2>Why we built it</h2>
      <p>
        Most SEO tools hand you a single number and a long list of warnings. It is hard to tell which
        findings are real, which are guesses, and what the number even means. SEO Audit Analyzer is built
        around the opposite idea: show the work.
      </p>
      <h2>What we believe</h2>
      <ul>
        <li><b>Evidence over opinion.</b> Each check displays the exact value it found on your page.</li>
        <li><b>Honest scoring.</b> The score comes from a published rubric. It is not a Google ranking score and never promises rankings.</li>
        <li><b>Clear limits.</b> Anything we did not measure — performance, JavaScript-rendered content, backlinks — is listed as not evaluated rather than guessed.</li>
        <li><b>Safe by design.</b> Pages are fetched with strict network safeguards so the tool cannot be pointed at private systems.</li>
      </ul>
      <h2>What it does today</h2>
      <p>
        A live single-page audit across on-page, indexing, social, content, rendering and technical signals, plus
        performance, broken links, a site crawl, keywords, security and traffic. Each has its own page, and the whole
        report downloads as PDF, HTML, Markdown, CSV or JSON. Backlink counts and search volumes need paid data and are not included.
      </p>
      <p><Link href="/">Run an audit</Link> or <Link href="/contact">get in touch</Link>.</p>
    </DocPage>
  );
}
