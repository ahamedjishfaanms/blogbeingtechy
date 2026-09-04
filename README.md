# BeingTechy — blog template

A tech blog wired for Supabase and AdSense: `index.html` (list), `post.html` (live/preview article view), and pre-rendered pages under `posts/` that are what actually get indexed and shared.

## Why `posts/` exists

`post.html?slug=...` renders everything client-side after fetching from Supabase — great for instant previews, bad for SEO and AdSense review, because the raw HTML any crawler (or non-JS tool) sees is just a "Loading article…" shell with a generic, identical title/description on every article. That reads as duplicate/thin content and is one of the most common reasons AdSense applications get rejected.

`scripts/build-posts.mjs` fixes this by generating one real, pre-rendered HTML file per published post (`posts/<slug>.html`) with the actual headline, byline, body text, canonical URL, Open Graph tags, and `Article` structured data baked in — no JavaScript required to read it. `post.html?slug=...` still works (handy for previewing a post right after writing it, before the next rebuild), but its canonical tag and all share links now point at the pre-rendered `posts/<slug>.html` version, so Google only ever indexes one, real, unique page per article.

A GitHub Action (`.github/workflows/build-posts.yml`) runs this script automatically every 3 hours and after any push that touches the script, and commits the regenerated `posts/*.html` + `sitemap.xml` back to `main`. You can also trigger it on demand from the **Actions** tab → **Rebuild article pages** → **Run workflow** — do that right after publishing something if you don't want to wait.

## Files

| File | Purpose |
|---|---|
| `index.html` | Homepage — hero, category filters, post grid, newsletter strip. Links to `posts/<slug>.html`. |
| `post.html` | Live article view fetched by `?slug=` from Supabase — used for instant previews; not what's indexed. |
| `posts/*.html` | **Generated.** One pre-rendered, crawlable page per published post. Don't hand-edit — edit the post in Supabase (via `admin.html`) and rebuild. |
| `scripts/build-posts.mjs` | Generates everything in `posts/` and regenerates `sitemap.xml` from the live `posts` table in Supabase. Run with `node scripts/build-posts.mjs`. |
| `.github/workflows/build-posts.yml` | Runs the script above on a schedule / on demand and commits the result. |
| `supabase-setup.sql` | Creates the `posts` table, security policies, and 3 sample posts |
| `ads.txt` | AdSense domain verification file — must sit at your site root (`https://yourdomain.com/ads.txt`, not renamed) |
| `robots.txt` | Allows crawlers, blocks `/admin.html`, points to `sitemap.xml` |
| `sitemap.xml` | **Generated** by `scripts/build-posts.mjs` — lists every static page plus every `posts/<slug>.html` URL with a real `lastmod`. Don't hand-edit; it gets overwritten on the next rebuild. |
| `terms.html` | Terms of Service — linked from every page footer alongside About/Contact/Privacy. |

Until Supabase is connected, `index.html`/`post.html` show **demo content** automatically so you can see the design working right away.

