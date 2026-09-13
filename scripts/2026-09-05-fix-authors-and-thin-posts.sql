-- ============================================================
-- One-time content fixes for AdSense reapplication
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to run more than once (it only sets values, doesn't insert rows).
-- ============================================================

-- 1) Normalize placeholder-looking author names (ADMIN / Admin / STAFF)
--    to a consistent byline. Change 'BeingTechy Staff' below to your own
--    name first if you'd rather these show your real name instead.
update posts
set author = 'BeingTechy Staff'
where slug in (
  'call-of-duty-modern-warfare-4-beta-details',
  'open-source-app-unlocks-pixel-11-pro-hilight',
  'carplay-arrives-at-the-helm-crest-marine-balise-pontoons-savvy-navvy-industry-first',
  'cloudflare-monetization-gateway-ai'
);

-- 2) Expand the four thinnest posts (~75-180 words) to substantial,
--    fact-checked articles (~450-600 words each). Content column holds
--    HTML, same as your existing posts. Excerpts updated to match.

update posts
set
  excerpt = 'Same connector, very different cable underneath — what actually determines a USB-C cable''s power, speed, and video support.',
  content = $content$<p>USB-C solved a real problem: one reversible connector for phones, laptops, monitors, and everything in between. What it didn't solve is a quieter one — knowing what any given USB-C cable in a drawer actually does once it's plugged in.</p>
<p>The connector shape is standardized. The electronics inside the cable are not. A USB-C cable can carry anywhere from 60W to 240W of power under USB Power Delivery 3.1, anywhere from 480Mbps to 80Gbps of data depending on whether it supports USB 2.0, USB 3.2, or USB4, and it may or may not carry a video signal via DisplayPort Alt Mode at all. Two cables that look identical, made by the same manufacturer, can differ on every one of those axes.</p>
<h2>What changed, quietly</h2>
<p>The industry's answer has been an "e-marker" chip embedded in higher-spec cables — a small chip that identifies the cable's capabilities to both ends of the connection before any power or data flows. Anything rated above 60W, or any cable claiming USB4 40Gbps/80Gbps speeds, is required to carry one. Cheap cables without an e-marker silently cap out at 60W and USB 2.0 speeds, regardless of what the connector looks like.</p>
<p>USB-IF, the standards body behind the port, has pushed a labeling system — small icons for wattage and a "USB4 40Gbps" or "USB4 80Gbps" badge — but compliance is voluntary, and packaging in the wild is inconsistent at best. Retail listings often just say "USB-C cable, fast charging," which describes nothing.</p>
<h2>Why it matters more now</h2>
<p>The gap used to be forgiving: most people just charged a phone. It isn't anymore. Docking a laptop to two 4K monitors, moving footage off an external SSD, or fast-charging a device at 100W+ all depend on a specific cable's actual spec — not the connector shape. Plug a 240W-capable charger into a 60W cable and the laptop will still charge, just far slower than the charger's rating suggests, with no error and no obvious explanation.</p>
<p>Thunderbolt compounds the confusion: every Thunderbolt cable uses a USB-C connector, but not every USB-C cable supports Thunderbolt. A cable can be fully USB4-compliant and still fail to carry a Thunderbolt-only device correctly.</p>
<h2>What to actually check before buying</h2>
<ul>
<li>For fast charging above 60W: confirm the cable is explicitly rated (100W, 140W, 240W) — don't assume from the connector shape.</li>
<li>For external drives or docks: look for "USB4" plus a speed rating (20/40/80Gbps), not just "USB-C."</li>
<li>For multi-monitor setups: confirm DisplayPort Alt Mode support specifically — it isn't implied by data speed.</li>
</ul>
<p>None of this is a flaw in USB-C itself so much as a labeling problem the industry has been slow to fix. Until packaging catches up, the safest assumption is that no two USB-C cables are the same cable.</p>$content$
where slug = 'usb-c-quiet-redesign';

update posts
set
  excerpt = 'Cloudflare''s Pay Per Crawl turns AI scraping from a free-for-all into a priced transaction — how the 402 status code and bot verification actually work.',
  content = $content$<p>Cloudflare's Pay Per Crawl turns a binary choice — block AI crawlers entirely, or let them scrape for free — into a priced transaction. Publishers can set a per-request price for their content and let individual AI crawlers negotiate access automatically, with no signed deal or lawyer involved.</p>
<h2>How the pricing actually works</h2>
<p>The mechanism runs on HTTP status codes most developers already know. When a crawler without payment intent requests a page a publisher has set to "Charge," Cloudflare's edge returns a <code>402 Payment Required</code> response along with a <code>crawler-price</code> header stating the cost. The crawler can retry the same request with a <code>crawler-exact-price</code> header agreeing to that price, and gets served the content with <code>200 OK</code> once payment clears. A crawler set to "Block" instead gets a functional <code>403 Forbidden</code>, same as it always would.</p>
<p>There's a proactive path too: a crawler can attach a <code>crawler-max-price</code> header upfront, and if the publisher's price is at or under that ceiling, Cloudflare serves the page immediately with a <code>crawler-charged</code> header confirming what was billed — no round trip required.</p>
<h2>Verifying it's actually a crawler</h2>
<p>None of this works without knowing who's really asking. Participating crawlers implement Web Bot Auth: each request is signed with an Ed25519 key pair, using HTTP Message Signatures and a set of signature headers so the origin server can cryptographically verify the requester's identity, rather than trusting a User-Agent string — which is trivial to fake.</p>
<h2>Why this is bigger than another ad product</h2>
<p>Search traffic to publishers has been declining as AI answer engines summarize sources instead of linking to them, and most crawling until now has been effectively unpriced — an AI company's crawler could pull a site's entire archive with no cost beyond bandwidth. Pay Per Crawl gives every site on Cloudflare's network the same three-way control — Allow, Charge, Block — per individual crawler, without needing the negotiating leverage that only the largest publishers had when striking direct licensing deals with AI labs.</p>
<p>It doesn't resolve the argument over whether AI crawling counts as fair use in the first place — that's still being litigated in several jurisdictions. What it does is give the much larger set of sites that could never get an AI company on the phone a functioning price mechanism instead of an all-or-nothing switch.</p>$content$
where slug = 'cloudflare-monetization-gateway-ai';

