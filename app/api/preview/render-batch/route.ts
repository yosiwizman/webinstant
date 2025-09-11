import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

async function renderWebsiteForBusiness(supabase: ReturnType<typeof getServerSupabase>, businessId: string, overwrite = false) {
  // Find or create preview row
  let { data: preview } = await supabase
    .from("website_previews")
    .select("id,html_content")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (preview && !overwrite && preview.html_content) {
    return { status: 'skipped', previewId: preview.id } as const;
  }

  if (!preview) {
    const { data: inserted, error: insErr } = await supabase
      .from("website_previews")
      .insert({ business_id: businessId })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    preview = inserted as any;
  }

  // Call existing render route to build html_content
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  const resp = await fetch(`${base}/api/preview/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId: preview!.id }) });
  if (!resp.ok) throw new Error(`render-failed-${resp.status}`);
  return { status: 'generated', previewId: preview!.id } as const;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { businessIds = [], overwrite = false } = body as { businessIds: string[]; overwrite?: boolean };
    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json({ error: "businessIds is required" }, { status: 400 });
    }
    const supabase = getServerSupabase();
    const results = await Promise.allSettled(businessIds.map((id) => renderWebsiteForBusiness(supabase, id, overwrite)));

    let generated = 0, skipped = 0, failed = 0;
    const errors: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.status === 'generated') generated++; else skipped++;
      } else {
        failed++;
        errors.push(r.reason?.message || 'render-failed');
      }
    }

    return NextResponse.json({ generated, skipped, failed, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

