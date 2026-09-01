# BeingTechy — blog template

A two-page tech blog template (`index.html` list + `post.html` article view), wired for Supabase and AdSense. No build step — open the files directly or host them as static files.

## Files

| File | Purpose |
|---|---|
| `index.html` | Homepage — hero, category filters, post grid, newsletter strip |
| `post.html` | Single article view — fetched by `?slug=` from Supabase |
| `supabase-setup.sql` | Creates the `posts` table, security policies, and 3 sample posts |
| `ads.txt` | AdSense domain verification file — must sit at your site root |

Until Supabase is connected, both pages show **demo content** automatically so you can see the design working right away.

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

Want a real editor instead of the Table Editor? Point a small admin form or a tool like [Supabase Studio](https://supabase.com/docs) writes at the same table using your **service_role** key from a trusted backend — never put the service_role key in the frontend HTML.

## 3. AdSense — already wired in

Both pages already include:
- The verification meta tag: `<meta name="google-adsense-account" content="ca-pub-6780480728242580">`
- The AdSense loader script in `<head>`
- Three ad slots on the homepage (top banner, in-feed) and two in every article (below the header, mid-article) — each marked with a dashed border and "ADVERTISEMENT" label so they're clearly disclosed, which keeps things AdSense-policy-friendly.

**Before ads actually serve**, you need to:
1. Upload `ads.txt` to your domain root so it's reachable at `https://beingtechy.org/ads.txt` — it already contains your line: `google.com, pub-6780480728242580, DIRECT, f08c47fec0942fa0`.
2. In your AdSense account, create real ad units and swap the placeholder `data-ad-slot="0000000000"` etc. values in the HTML for your actual slot IDs.
3. Get the site approved in AdSense (Sites → Add site → beingtechy.org) — this can take a few days.

## 4. Deploy

Any static host works since there's no build step — Vercel, Netlify, GitHub Pages, Cloudflare Pages, or your own server. Just make sure:
- `ads.txt` is served from the domain root, not a subfolder
- Both `.html` files and `ads.txt` are uploaded together

## 5. Customize

- Colors, fonts, and the "signal dot" motif are all defined as CSS variables at the top of each `<style>` block — change once, applies everywhere.
- Category filter buttons are in `index.html` (`#filterBar`) — add a button with a matching `data-filter` value to add a new section.
- Newsletter form currently just shows an alert — wire it to insert into the `subscribers` table (SQL already created for you) or to your email provider's API.