## 1. Connect Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In your new project, go to **SQL Editor → New query**, paste the contents of `supabase-setup.sql`, and run it. This creates the `posts` table, locks it down with Row Level Security, and adds 3 sample posts.
3. Go to **Project Settings → API**. Copy your **Project URL** and **anon public key**.
4. In **both** `index.html` and `post.html`, find this block near the bottom of the `<script>` tag and fill it in:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';
```

5. Reload `index.html` — you should see the 3 sample posts instead of the demo placeholders.

The anon key is meant to be public; it can only do what the RLS policies in `supabase-setup.sql` allow (read published posts, insert into `subscribers`). Nothing else.

## 2. Add your own posts

Easiest way: **Supabase Dashboard → Table Editor → posts → Insert row.**

Fields that matter:
- `title`, `slug` (URL-safe, unique — e.g. `my-first-post`), `excerpt`
- `content` — HTML. Paragraphs as `<p>`, headings as `<h2>`/`<h3>`, code as `<pre><code>`.
- `category` — one of `ai`, `hardware`, `dev`, `security` (or add your own and update the filter buttons in `index.html`)
- `cover_image` — a public image URL (Supabase Storage, or any hosted image)
- `published` — must be `true` to appear on the site

Want a real editor instead of the Table Editor? Point a small admin form or a tool like [Supabase Studio](https://supabase.com/docs) writes at the same table using your **service_role** key from a trusted backend — never put the service_role key in the frontend HTML. (`admin.html` in this repo is exactly that admin form.)

After publishing (or editing) a post, either wait for the next scheduled run of **Rebuild article pages** (every 3 hours) or trigger it manually from the **Actions** tab so `posts/<new-slug>.html` and `sitemap.xml` exist before you tell anyone about it / resubmit to AdSense.

## 3. AdSense — already wired in

Both pages already include:
- The verification meta tag: `<meta name="google-adsense-account" content="ca-pub-6780480728242580">`
- The AdSense loader script in `<head>`
- Three ad slots on the homepage (top banner, in-feed) and two in every article (below the header, mid-article) — each marked with a dashed border and "ADVERTISEMENT" label so they're clearly disclosed, which keeps things AdSense-policy-friendly.

**Before ads actually serve**, you need to:
1. Upload `ads.txt` to your domain root so it's reachable at `https://beingtechy.org/ads.txt` — it already contains your line: `google.com, pub-6780480728242580, DIRECT, f08c47fec0942fa0`. (Double-check after every deploy — some hosts have served this as `ads_1.txt` or under a subfolder in the past, which AdSense will not recognize.)
2. In your AdSense account, create real ad units and swap the placeholder `data-ad-slot="0000000000"` etc. values in the HTML for your actual slot IDs.
3. Get the site approved in AdSense (Sites → Add site → beingtechy.org) — this can take a few days.

### If AdSense rejects the site for "Low value content"

Check `posts/` exists and is up to date first — if a reviewer's crawler can't see real article text (see "Why `posts/` exists" above), everything else on this list is moot. Beyond that, it means the reviewer (human or automated) judged the actual articles too thin, generic, or unoriginal. Before resubmitting:
- Aim for 20-30+ published posts, each 600+ words, with specific facts, named sources, and a point of view — not a one-paragraph rehash of a headline.
- Link out to the primary source you're reporting on (official announcement, original outlet). Uncited "news" reads as scraped content to both readers and Google.
- Keep every post inside the site's stated focus (AI, hardware, dev, security). Off-topic posts (gaming, unrelated lifestyle news) dilute the site's topical authority.
- Use a consistent author name per post (e.g. "BeingTechy Staff" or a real byline) — avoid placeholder-looking values like "ADMIN" or "STAFF" in all caps.
- Keep `sitemap.xml` current so every published post is discoverable, and give it a week or two of consistent publishing before requesting another review.

## 4. Deploy

Any static host works — Vercel, Netlify, GitHub Pages, Cloudflare Pages, or your own server — as long as it serves whatever's on `main` (or wherever it deploys from). The GitHub Action commits straight to `main`, so as long as your host auto-deploys from that branch (GitHub Pages does by default; Netlify/Vercel need "Deploy on push" pointed at `main`), new posts go live on their own after a rebuild. Just make sure:
- `ads.txt` is served from the domain root, not a subfolder
- The `posts/` folder gets uploaded/deployed along with everything else — it's what carries the actual article pages
- `www` vs. non-`www` (and `http` vs `https`) resolves to a single version of the domain — every page here canonicalizes to `https://www.beingtechy.org/...`, so make sure your host/DNS 301-redirects the other variants there instead of serving duplicate copies

## 5. Customize

- Colors, fonts, and the "signal dot" motif are all defined as CSS variables at the top of each `<style>` block — change once, applies everywhere.
- Category filter buttons are in `index.html` (`#filterBar`) — add a button with a matching `data-filter` value to add a new section.
- Newsletter form currently just shows an alert — wire it to insert into the `subscribers` table (SQL already created for you) or to your email provider's API.
