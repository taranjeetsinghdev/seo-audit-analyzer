import { notFound } from 'next/navigation';
import ModulePage from '@/components/module-page';
import RecommendationsPage from '@/components/recommendations-panel';
import ExportPage from '@/components/export-page';
import PerformancePage from '@/components/performance-page';
import BrokenLinksPage from '@/components/broken-links-page';
import SiteCrawlPage from '@/components/site-crawl-page';
import TrafficPage from '@/components/traffic-page';
import SitemapPage from '@/components/sitemap-page';
import SecurityPage from '@/components/security-page';
import SocialProfilesPage from '@/components/social-profiles-page';
import AiAccessPage from '@/components/ai-access-page';
import KeywordsPage from '@/components/keywords-page';
import { ALL_SLUGS, MODULES } from '@/lib/modules';

export const dynamicParams = false;

export function generateStaticParams() {
  return ALL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const mod = MODULES.find((m) => m.slug === slug);
  return { title: mod ? mod.label : slug === 'export' ? 'Download report' : slug === 'performance' ? 'Performance' : slug === 'broken-links' ? 'Broken links' : slug === 'ai-access' ? 'AI & crawler access' : slug === 'social-profiles' ? 'Social profiles' : slug === 'site-crawl' ? 'Site-wide issues' : slug === 'sitemap' ? 'Sitemap & robots' : slug === 'security' ? 'Security & infrastructure' : slug === 'traffic' ? 'Traffic overview' : slug === 'keywords' ? 'Keywords overview' : 'Recommendations' };
}

export default async function Page({ params }) {
  const { slug } = await params;
  if (!ALL_SLUGS.includes(slug)) notFound();
  if (slug === 'recommendations') return <RecommendationsPage />;
  if (slug === 'export') return <ExportPage />;
  if (slug === 'performance') return <PerformancePage />;
  if (slug === 'broken-links') return <BrokenLinksPage />;
  if (slug === 'social-profiles') return <SocialProfilesPage />;
  if (slug === 'ai-access') return <AiAccessPage />;
  if (slug === 'site-crawl') return <SiteCrawlPage />;
  if (slug === 'sitemap') return <SitemapPage />;
  if (slug === 'security') return <SecurityPage />;
  if (slug === 'traffic') return <TrafficPage />;
  if (slug === 'keywords') return <KeywordsPage />;
  return <ModulePage slug={slug} />;
}
