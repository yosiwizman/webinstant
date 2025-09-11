import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

async function renderWebsiteForBusiness(supabase: ReturnType<typeof getServerSupabase>, businessId: string) {
  // Find or create preview row
  let { data: preview } = await supabase
    .from("website_previews")
    .select("id,html_content")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!preview) {
    const { data: inserted } = await supabase
      .from("website_previews")
      .insert({ business_id: businessId })
      .select("id")
      .single();
    preview = inserted as any;
  }

  // Call existing render route to build html_content
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
  await fetch(`${base}/api/preview/render`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId: preview!.id }) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { businessIds = [] } = body as { businessIds: string[] };
    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json({ error: "businessIds is required" }, { status: 400 });
    }
    const supabase = getServerSupabase();
    const results = await Promise.allSettled(businessIds.map((id) => renderWebsiteForBusiness(supabase, id)));
    const generated = results.filter(r => r.status === 'fulfilled').length;
    const errors = results.filter(r => r.status === 'rejected').map((r: any) => r.reason?.message || 'render-failed');
    return NextResponse.json({ generated, errors });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}

