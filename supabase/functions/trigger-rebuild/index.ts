// supabase/functions/trigger-rebuild/index.ts
//
// Called by admin.html right after a post is saved/deleted, to kick off
// the "Rebuild article pages" GitHub Action immediately instead of
// waiting for its 3-hour schedule.
//
// Security model:
// - The GitHub PAT lives ONLY in this function's server-side secrets
//   (set via `supabase secrets set GH_TOKEN=...`). It is never sent to
//   or readable from any browser.
// - Before calling GitHub, this function verifies the caller supplied a
//   valid, currently-logged-in Supabase user session (via the Bearer
//   token admin.html attaches). An anonymous request is rejected.
//
// Deploy with:
//   npx supabase functions deploy trigger-rebuild
// Configure the secret once with:
//   npx supabase secrets set GH_TOKEN=your_fine_grained_pat_here

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GITHUB_OWNER = "ahamedjishfaanms";
const GITHUB_REPO = "blogbeingtechy";
const GITHUB_WORKFLOW_FILE = "build-posts.yml";

// Auto-provided by the Supabase Edge Function runtime — no need to set these.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// You set this one yourself via `supabase secrets set GH_TOKEN=...`.
const GITHUB_TOKEN = Deno.env.get("GH_TOKEN");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is a real, currently-logged-in Supabase user.
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GH_TOKEN secret not configured on this function" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    );

    if (!ghRes.ok) {
      const detail = await ghRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ error: "GitHub dispatch failed", status: ghRes.status, detail }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
