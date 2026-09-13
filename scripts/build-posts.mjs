#!/usr/bin/env node
/**
 * build-posts.mjs
 * ============================================================
 * Generates one pre-rendered, crawlable HTML page per published post
 * (posts/<slug>.html) and a fresh sitemap.xml, both read straight from
 * Supabase. Run this any time posts change in admin.html, or let the
 * "Rebuild article pages" GitHub Action run it for you.
 *
 * Why this exists: post.html?slug=... renders everything client-side,
 * so a crawler (or anyone/anything that doesn't run JavaScript) sees an
 * empty "Loading article…" shell with a generic title on every article.
 * That reads as duplicate/thin content and is a common reason AdSense
 * applications get rejected. These generated pages ship the real
 * headline, byline, and body text in the first HTTP response instead.
 *
 * Usage:
 *   node scripts/build-posts.mjs
 *
 * Env vars (both optional — fall back to the same public values already
 * used in index.html/post.html; the anon key is safe to expose, it can
 * only read rows the "Public can read published posts" RLS policy allows):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 * ============================================================
 */

import { readdir, mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'posts');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SITE_URL = 'https://www.beingtechy.org';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://exymxyranahspqddgevv.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4eW14eXJhbmFoc3BxZGRnZXZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDg0NzYsImV4cCI6MjA5OTYyNDQ3Nn0.z4G7IolUNms8Nc2m8lY7ETeAxyInSmGDlp5uB8vG4nQ';

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/\n/g, ' ');
}

