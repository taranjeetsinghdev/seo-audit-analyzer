/** Resolve the server-only Google key from a Cloudflare binding or the Node environment. */
export function getGoogleApiKey(cloudflareEnv, nodeEnv = process.env) {
  const cloudflareKey = typeof cloudflareEnv?.GOOGLE_API_KEY === 'string'
    ? cloudflareEnv.GOOGLE_API_KEY.trim()
    : '';
  const nodeKey = typeof nodeEnv?.GOOGLE_API_KEY === 'string'
    ? nodeEnv.GOOGLE_API_KEY.trim()
    : '';

  return cloudflareKey || nodeKey;
}
