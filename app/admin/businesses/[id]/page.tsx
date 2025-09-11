import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

async function fetchBusiness(id: string) {
  const sb = getServerSupabase();
  const { data: biz, error: bErr } = await sb.from("businesses").select("*").eq("id", id).maybeSingle();
  if (bErr) throw bErr;
  if (!biz) return null;

  const { data: preview } = await sb
    .from("website_previews")
    .select("id,preview_url,html_content,slug")
    .eq("business_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: emails } = await sb
    .from("email_logs")
    .select("id,subject,sent_at,opened_at,clicked_at")
    .eq("business_id", id)
    .order("sent_at", { ascending: false })
    .limit(20);

  const { count: opens } = await sb.from("email_logs").select("id", { count: "exact", head: true }).eq("business_id", id).not("opened_at", "is", null);
  const { count: clicks } = await sb.from("email_logs").select("id", { count: "exact", head: true }).eq("business_id", id).not("clicked_at", "is", null);
  const { data: unsubRow } = await sb.from("businesses").select("unsubscribed").eq("id", id).maybeSingle();
  const unsubscribed = !!unsubRow?.unsubscribed;

  return {
    biz,
    preview,
    emails: emails || [],
    metrics: { opens: opens || 0, clicks: clicks || 0, unsubscribed },
  };
}

export default async function Page({ params }: { params: { id: string } }) {
  const id = params.id;
  const data = await fetchBusiness(id);
  if (!data) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const { biz, preview, metrics } = data;
  const displayName = biz.business_name || biz.name || "Business";

  return (
    <div className="bg-white text-gray-900 dark:bg-neutral-950 dark:text-neutral-50 min-h-screen p-6 space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-gray-500">
            {(biz.category || biz.industry_type || "General")} · {biz.city || ""}{biz.state ? `, ${biz.state}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {preview?.id && (
            <a href={`/preview/${preview.id}`} target="_blank" className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              Open Website Preview
            </a>
          )}
          <a href={`/admin/emails?business_id=${biz.id}`} className="rounded-xl bg-gray-100 px-4 py-2 hover:bg-gray-200">
            View Emails
          </a>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card label="Emails Sent" value={(data.emails || []).length} />
        <Card label="Opens" value={metrics.opens} />
        <Card label="Clicks" value={metrics.clicks} />
        <Card label="Unsubscribed" value={metrics.unsubscribed ? "Yes" : "No"} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <h2 className="mb-3 text-lg font-medium">Business Info</h2>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-2">
            <dt className="text-gray-500">Name</dt><dd className="col-span-2">{displayName}</dd>
            <dt className="text-gray-500">Category</dt><dd className="col-span-2">{biz.category || biz.industry_type || "General"}</dd>
            <dt className="text-gray-500">Address</dt><dd className="col-span-2">{biz.address || "—"}</dd>
            <dt className="text-gray-500">Website</dt>
            <dd className="col-span-2">{preview?.preview_url || "—"}</dd>
          </dl>
        </div>
        <div className="rounded-2xl border p-0 overflow-hidden">
          <div className="border-b p-3 text-sm text-gray-500">Live Preview</div>
          {preview?.id ? (
            <iframe src={`/preview/${preview.id}`} className="h-[700px] w-full" loading="lazy" />
          ) : (
            <div className="p-6 text-sm text-gray-500">No preview yet.</div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-medium">Recent Emails</h2>
          <a href={`/admin/emails?business_id=${biz.id}`} className="text-sm text-blue-600 hover:underline">All emails</a>
        </div>
        <div className="divide-y">
          {(data.emails || []).map((e: any) => (
            <div key={e.id} className="grid grid-cols-12 gap-2 p-3 text-sm">
              <div className="col-span-5 truncate">{e.subject || '—'}</div>
              <div className="col-span-3">{e.sent_at ? new Date(e.sent_at).toLocaleString() : '—'}</div>
              <div className="col-span-2">Opened: {e.opened_at ? 'Yes' : 'No'}</div>
              <div className="col-span-2">Clicked: {e.clicked_at ? 'Yes' : 'No'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

