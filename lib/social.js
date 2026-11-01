/**
 * Pure, browser-safe helpers for the "Social profiles" module: recognise social-network URLs,
 * decide whether each one is a real profile link (not a share button, post or bare homepage),
 * and collect them from a report (page links plus JSON-LD `sameAs`).
 */

const seg = (u) => u.pathname.split('/').filter(Boolean);
const HANDLE = /^[A-Za-z0-9._-]{1,60}$/;

const RESERVED = {
  facebook: new Set(['sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'policies', 'help', 'privacy', 'legal', 'about', 'ads', 'business', 'watch', 'marketplace', 'gaming', 'events', 'hashtag', 'public']),
  instagram: new Set(['accounts', 'explore', 'direct', 'about', 'legal', 'developer', 'web', 'challenge', 'oauth']),
  x: new Set(['intent', 'share', 'home', 'i', 'search', 'hashtag', 'login', 'explore', 'settings', 'tos', 'privacy', 'messages', 'notifications', 'compose', 'signup', 'download']),
  pinterest: new Set(['pin', 'ideas', 'search', 'login', 'about', 'business', 'today', 'topics', 'video', 'news_hub']),
  github: new Set(['features', 'about', 'pricing', 'login', 'join', 'topics', 'explore', 'marketplace', 'sponsors', 'orgs', 'settings', 'search', 'collections', 'trending', 'readme', 'site', 'contact', 'security', 'customer-stories', 'enterprise']),
  twitch: new Set(['directory', 'downloads', 'jobs', 'turbo', 'store', 'p', 'login', 'signup', 'videos']),
  medium: new Set(['about', 'membership', 'plans', 'search', 'tag', 'topics']),
};

const profile = (handle, label) => ({ kind: 'profile', handle, label });
const content = (label) => ({ kind: 'content', label });
const share = (label) => ({ kind: 'share', label });
const generic = (label) => ({ kind: 'generic', label });
const bad = (label) => ({ kind: 'invalid', label });

/** Each platform: hosts it owns and a classifier for a parsed URL on those hosts. */
export const PLATFORMS = [
  {
    id: 'facebook', name: 'Facebook', color: '#1877f2', core: true,
    hosts: ['facebook.com', 'fb.com', 'fb.me'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Facebook homepage, not a page or profile');
      const first = s[0].toLowerCase();
      if (first === 'profile.php') return u.searchParams.get('id') ? profile(`id ${u.searchParams.get('id')}`) : bad('profile.php is missing its id');
      if (['sharer', 'sharer.php', 'share', 'share.php', 'dialog'].includes(first)) return share('Share-button link, not a page');
      if (RESERVED.facebook.has(first)) return generic('Facebook utility page, not a page or profile');
      if (['pages', 'people'].includes(first)) return s.length > 1 ? profile(s.slice(1, 2).join('')) : bad('Incomplete page URL');
      if (first === 'groups') return s[1] ? profile(`group ${s[1]}`) : bad('Incomplete group URL');
      if (s.includes('posts') || s.includes('videos') || s.includes('photos') || first === 'permalink.php') return content('Link to a post, not the page itself');
      return HANDLE.test(s[0]) ? profile(s[0]) : bad('Unusual page name');
    },
  },
  {
    id: 'instagram', name: 'Instagram', color: '#e1306c', core: true,
    hosts: ['instagram.com', 'instagr.am'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Instagram homepage, not a profile');
      const first = s[0].toLowerCase();
      if (['p', 'reel', 'reels', 'tv', 'stories'].includes(first)) return content('Link to a post or story, not the profile');
      if (RESERVED.instagram.has(first)) return generic('Instagram utility page, not a profile');
      return /^[A-Za-z0-9._]{1,30}$/.test(s[0]) ? profile(`@${s[0]}`) : bad('Not a valid Instagram username');
    },
  },
  {
    id: 'x', name: 'X (Twitter)', color: '#111111', core: true,
    hosts: ['twitter.com', 'x.com', 't.co'],
    classify(u) {
      const s = seg(u);
      if (u.hostname.replace(/^www\./, '') === 't.co') return generic('Shortened t.co link, cannot tell the target');
      if (!s.length) return generic('X homepage, not a profile');
      const first = s[0].toLowerCase();
      if (['intent', 'share'].includes(first)) return share('Tweet/share-button link, not a profile');
      if (RESERVED.x.has(first)) return generic('X utility page, not a profile');
      if (s[1] === 'status') return content('Link to a post, not the profile');
      return /^@?[A-Za-z0-9_]{1,15}$/.test(s[0]) ? profile(`@${s[0].replace(/^@/, '')}`) : bad('Not a valid X username');
    },
  },
  {
    id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', core: true,
    hosts: ['linkedin.com', 'lnkd.in'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('LinkedIn homepage, not a profile or page');
      const first = s[0].toLowerCase();
      if (['sharearticle', 'sharing', 'share', 'shareoffsite'].includes(first)) return share('Share-button link, not a profile');
      if (['company', 'in', 'school', 'showcase', 'pub'].includes(first)) return s[1] ? profile(`${first}/${s[1]}`) : bad(`Incomplete /${first}/ URL`);
      if (first === 'groups') return s[1] ? profile(`group ${s[1]}`) : bad('Incomplete group URL');
      if (['posts', 'feed', 'pulse', 'jobs', 'learning'].includes(first)) return content('Link to content, not the company or profile');
      return generic('Not a recognised LinkedIn profile/company URL');
    },
  },
  {
    id: 'youtube', name: 'YouTube', color: '#ff0033', core: true,
    hosts: ['youtube.com', 'youtu.be'],
    classify(u) {
      const s = seg(u);
      if (u.hostname.replace(/^www\./, '') === 'youtu.be') return content('Link to a single video, not the channel');
      if (!s.length) return generic('YouTube homepage, not a channel');
      const first = s[0].toLowerCase();
      if (first.startsWith('@')) return /^@[\w.-]{3,30}$/.test(s[0]) ? profile(s[0]) : bad('Not a valid YouTube handle');
      if (['channel', 'c', 'user'].includes(first)) return s[1] ? profile(`${first}/${s[1]}`) : bad(`Incomplete /${first}/ URL`);
      if (['watch', 'embed', 'shorts', 'live', 'playlist', 'results'].includes(first)) return content('Link to a video/playlist, not the channel');
      return generic('Not a recognised YouTube channel URL');
    },
  },
  {
    id: 'tiktok', name: 'TikTok', color: '#25f4ee', core: false, hosts: ['tiktok.com'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('TikTok homepage, not a profile');
      if (s[0].startsWith('@')) return s[1] === 'video' ? content('Link to a video, not the profile') : profile(s[0]);
      return generic('Not a TikTok profile URL (should look like /@name)');
    },
  },
  {
    id: 'pinterest', name: 'Pinterest', color: '#e60023', core: false, hosts: ['pinterest.com', 'pin.it'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Pinterest homepage, not a profile');
      if (u.hostname.endsWith('pin.it') || s[0] === 'pin') return content('Link to a pin, not the profile');
      if (RESERVED.pinterest.has(s[0].toLowerCase())) return generic('Pinterest utility page, not a profile');
      return profile(s[0]);
    },
  },
  {
    id: 'threads', name: 'Threads', color: '#000000', core: false, hosts: ['threads.net', 'threads.com'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Threads homepage, not a profile');
      return s[0].startsWith('@') ? (s[1] === 'post' ? content('Link to a post, not the profile') : profile(s[0])) : generic('Not a Threads profile URL (should look like /@name)');
    },
  },
  {
    id: 'github', name: 'GitHub', color: '#8b949e', core: false, hosts: ['github.com'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('GitHub homepage, not a profile');
      if (RESERVED.github.has(s[0].toLowerCase())) return generic('GitHub utility page, not a profile');
      return s.length > 1 ? content('Link to a repository, not the account') : profile(s[0]);
    },
  },
  {
    id: 'telegram', name: 'Telegram', color: '#26a5e4', core: false, hosts: ['t.me', 'telegram.me'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Telegram homepage, not a channel');
      if (s[0] === 'share') return share('Share-button link, not a channel');
      return profile(s[0].startsWith('+') || s[0] === 'joinchat' ? 'invite link' : `@${s[0]}`);
    },
  },
  {
    id: 'whatsapp', name: 'WhatsApp', color: '#25d366', core: false, hosts: ['wa.me', 'whatsapp.com', 'api.whatsapp.com'],
    classify(u) {
      const s = seg(u);
      if (u.hostname.includes('whatsapp.com') && !s.length) return generic('WhatsApp homepage, not a chat link');
      if (u.hostname === 'wa.me' && /^\d{6,15}$/.test(s[0] || '')) return profile(`+${s[0]}`);
      if (u.hostname === 'wa.me' && !s.length) return generic('wa.me without a phone number');
      if (u.hostname === 'wa.me' && s[0] === 'message') return profile('business chat');
      if (u.pathname.startsWith('/send') || u.pathname.startsWith('/channel')) return u.searchParams.get('phone') || s[0] === 'channel' ? profile('chat/channel link') : bad('send link without phone number');
      return generic('Not a recognised WhatsApp chat link');
    },
  },
  {
    id: 'reddit', name: 'Reddit', color: '#ff4500', core: false, hosts: ['reddit.com', 'redd.it'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Reddit homepage, not a community');
      if (['r', 'user', 'u'].includes(s[0].toLowerCase())) return s[1] ? (s[2] === 'comments' ? content('Link to a thread, not the community') : profile(`${s[0].toLowerCase()}/${s[1]}`)) : bad('Incomplete URL');
      return generic('Not a Reddit community/user URL');
    },
  },
  {
    id: 'snapchat', name: 'Snapchat', color: '#fffc00', core: false, hosts: ['snapchat.com'],
    classify(u) {
      const s = seg(u);
      if (['add', 'discover'].includes(s[0] || '') && s[1]) return profile(s[1]);
      return generic('Not a Snapchat profile URL (should look like /add/name)');
    },
  },
  {
    id: 'discord', name: 'Discord', color: '#5865f2', core: false, hosts: ['discord.gg', 'discord.com'],
    classify(u) {
      const s = seg(u);
      if (u.hostname === 'discord.gg') return s[0] ? profile('invite link') : generic('Discord homepage');
      return s[0] === 'invite' && s[1] ? profile('invite link') : generic('Not a Discord invite URL');
    },
  },
  {
    id: 'twitch', name: 'Twitch', color: '#9146ff', core: false, hosts: ['twitch.tv'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Twitch homepage, not a channel');
      if (RESERVED.twitch.has(s[0].toLowerCase())) return generic('Twitch utility page, not a channel');
      return profile(s[0]);
    },
  },
  {
    id: 'medium', name: 'Medium', color: '#12100e', core: false, hosts: ['medium.com'],
    classify(u) {
      const s = seg(u);
      if (!s.length) return generic('Medium homepage, not a publication');
      if (RESERVED.medium.has(s[0].toLowerCase())) return generic('Medium utility page');
      return s.length > 1 && !s[0].startsWith('@') ? content('Link to a story or sub-page') : profile(s[0]);
    },
  },
];

export const CORE_PLATFORMS = PLATFORMS.filter((p) => p.core);

const bare = (host) => host.toLowerCase().replace(/^(www|m|mobile|web|en-gb|[a-z]{2}-[a-z]{2})\./, '');

export function platformOf(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = bare(u.hostname);
  return PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`))) || null;
}

/** Classify one URL on a known platform. */
export function inspectUrl(url, platform = platformOf(url)) {
  if (!platform) return null;
  const u = new URL(url);
  return { platform: platform.id, ...platform.classify(u) };
}

function sameAsUrls(report) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
  };
  for (const item of report.structuredData?.items || []) walk(item.data?.sameAs);
  return out;
}

const normalise = (href) => {
  try {
    const u = new URL(href);
    u.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'igshid', 'fbclid'].forEach((k) => u.searchParams.delete(k));
    return u.href.replace(/\/$/, '');
  } catch {
    return null;
  }
};

/** Every social-network URL on the page, de-duplicated and classified. */
export function collectSocial(report) {
  const seen = new Map();
  const add = (href, source, text) => {
    const clean = normalise(href);
    if (!clean) return;
    const platform = platformOf(clean);
    if (!platform) return;
    if (seen.has(clean)) {
      const prev = seen.get(clean);
      if (!prev.sources.includes(source)) prev.sources.push(source);
      return;
    }
    seen.set(clean, { url: clean, text: (text || '').slice(0, 80), sources: [source], ...inspectUrl(clean, platform) });
  };
  for (const l of report.links?.items || []) add(l.href, 'page link', l.text);
  for (const h of sameAsUrls(report)) add(h, 'schema sameAs');
  return [...seen.values()];
}

/** Per-platform summary rows: core networks always listed, extras only when linked. */
export function groupByPlatform(found) {
  return PLATFORMS.map((p) => {
    const items = found.filter((f) => f.platform === p.id);
    return { platform: p, items, profiles: items.filter((i) => i.kind === 'profile') };
  }).filter((g) => g.platform.core || g.items.length);
}
