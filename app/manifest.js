import { SITE } from '@/lib/site';

export default function manifest() {
  return {
    name: SITE.name,
    short_name: 'SEO Intel',
    description: SITE.tagline,
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f6fa',
    theme_color: '#142c43',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