function timeAgoLabel(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function fetchPublishedPosts() {
  const url = `${SUPABASE_URL}/rest/v1/posts?select=*&published=eq.true&order=created_at.desc`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetch failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function relatedPostsFor(post, allPosts) {
  return allPosts
    .filter((p) => p.slug !== post.slug)
    .sort((a, b) => {
      const aSame = a.category === post.category ? 1 : 0;
      const bSame = b.category === post.category ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame; // same-category posts first
      return new Date(b.created_at) - new Date(a.created_at);
    })
    .slice(0, 3);
}

function renderPostPage(post, related) {
  const title = escapeHtml(post.title);
  const fullTitle = `${title} — BeingTechy`;
  const desc = escapeAttr(post.excerpt || `${post.title} — coverage from BeingTechy.`);
  const canonicalUrl = `${SITE_URL}/posts/${encodeURIComponent(post.slug)}.html`;
  const author = escapeHtml(post.author || 'BeingTechy Staff');
  const category = escapeHtml(post.category || 'general');
  const published = timeAgoLabel(post.created_at);
  const readTime = post.read_time ? `${post.read_time} min read` : '';
  const cover = post.cover_image ? escapeAttr(post.cover_image) : '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || '',
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    author: { '@type': 'Person', name: post.author || 'BeingTechy Staff' },
    publisher: { '@type': 'Organization', name: 'BeingTechy', url: `${SITE_URL}/` },
  };
  if (post.cover_image) schema.image = post.cover_image;

  const shareUrl = encodeURIComponent(canonicalUrl);
  const shareText = encodeURIComponent(post.title);

  const shareRow = (variant) => `
    <div class="share-row ${variant === 'bottom' ? 'bottom' : ''}">
      <span class="share-label">Share</span>
      <a class="share-btn" href="https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareText}" target="_blank" rel="noopener" aria-label="Share on X">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L1 2h7.2l5 6.6L18.9 2zm-1.2 18h1.7L7.4 4H5.6l12.1 16z"/></svg>
      </a>
      <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}" target="_blank" rel="noopener" aria-label="Share on LinkedIn">
        <svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="9" width="4" height="11"/><circle cx="5" cy="4.5" r="1.5"/><path d="M11 20v-7a3 3 0 0 1 6 0v7M11 9v11"/></svg>
      </a>
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${shareUrl}" target="_blank" rel="noopener" aria-label="Share on Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.7V3.2c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.4V13H10v8h3.5z"/></svg>
      </a>
      <a class="share-btn" href="https://wa.me/?text=${shareText}%20${shareUrl}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8 1-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.2-.2 0-.4.1-.5l.4-.5c.1-.1.2-.3.2-.4.1-.2 0-.3 0-.4-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 4 3.4.6.2 1 .4 1.3.5.6.2 1.1.1 1.5.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.4-.3z"/></svg>
      </a>
      <button class="share-btn" type="button" data-copy="${escapeAttr(canonicalUrl)}" aria-label="Copy link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5"/></svg>
        <span class="copied-tip">Copied!</span>
      </button>
    </div>`;

  const relatedHtml = related.length
    ? related.map((r) => `
        <a class="related-item" href="${encodeURIComponent(r.slug)}.html">
          <div class="rtitle">${escapeHtml(r.title)}</div>
          <div class="rmeta">${escapeHtml(r.category || 'general')} · ${timeAgoLabel(r.created_at)}</div>
        </a>`).join('')
    : '<p style="color:var(--text-muted); font-size:14px;">No other posts yet.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<script>(function(){try{if(localStorage.getItem('bt-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();</script>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${fullTitle}</title>
<meta name="description" content="${desc}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonicalUrl}">

<meta property="og:type" content="article">
<meta property="og:site_name" content="BeingTechy">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonicalUrl}">
${cover ? `<meta property="og:image" content="${cover}">\n` : ''}<meta name="twitter:card" content="${cover ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${fullTitle}">
<meta name="twitter:description" content="${desc}">

<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>

<meta name="google-adsense-account" content="ca-pub-6780480728242580">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6780480728242580" crossorigin="anonymous"></script>

<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%2314171C'/%3E%3Ccircle cx='32' cy='32' r='7' fill='%23E8A33D'/%3E%3Ccircle cx='32' cy='32' r='16' fill='none' stroke='%234FB0C6' stroke-width='3' stroke-dasharray='4 6'/%3E%3C/svg%3E">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

<style>
  :root{
    --bg:#14171C; --surface:#1B1F26; --surface-2:#20252D; --line:#2B313B;
    --text:#EDEAE2; --text-muted:#8B92A0; --accent:#E8A33D; --signal:#4FB0C6;
    --radius:4px; --max:1180px; --article-max:700px;
    --font-display:'Fraunces', Georgia, serif;
    --font-body:'Inter', -apple-system, sans-serif;
    --font-mono:'JetBrains Mono', ui-monospace, monospace;
  }
  *{box-sizing:border-box; margin:0; padding:0;}
  body{ background:var(--bg); color:var(--text); font-family:var(--font-body); line-height:1.6; }
  a{ color:inherit; text-decoration:none; }
  img{ max-width:100%; display:block; }
  .wrap{ max-width:var(--max); margin:0 auto; padding:0 28px; }
  .dot{ display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--signal); }
  .dot.pulse{ animation:pulse 2.2s ease-in-out infinite; }
  @keyframes pulse{ 0%,100%{box-shadow:0 0 0 0 rgba(79,176,198,.55);} 50%{box-shadow:0 0 0 5px rgba(79,176,198,0);} }
  header{ position:sticky; top:0; z-index:40; background:rgba(20,23,28,.86); backdrop-filter:blur(10px); border-bottom:1px solid var(--line); }
  .nav{ display:flex; align-items:center; justify-content:space-between; padding:18px 0; }
  .logo{ font-family:var(--font-mono); font-weight:500; font-size:16px; display:flex; align-items:center; gap:8px; text-transform:lowercase; }
  .logo b{ color:var(--accent); font-weight:600; }
  .back{ font-family:var(--font-mono); font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.08em; }
  .back:hover{ color:var(--accent); }
  article{ max-width:var(--article-max); margin:0 auto; padding:56px 0 40px; }
  .meta{ font-family:var(--font-mono); font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; display:flex; align-items:center; gap:8px; margin-bottom:20px; }
  .meta .tag{ color:var(--accent); }
  h1{ font-family:var(--font-display); font-weight:500; font-size:clamp(30px,4.6vw,46px); line-height:1.1; letter-spacing:-.01em; margin-bottom:22px; }
  .byline{ display:flex; justify-content:space-between; align-items:center; padding:18px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); font-family:var(--font-mono); font-size:12.5px; color:var(--text-muted); margin-bottom:36px; }
  .cover{ width:100%; aspect-ratio:16/9; border-radius:var(--radius); overflow:hidden; background:var(--surface); border:1px solid var(--line); margin-bottom:36px; }
  .cover img{ width:100%; height:100%; object-fit:cover; }
  .share-row{ display:flex; align-items:center; gap:10px; margin:28px 0; flex-wrap:wrap; }
  .share-label{ font-family:var(--font-mono); font-size:11px; text-transform:uppercase; letter-spacing:.08em; color:var(--text-muted); margin-right:2px; }
  .share-btn{ width:34px; height:34px; border-radius:50%; border:1px solid var(--line); background:none; color:var(--text-muted); display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; flex:none; position:relative; }
  .share-btn:hover{ color:var(--accent); border-color:var(--accent); }
  .share-btn svg{ width:15px; height:15px; }
  .share-btn .copied-tip{ position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%); background:var(--text); color:var(--bg); font-family:var(--font-mono); font-size:11px; padding:5px 9px; border-radius:4px; white-space:nowrap; opacity:0; pointer-events:none; transition:opacity .15s ease; }
  .share-btn .copied-tip.show{ opacity:1; }
  .share-row.bottom{ padding-top:28px; border-top:1px solid var(--line); margin-top:8px; }
  .content{ font-size:17.5px; color:#D9D6CC; }
  .content p{ margin-bottom:22px; }
  .content h2{ font-family:var(--font-display); font-size:28px; font-weight:500; margin:40px 0 16px; color:var(--text); }
  .content h3{ font-family:var(--font-display); font-size:22px; font-weight:500; margin:32px 0 14px; color:var(--text); }
  .content a{ color:var(--signal); text-decoration:underline; text-underline-offset:3px; }
  .content code{ font-family:var(--font-mono); font-size:.9em; background:var(--surface-2); padding:2px 6px; border-radius:3px; }
  .content pre{ background:var(--surface-2); border:1px solid var(--line); border-radius:var(--radius); padding:18px; overflow-x:auto; margin:22px 0; }
  .content pre code{ background:none; padding:0; }
  .content blockquote{ border-left:3px solid var(--accent); padding-left:18px; color:var(--text-muted); margin:22px 0; font-style:italic; }
  .content ul, .content ol{ margin:0 0 22px 22px; }
  .content li{ margin-bottom:8px; }
  .ad-slot{ margin:36px 0; padding:14px; border:1px dashed var(--line); border-radius:var(--radius); text-align:center; }
  .ad-slot::before{ content:'ADVERTISEMENT'; display:block; font-family:var(--font-mono); font-size:10px; letter-spacing:.14em; color:var(--text-muted); margin-bottom:8px; }
  .tags{ display:flex; gap:8px; margin-top:36px; flex-wrap:wrap; }
  .tags a{ font-family:var(--font-mono); font-size:11.5px; padding:6px 12px; border:1px solid var(--line); border-radius:100px; color:var(--text-muted); }
  .tags a:hover{ color:var(--accent); border-color:var(--accent); }
  .related{ max-width:var(--article-max); margin:0 auto; padding:0 0 60px; }
  .related h4{ font-family:var(--font-mono); font-size:12px; text-transform:uppercase; letter-spacing:.1em; color:var(--text-muted); margin-bottom:18px; display:flex; align-items:center; gap:12px; }
  .related h4::after{ content:''; flex:1; height:1px; background:var(--line); }
  .related-item{ display:block; padding:16px 0; border-top:1px solid var(--line); }
  .related-item:last-child{ border-bottom:1px solid var(--line); }
  .related-item .rtitle{ font-family:var(--font-display); font-size:17px; margin-bottom:4px; }
  .related-item .rmeta{ font-family:var(--font-mono); font-size:11px; color:var(--text-muted); }
  footer{ padding:32px 0; border-top:1px solid var(--line); text-align:center; font-family:var(--font-mono); font-size:11px; color:var(--text-muted); }
  [data-theme="light"]{ --bg:#FFFFFF; --surface:#FAF8F3; --surface-2:#F3EFE5; --line:#ECE6D8; --text:#201C15; --text-muted:#756B58; --accent:#A6690F; --signal:#1D8DA6; }
</style>
</head>
<body>

<header>
  <div class="wrap nav">
    <div class="logo"><span class="dot pulse"></span>being<b>techy</b></div>
    <a class="back" href="../index.html">← All posts</a>
  </div>
</header>

<main id="main">
  <article>
    <div class="meta"><span class="tag">${category}</span><span>·</span><span>${published}</span></div>
    <h1>${title}</h1>
    <div class="byline">
      <span>By ${author}</span>
      <span>${readTime}</span>
    </div>
    ${shareRow()}
    ${cover ? `<div class="cover"><img src="${cover}" alt="${title}" width="1200" height="675" loading="eager"></div>` : ''}

    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-6780480728242580" data-ad-slot="0000000002" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>

    <div class="content">${post.content || `<p>${escapeHtml(post.excerpt || '')}</p>`}</div>

    ${shareRow('bottom')}

    <div class="ad-slot">
      <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-6780480728242580" data-ad-slot="0000000003" data-ad-format="auto" data-full-width-responsive="true"></ins>
    </div>

    ${post.tags && post.tags.length ? `<div class="tags">${post.tags.map((t) => `<a href="../index.html#grid">#${escapeHtml(t)}</a>`).join('')}</div>` : ''}
  </article>

  <div class="related">
    <h4>More from BeingTechy</h4>
    ${relatedHtml}
  </div>
</main>

<footer>
  <div class="wrap" style="display:flex; flex-direction:column; gap:8px; align-items:center;">
    <div>© <span id="year"></span> beingtechy.org</div>
    <div style="display:flex; gap:16px;">
      <a href="../about.html" style="color:var(--text-muted);">About</a>
      <a href="../contact.html" style="color:var(--text-muted);">Contact</a>
      <a href="../privacy.html" style="color:var(--text-muted);">Privacy Policy</a>
      <a href="../terms.html" style="color:var(--text-muted);">Terms of Service</a>
    </div>
  </div>
</footer>

<script>
document.getElementById('year').textContent = new Date().getFullYear();
try{ document.querySelectorAll('.adsbygoogle').forEach(() => (window.adsbygoogle = window.adsbygoogle || []).push({})); }catch(e){}

/* This static page is what Google indexes and what gets shared. It stays
   fully readable with JavaScript off. The two bits below are progressive
   enhancement only: dark/light theme (matches the rest of the site) and
   copy-link on the share row, plus a best-effort page-view log. */
(function(){
  document.querySelectorAll('.share-btn[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tip = btn.querySelector('.copied-tip');
      navigator.clipboard && navigator.clipboard.writeText(btn.getAttribute('data-copy')).then(function(){
        if (tip){ tip.classList.add('show'); setTimeout(function(){ tip.classList.remove('show'); }, 1600); }
      }).catch(function(){});
    });
  });
})();

