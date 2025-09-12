"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Business {
  id: string;
  business_name: string;
  email?: string | null;
}

interface SendResult {
  businessId: string;
  success: boolean;
  message?: string;
}

export default function BulkCampaignPanel() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState("website_ready");
  const [results, setResults] = useState<SendResult[] | null>(null);
  const [openRate, setOpenRate] = useState(0);
  const [clickRate, setClickRate] = useState(0);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]),
    [selected]
  );

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("id, business_name, email")
        .limit(50);
      setBusinesses((data as Business[] | null | undefined) ?? []);
      // Try to compute metrics from emails table if present
      try {
        const { data: emails } = await supabase.from("emails").select("sent_at, opened_at, clicked_at");
        const sent = (emails || []).filter((e) => e.sent_at).length;
        const opened = (emails || []).filter((e) => e.opened_at).length;
        const clicked = (emails || []).filter((e) => e.clicked_at).length;
        setOpenRate(sent ? Math.round((opened / sent) * 100) : 0);
        setClickRate(sent ? Math.round((clicked / sent) * 100) : 0);
      } catch {
        // ignore if emails table not present
      }
    };
    load();
  }, []);

  const toggleAll = (checked: boolean) => {
    const map: Record<string, boolean> = {};
    for (const b of businesses) map[b.id] = checked;
    setSelected(map);
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) {
      alert("Select at least one business");
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const resp = await fetch("/api/campaign/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessIds: selectedIds, template }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) {
        throw new Error(json.error || "Failed to send");
      }
      setResults(json.results as SendResult[]);
      alert(`Sent: ${json.sent}, Failed: ${json.failed}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border rounded-lg p-6 bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bulk Email Campaign</h2>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">Template</label>
          <select
            className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 dark:text-white"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            <option value="website_ready">Default</option>
            <option value="variant_a">Variant A</option>
          </select>
          <button
            onClick={handleSend}
            disabled={loading || selectedIds.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Preview Email"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
        <div>Open rate: <span className="font-semibold">{openRate}%</span></div>
        <div>Click rate: <span className="font-semibold">{clickRate}%</span></div>
        <div>Selected: <span className="font-semibold">{selectedIds.length}</span></div>
        <div>
          <button className="text-blue-600 hover:underline" onClick={() => toggleAll(true)}>Select all</button>
          <span className="mx-2">/</span>
          <button className="text-blue-600 hover:underline" onClick={() => toggleAll(false)}>Clear</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-600 dark:text-gray-300">
              <th className="py-2 px-2">Select</th>
              <th className="py-2 px-2">Business</th>
              <th className="py-2 px-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id} className="border-t border-gray-200 dark:border-gray-700">
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={!!selected[b.id]}
                    onChange={(e) => setSelected((prev) => ({ ...prev, [b.id]: e.target.checked }))}
                  />
                </td>
                <td className="py-2 px-2">{b.business_name}</td>
                <td className="py-2 px-2">{b.email || <span className="text-gray-400">No email</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {results && (
        <div className="mt-4 text-sm">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Results</h3>
          <ul className="list-disc pl-5 text-gray-700 dark:text-gray-200">
            {results.map((r) => (
              <li key={r.businessId}>
                {r.businessId}: {r.success ? "sent" : `failed${r.message ? ` - ${r.message}` : ""}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

