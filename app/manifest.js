import { SITE } from '@/lib/site';

export default function manifest() {
  return {
    name: SITE.name,
    short_name: 'SEO Intel',
    description: SITE.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: '#f1eee5',
    theme_color: '#d95732',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
