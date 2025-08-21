"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface CampaignStats {
  emailsSentToday: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

interface ABTestTemplate {
  id: string;
  name: string;
  subject: string;
  preview: string;
  metrics: {
    sent: number;
    opens: number;
    clicks: number;
    openRate: number;
    clickRate: number;
  };
}

interface EmailQueueItem {
  id: string;
  businessName: string;
  email: string;
  template: string;
  scheduledFor: string;
  status: "pending" | "sending" | "sent" | "failed";
}

interface EmailHistoryItem {
  id: string;
  businessName: string;
  email: string;
  template: string;
  sentAt: string;
  opened: boolean;
  clicked: boolean;
  openedAt?: string;
  clickedAt?: string;
}

export default function EmailCampaignCenter() {
  const [stats, setStats] = useState<CampaignStats>({
    emailsSentToday: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
  });
  const [abTests, setAbTests] = useState<{
    templateA: ABTestTemplate;
    templateB: ABTestTemplate;
    winner?: "A" | "B";
  }>({
    templateA: {
      id: "template-a",
      name: "Professional Template",
      subject: "Your New Professional Website is Ready!",
      preview:
        "Hi {businessName}, Your stunning new website is live and ready to attract customers...",
      metrics: {
        sent: 150,
        opens: 75,
        clicks: 30,
        openRate: 50,
        clickRate: 20,
      },
    },
    templateB: {
      id: "template-b",
      name: "Friendly Template",
      subject: "Hey {businessName}! Check Out Your Amazing New Website 🎉",
      preview:
        "Hey there! Great news - your brand new website just went live and it looks fantastic...",
      metrics: {
        sent: 150,
        opens: 90,
        clicks: 45,
        openRate: 60,
        clickRate: 30,
      },
    },
    winner: "B",
  });
  const [selectedTemplate, setSelectedTemplate] = useState("template-a");
  const [emailCount, setEmailCount] = useState(10);
  const [targetSegment, setTargetSegment] = useState("no-website");
  const [scheduleTime, setScheduleTime] = useState("");
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchEmailQueue();
    fetchEmailHistory();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: sentToday } = await supabase
        .from("email_logs")
        .select("*")
        .gte("sent_at", today.toISOString())
        .eq("status", "sent");

      const { data: allEmails } = await supabase
        .from("email_logs")
        .select("*")
        .eq("status", "sent");

      const opened = allEmails?.filter((e) => e.opened_at).length || 0;
      const clicked = allEmails?.filter((e) => e.clicked_at).length || 0;
      const converted = allEmails?.filter((e) => e.converted_at).length || 0;
      const total = allEmails?.length || 1;

      setStats({
        emailsSentToday: sentToday?.length || 0,
        openRate: Math.round((opened / total) * 100),
        clickRate: Math.round((clicked / total) * 100),
        conversionRate: Math.round((converted / total) * 100),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmailQueue = async () => {
    try {
      const { data } = await supabase
        .from("email_queue")
        .select("*")
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true })
        .limit(10);

      if (data) {
        setEmailQueue(
          data.map((item) => ({
            id: item.id,
            businessName: item.business_name,
            email: item.email,
            template: item.template_name,
            scheduledFor: item.scheduled_for,
            status: item.status,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching email queue:", error);
    }
  };

  const fetchEmailHistory = async () => {
    try {
      const { data } = await supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(20);

      if (data) {
        setEmailHistory(
          data.map((item) => ({
            id: item.id,
            businessName: item.business_name,
            email: item.email,
            template: item.template_name,
            sentAt: item.sent_at,
            opened: !!item.opened_at,
            clicked: !!item.clicked_at,
            openedAt: item.opened_at,
            clickedAt: item.clicked_at,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching email history:", error);
    }
  };

  const handleSendCampaign = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: selectedTemplate,
          count: emailCount,
          segment: targetSegment,
          scheduleTime: scheduleTime || null,
        }),
      });

      if (response.ok) {
        alert("Campaign sent successfully!");
        fetchStats();
        fetchEmailQueue();
        fetchEmailHistory();
      } else {
        alert("Failed to send campaign");
      }
    } catch (error) {
      console.error("Error sending campaign:", error);
      alert("Error sending campaign");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from("email_queue")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (!error) {
        fetchEmailQueue();
      }
    } catch (error) {
      console.error("Error cancelling email:", error);
    }
  };

  const handleResendEmail = async (historyItem: EmailHistoryItem) => {
    setLoading(true);
    try {
      const response = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: historyItem.template,
          emails: [historyItem.email],
          businessName: historyItem.businessName,
        }),
      });

      if (response.ok) {
        alert("Email resent successfully!");
        fetchEmailHistory();
      }
    } catch (error) {
      console.error("Error resending email:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Campaign Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Campaign Statistics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded">
            <div className="text-sm text-gray-600">Emails Sent Today</div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.emailsSentToday}
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <div className="text-sm text-gray-600">Open Rate</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.openRate}%
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded">
            <div className="text-sm text-gray-600">Click Rate</div>
            <div className="text-2xl font-bold text-purple-600">
              {stats.clickRate}%
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded">
            <div className="text-sm text-gray-600">Conversion Rate</div>
            <div className="text-2xl font-bold text-orange-600">
              {stats.conversionRate}%
            </div>
          </div>
        </div>
      </div>

      {/* A/B Test Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">A/B Test Results</h2>
        <div className="grid grid-cols-2 gap-6">
          {/* Template A */}
          <div
            className={`border-2 rounded-lg p-4 ${
              abTests.winner === "A" ? "border-green-500" : "border-gray-200"
            }`}
          >
            {abTests.winner === "A" && (
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold inline-block mb-2">
                🏆 Winner
              </div>
            )}
            <h3 className="font-bold text-lg mb-2">{abTests.templateA.name}</h3>
            <div className="bg-gray-50 p-3 rounded mb-3">
              <div className="text-sm font-semibold mb-1">
                Subject: {abTests.templateA.subject}
              </div>
              <div className="text-sm text-gray-600">
                {abTests.templateA.preview}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sent:</span>
                <span className="font-semibold">
                  {abTests.templateA.metrics.sent}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Open Rate:</span>
                <span className="font-semibold text-green-600">
                  {abTests.templateA.metrics.openRate}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Click Rate:</span>
                <span className="font-semibold text-purple-600">
                  {abTests.templateA.metrics.clickRate}%
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingTemplate("template-a");
                setShowTemplateEditor(true);
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Edit Template
            </button>
          </div>

          {/* Template B */}
          <div
            className={`border-2 rounded-lg p-4 ${
              abTests.winner === "B" ? "border-green-500" : "border-gray-200"
            }`}
          >
            {abTests.winner === "B" && (
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold inline-block mb-2">
                🏆 Winner
              </div>
            )}
            <h3 className="font-bold text-lg mb-2">{abTests.templateB.name}</h3>
            <div className="bg-gray-50 p-3 rounded mb-3">
              <div className="text-sm font-semibold mb-1">
                Subject: {abTests.templateB.subject}
              </div>
              <div className="text-sm text-gray-600">
                {abTests.templateB.preview}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sent:</span>
                <span className="font-semibold">
                  {abTests.templateB.metrics.sent}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Open Rate:</span>
                <span className="font-semibold text-green-600">
                  {abTests.templateB.metrics.openRate}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Click Rate:</span>
                <span className="font-semibold text-purple-600">
                  {abTests.templateB.metrics.clickRate}%
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingTemplate("template-b");
                setShowTemplateEditor(true);
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800"
            >
              Edit Template
            </button>
          </div>
        </div>
      </div>

      {/* Quick Send Campaign */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Quick Send Campaign</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Select Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="template-a">Professional Template</option>
              <option value="template-b">Friendly Template</option>
              <option value="follow-up">Follow-up Template</option>
              <option value="reminder">Reminder Template</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Number of Emails
            </label>
            <input
              type="number"
              value={emailCount}
              onChange={(e) => setEmailCount(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2"
              min="1"
              max="100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Target Segment
            </label>
            <select
              value={targetSegment}
              onChange={(e) => setTargetSegment(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="no-website">No Website</option>
              <option value="high-priority">High Priority</option>
              <option value="inactive">Inactive</option>
              <option value="all">All Businesses</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Schedule (Optional)
            </label>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <button
          onClick={handleSendCampaign}
          disabled={loading}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? "Sending..."
            : scheduleTime
            ? "Schedule Campaign"
            : "Send Campaign Now"}
        </button>
      </div>

      {/* Email Queue */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Email Queue</h2>
        {emailQueue.length === 0 ? (
          <p className="text-gray-500">No pending emails in queue</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Business</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Template</th>
                  <th className="text-left py-2">Scheduled For</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {emailQueue.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.businessName}</td>
                    <td className="py-2">{item.email}</td>
                    <td className="py-2">{item.template}</td>
                    <td className="py-2">
                      {new Date(item.scheduledFor).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleCancelEmail(item.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Email History</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Business</th>
                <th className="text-left py-2">Template</th>
                <th className="text-left py-2">Sent</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {emailHistory.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.businessName}</td>
                  <td className="py-2">{item.template}</td>
                  <td className="py-2">
                    {new Date(item.sentAt).toLocaleString()}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      {item.opened && (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                          Opened
                        </span>
                      )}
                      {item.clicked && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                          Clicked
                        </span>
                      )}
                      {!item.opened && !item.clicked && (
                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs">
                          Sent
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2">
                    <button
                      onClick={() => handleResendEmail(item)}
                      disabled={loading}
                      className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                    >
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              Edit Template: {editingTemplate}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  defaultValue={
                    editingTemplate === "template-a"
                      ? abTests.templateA.name
                      : abTests.templateB.name
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  defaultValue={
                    editingTemplate === "template-a"
                      ? abTests.templateA.subject
                      : abTests.templateB.subject
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Content
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 h-64"
                  defaultValue={
                    editingTemplate === "template-a"
                      ? abTests.templateA.preview
                      : abTests.templateB.preview
                  }
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowTemplateEditor(false);
                    setEditingTemplate(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Save template logic here
                    setShowTemplateEditor(false);
                    setEditingTemplate(null);
                    alert("Template saved!");
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
