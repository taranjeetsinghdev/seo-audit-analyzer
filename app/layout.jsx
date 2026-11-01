import { Inter, JetBrains_Mono } from 'next/font/google';
import { SITE } from '@/lib/site';
import { ReportProvider } from '@/components/report-context';
import UiEffects from '@/components/ui-effects';
import Toaster from '@/components/toaster';
import BackgroundTasks from '@/components/background-tasks';
import AmbientBackground from '@/components/ambient-background';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jb', display: 'swap' });

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ['SEO audit', 'SEO analyzer', 'on-page SEO', 'meta tags checker', 'structured data', 'Open Graph', 'technical SEO'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: '/',
  },
  twitter: { card: 'summary_large_image', title: `${SITE.name} — ${SITE.tagline}`, description: SITE.description },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7f7' },
    { media: '(prefers-color-scheme: dark)', color: '#111819' },
  ],
};

// Applies a saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink">
        <AmbientBackground />
        <ReportProvider>
          {children}
          <BackgroundTasks />
        </ReportProvider>
        <UiEffects />
        <Toaster />
      </body>
    </html>
  );
}