(function(){
  var SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
  var SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};
  fetch(SUPABASE_URL + '/rest/v1/page_views', {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ path: 'post', slug: ${JSON.stringify(post.slug)} })
  }).catch(function(){});
})();
</script>

</body>
</html>
`;
}

function buildSitemap(posts) {
  const staticEntries = [
    { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${SITE_URL}/about.html`, changefreq: 'monthly', priority: '0.5' },
    { loc: `${SITE_URL}/contact.html`, changefreq: 'monthly', priority: '0.3' },
    { loc: `${SITE_URL}/privacy.html`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${SITE_URL}/terms.html`, changefreq: 'yearly', priority: '0.2' },
  ];

  const postEntries = posts.map((post) => {
    const lastmod = (post.updated_at || post.created_at || '').slice(0, 10);
    return {
      loc: `${SITE_URL}/posts/${encodeURIComponent(post.slug)}.html`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.7',
    };
  });

  const entries = [...staticEntries, ...postEntries];
  const body = entries.map((e) => `  <url>
    <loc>${e.loc}</loc>
${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/* ============================================================
 * HOMEPAGE (index.html) SERVER-SIDE RENDERING
 * ------------------------------------------------------------
 * index.html used to ship three "Loading headline text" skeleton
 * cards in its raw HTML and fill the real grid in with client-side
 * JS after a Supabase fetch. That's fine for a browser, but a
 * crawler (or the AdSense reviewer, or anyone with slow/blocked JS)
 * could hit the homepage and see nothing but placeholder text and
 * an empty carousel — which reads as thin/broken content.
 *
 * This mirrors the same fix already used for posts/<slug>.html:
 * render the real markup here, at build time, and splice it into
 * index.html between a pair of HTML comment markers. The existing
 * client-side script is untouched and still re-renders both blocks
 * on page load — that's what keeps filtering, the live carousel,
 * and "N minutes ago" freshness working. This just makes sure the
 * FIRST response already contains real content instead of a
 * loading skeleton.
 * ============================================================ */

function timeAgoRelative(dateStr, now) {
  const diffSeconds = (now.getTime() - new Date(dateStr).getTime()) / 1000;
  if (diffSeconds < 3600) return Math.max(1, Math.floor(diffSeconds / 60)) + 'm ago';
  if (diffSeconds < 86400) return Math.floor(diffSeconds / 3600) + 'h ago';
  if (diffSeconds < 604800) return Math.floor(diffSeconds / 86400) + 'd ago';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isRecentPost(dateStr, now) {
  return now.getTime() - new Date(dateStr).getTime() < 1000 * 60 * 60 * 24 * 3; // < 3 days
}

function renderIndexCard(post, now) {
  const title = escapeHtml(post.title);
  const excerpt = escapeHtml(post.excerpt || '');
  const category = escapeHtml(post.category || 'general');
  const author = escapeHtml(post.author || 'BeingTechy Staff');
  const cover = post.cover_image ? escapeAttr(post.cover_image) : '';
  return `
    <a class="card" href="posts/${encodeURIComponent(post.slug)}.html">
      <div class="thumb">
        ${cover ? `<img src="${cover}" alt="" loading="lazy">` : ''}
      </div>
      <div class="meta">
        ${isRecentPost(post.created_at, now) ? '<span class="dot pulse"></span>' : ''}
        <span class="tag">${category}</span>
        <span>·</span>
        <span>${timeAgoRelative(post.created_at, now)}</span>
      </div>
      <h3>${title}</h3>
      <p class="excerpt">${excerpt}</p>
      <div class="byline">
        <span>${author}</span>
        <span>${post.read_time ? post.read_time + ' min read' : ''}</span>
      </div>
    </a>`;
}

function renderIndexGrid(posts, now) {
  const inner = posts.length
    ? posts.map((post) => renderIndexCard(post, now)).join('\n')
    : `
      <div class="empty-state">
        <div class="dot pulse"></div>
        <h4>No posts yet</h4>
        <p>Once you add rows to the <b>posts</b> table in Supabase, they'll show up here automatically.</p>
        <code>insert into posts (title, slug, excerpt, category, published) values (...)</code>
      </div>`;
  return `<div class="grid" id="postGrid">${inner}\n    </div>`;
}

function renderFeatureSlide(post, index, isActive, now) {
  const title = escapeHtml(post.title);
  const category = escapeHtml(post.category || 'general');
  const cover = post.cover_image ? escapeAttr(post.cover_image) : '';
  return `
    <a class="fs-slide${isActive ? ' active' : ''}" href="posts/${encodeURIComponent(post.slug)}.html" data-index="${index}">
      <div class="fs-media">
        ${cover ? `<img src="${cover}" alt="" loading="${index === 0 ? 'eager' : 'lazy'}">` : `<div class="fs-placeholder"></div>`}
      </div>
      <div class="fs-overlay">
        <div class="fs-meta">
          <span class="fs-tag">${category}</span>
          <span>·</span>
          <span>${timeAgoRelative(post.created_at, now)}</span>
        </div>
        <h3 class="fs-headline">${title}</h3>
      </div>
    </a>`;
}

function renderFeatureSection(posts, now) {
  const fsPosts = posts.slice(0, 5);
  if (!fsPosts.length) {
    // Matches the client's renderFeatureSlider() behavior when there are no posts.
    return `<section class="feature-slider" id="featureSlider" aria-roledescription="carousel" aria-label="Featured stories" style="display:none;">
    <div class="fs-viewport" id="fsViewport">
      <span class="fs-counter" id="fsCounter" aria-live="polite">01 / 01</span>
    </div>
    <div class="fs-controls" id="fsControls">
      <button class="fs-arrow" id="fsPrev" type="button" aria-label="Previous story">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="fs-dots" id="fsDots"></div>
      <button class="fs-arrow" id="fsNext" type="button" aria-label="Next story">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  </section>`;
  }

  const slidesHtml = fsPosts.map((post, i) => renderFeatureSlide(post, i, i === 0, now)).join('\n');
  const dotsHtml = fsPosts.map((_, i) =>
    `<button class="fs-dot${i === 0 ? ' active' : ''}" data-index="${i}" type="button" aria-label="Go to story ${i + 1}"></button>`
  ).join('');
  const counter = '01 / ' + String(fsPosts.length).padStart(2, '0');
  const controlsStyle = fsPosts.length > 1 ? '' : ' style="display:none;"';

  return `<section class="feature-slider" id="featureSlider" aria-roledescription="carousel" aria-label="Featured stories">
    <div class="fs-viewport" id="fsViewport">
      <span class="fs-counter" id="fsCounter" aria-live="polite">${counter}</span>${slidesHtml}
    </div>
    <div class="fs-controls" id="fsControls"${controlsStyle}>
      <button class="fs-arrow" id="fsPrev" type="button" aria-label="Previous story">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="fs-dots" id="fsDots">${dotsHtml}</div>
      <button class="fs-arrow" id="fsNext" type="button" aria-label="Next story">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  </section>`;
}

function replaceBetweenMarkers(html, startMarker, endMarker, replacement) {
  const startIdx = html.indexOf(startMarker);
  const endIdx = html.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Could not find markers ${startMarker} / ${endMarker} in index.html — has the template changed?`);
  }
  const before = html.slice(0, startIdx + startMarker.length);
  const after = html.slice(endIdx);
  return `${before}\n${replacement}\n  ${after}`;
}

async function buildIndexHtml(posts) {
  const now = new Date();
  let html = await readFile(INDEX_PATH, 'utf8');

  html = replaceBetweenMarkers(
    html,
    '<!-- SSR:GRID:START -->',
    '<!-- SSR:GRID:END -->',
    renderIndexGrid(posts, now)
  );

  html = replaceBetweenMarkers(
    html,
    '<!-- SSR:FEATURE:START -->',
    '<!-- SSR:FEATURE:END -->',
    renderFeatureSection(posts, now)
  );

  await writeFile(INDEX_PATH, html, 'utf8');
  console.log(`Updated index.html with ${posts.length} server-rendered post card(s)`);
}

async function main() {
  console.log(`Fetching published posts from ${SUPABASE_URL} ...`);
  const posts = await fetchPublishedPosts();
  console.log(`Found ${posts.length} published post(s).`);

  await mkdir(POSTS_DIR, { recursive: true });

  const wantedFiles = new Set(posts.map((p) => `${p.slug}.html`));

  for (const post of posts) {
    const related = relatedPostsFor(post, posts);
    const html = renderPostPage(post, related);
    const filePath = path.join(POSTS_DIR, `${post.slug}.html`);
    await writeFile(filePath, html, 'utf8');
    console.log(`  wrote posts/${post.slug}.html`);
  }

  // Remove stale pages for posts that are no longer published (unpublished/deleted),
  // so we don't leave orphaned pages sitting around for Google to keep crawling.
  const existing = await readdir(POSTS_DIR).catch(() => []);
  for (const file of existing) {
    if (file.endsWith('.html') && !wantedFiles.has(file)) {
      await unlink(path.join(POSTS_DIR, file));
      console.log(`  removed stale posts/${file} (no longer published)`);
    }
  }

  const sitemap = buildSitemap(posts);
  await writeFile(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');
  console.log('Updated sitemap.xml');

  await buildIndexHtml(posts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