update posts
set
  excerpt = 'Google''s new Accra-based AI lab gives African founders equity-free access to Gemini, Gemma, and Veo — part of a $1B+ push into the continent''s AI ecosystem.',
  content = $content$<p>Google's Africa Applied AI Lab is based in Accra, Ghana, and was announced during the company's first Cloud Summit Africa, held in Johannesburg on July 1, 2026. It's the latest expansion of a presence Google has held in Ghana since 2019, when it opened its first AI research center on the continent under Moustapha Cissé, who continues to lead Google's AI research effort there.</p>
<h2>What founders actually get</h2>
<p>The program is equity-free — Google isn't taking a stake in exchange for participation. Selected startups get early access to Google DeepMind's model family (Gemini, Gemma, and the video model Veo), plus technical mentorship and go-to-market guidance from Google Research staff. Google has also lined up venture capital partners for the cohort, including 4DX Ventures, Norrsken22, Novastar Ventures, and Ventures Platform, alongside its own Google AI Futures Fund.</p>
<p>Applications opened July 1, 2026 and close August 31, with a co-development phase running from mid-September through early December, ending in a Demo Day where founders pitch to the assembled investors.</p>
<h2>Who it's for</h2>
<p>Google is targeting startups building in five areas: the future of work, knowledge management, software development, creativity, and entertainment. That's a deliberately broad net — less "AI for agriculture" or the sector-specific plays common in earlier Africa tech accelerators, more a bet that African founders building general-purpose AI tools need compute and model access more than they need a narrow thesis imposed on them.</p>
<h2>The bigger number behind it</h2>
<p>The lab sits inside a larger commitment: Google says it has already exceeded a five-year, $1 billion pledge to invest in Africa's digital economy, of which $37 million funded the AI Community Centre that opened in Accra in 2025. It also lines up with Ghana's own National AI Strategy 2025–2035, launched in April 2026, which frames AI capacity-building as a national economic priority rather than a side initiative.</p>
<p>For African AI founders, the practical value is less about funding on offer — the program itself doesn't write checks — and more about the compute and model access that's historically been the hardest thing to get outside a handful of well-funded hubs, plus a direct line to investors who otherwise rarely make the trip.</p>$content$
where slug = 'google-africa-applied-ai-lab';

update posts
set
  excerpt = 'Smaller models and dedicated NPUs have made on-device AI the default for fast, private, cheap tasks — with the cloud now the fallback, not the norm.',
  content = $content$<p>For most of the last decade, "AI" and "the cloud" were functionally synonymous — even a simple voice command got bounced to a data center and back. That's been quietly changing, and by 2026 it's less an emerging trend than the default architecture for a growing share of AI features shipping on phones, laptops, and cars.</p>
<h2>What made it possible</h2>
<p>Two things had to happen at once: models had to get smaller without getting much worse, and chips had to get a dedicated place to run them. On the model side, techniques like quantization (running a model at lower numerical precision) and distillation (training a small model to mimic a larger one) have closed much of the quality gap that used to force a cloud round-trip. On the hardware side, virtually every flagship mobile chip now ships a dedicated NPU (neural processing unit) alongside the CPU and GPU, built specifically to run these smaller models at a fraction of the power a general-purpose processor would need.</p>
<h2>Why it's spreading beyond phones</h2>
<p>The same logic now applies well beyond smartphones. Laptops are shipping with NPUs rated in TOPS (trillions of operations per second) specifically to run on-device AI features locally. Cars are running driver-monitoring and voice models on embedded silicon rather than relying on an always-on connection. Even budget IoT hardware is starting to run small wake-word and sensor-fusion models locally instead of streaming raw data to a server.</p>
<h2>What it actually buys you</h2>
<p>Three things, mostly: latency, privacy, and cost. A model running on-device responds in single-digit milliseconds instead of waiting on a network round trip — the difference between a voice assistant that feels instant and one that feels laggy. Data that never leaves the device can't be intercepted in transit or retained on a server the user doesn't control, which matters a great deal for anything processing camera, microphone, or health-sensor input continuously. And for the company shipping the feature, every inference that runs on the user's hardware is one that isn't metered against a cloud GPU bill — which matters enormously at the scale of a billion-device install base.</p>
<h2>Where the cloud still wins</h2>
<p>None of this replaces cloud inference — it complements it. Anything requiring a genuinely large model, broad world knowledge, or heavy compute (complex reasoning, large-context document analysis, image generation) still routes to the cloud, and most real products now run a hybrid: a small on-device model handles the fast, private, cheap cases, and escalates to the cloud only when the task actually needs it. The interesting engineering problem in 2026 isn't "edge or cloud" — it's deciding, per request, which one a given task actually deserves.</p>$content$
where slug = 'edge-inference-eating-cloud';
