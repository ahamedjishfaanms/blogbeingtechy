-- ============================================================
-- BeingTechy — Supabase setup script
-- Run this once in Supabase: Dashboard → SQL Editor → New query → Run
-- ============================================================

-- 1. Table: posts
create table if not exists posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text not null unique,
  excerpt       text,
  content       text,              -- HTML (or Markdown you render client-side)
  category      text default 'general',   -- ai | hardware | dev | security | general
  tags          text[] default '{}',
  author        text default 'BeingTechy Staff',
  cover_image   text,              -- URL to an image (e.g. Supabase Storage public URL)
  read_time     int default 3,     -- minutes
  published     boolean default false,
  created_at    timestamptz default now()
);

-- Keep slug lookups fast
create index if not exists posts_slug_idx on posts (slug);
create index if not exists posts_published_created_idx on posts (published, created_at desc);

-- 2. Row Level Security
-- The template's anon key is public-facing, so lock writes down and only
-- expose published posts to the public.
alter table posts enable row level security;

drop policy if exists "Public can read published posts" on posts;
create policy "Public can read published posts"
  on posts for select
  using (published = true);

-- No insert/update/delete policy is created for the anon role, so the
-- public key cannot write. Publish posts from the Supabase Table Editor,
-- or write them using your service_role key from a trusted server/script —
-- never expose the service_role key in frontend code.

-- 3. Optional: newsletter subscribers table (for the footer signup form)
create table if not exists subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz default now()
);

alter table subscribers enable row level security;

drop policy if exists "Public can subscribe" on subscribers;
create policy "Public can subscribe"
  on subscribers for insert
  with check (true);

-- No select policy — the public can add an email but not read the list back.

-- 4. Sample posts so the site isn't empty on first load
insert into posts (title, slug, excerpt, content, category, tags, author, read_time, published)
values
  (
    'Why edge inference is quietly eating the cloud',
    'edge-inference-eating-cloud',
    'Running models on-device is no longer a compromise — for a growing set of tasks, it''s the better default.',
    '<p>For years, "run it on the edge" meant accepting worse accuracy for lower latency. That trade is disappearing fast.</p><h2>What changed</h2><p>Quantization, distillation, and purpose-built silicon have closed the gap between a phone-sized model and a datacenter one for a large class of everyday tasks.</p><p>The result: apps that feel instant, work offline, and keep more of your data on your own device.</p>',
    'ai',
    array['inference','edge','hardware'],
    'BeingTechy Staff',
    4,
    true
  ),
  (
    'A field guide to Row Level Security in Postgres',
    'field-guide-row-level-security',
    'RLS turns "trust the client" into "trust the database." Here''s how to reason about it without getting stuck.',
    '<p>Row Level Security policies live next to your data, not your app code — which means they hold even if a request skips your API entirely.</p><h2>Start with a single rule</h2><p>Most tables need just one honest question answered: who is allowed to see this row? Write that as a policy before you write anything cleverer.</p>',
    'dev',
    array['postgres','supabase','security'],
    'BeingTechy Staff',
    6,
    true
  ),
  (
    'The quiet redesign of the USB-C port',
    'usb-c-quiet-redesign',
    'Same connector, very different cable underneath — and it matters more than most spec sheets let on.',
    '<p>USB-C looks unchanged from the outside, but what a given cable can actually carry — power, data speed, display bandwidth — now varies enormously.</p><p>Buying "a USB-C cable" without checking its spec is the new buying "a charger" without checking the wattage.</p>',
    'hardware',
    array['usb-c','accessories'],
    'BeingTechy Staff',
    3,
    true
  )
on conflict (slug) do nothing;
