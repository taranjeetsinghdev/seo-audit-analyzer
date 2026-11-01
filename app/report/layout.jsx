import ReportShell from '@/components/report-shell';

// Reports are per-session and private: keep them out of search indexes.
export const metadata = {
  title: { default: 'SEO report', template: '%s | SEO Audit Analyzer' },
  robots: { index: false, follow: false, nocache: true },
};

export default function ReportLayout({ children }) {
  return <ReportShell>{children}</ReportShell>;
}
