/**
 * Feature switches. The country filter (view as a visitor from…) is switched off: every analysis is
 * worldwide. Set NEXT_PUBLIC_COUNTRY_FILTER=on at build time to bring it back.
 */
export const COUNTRY_FILTER = process.env.NEXT_PUBLIC_COUNTRY_FILTER === 'on';
