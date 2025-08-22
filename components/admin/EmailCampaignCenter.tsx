"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from '@supabase/supabase-js'

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
  content: string;
  variant: 'A' | 'B';
  test_id: string;
  metrics: {
    sent: number;
    opens: number;
    clicks: number;
    conversions: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
  };
}

interface EmailQueueItem {
  id: string;
  business_id: string;
  business_name: string;
  email: string;
  template_id: string;
  template_name: string;
  scheduled_for: string;
  status: "pending" | "sending" | "sent" | "failed" | "cancelled";
  created_at: string;
}

interface EmailHistoryItem {
  id: string;
  business_id: string;
  business_name: string;
  email: string;
  template_id: string;
  template_name: string;
  sent_at: string;
  opened_at?: string;
  clicked_at?: string;
  converted_at?: string;
  preview_url?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  is_active: boolean;
}

interface EmailData {
  id: string;
  opened_at: string | null;
  clicked_at: string | null;
  converted_at: string | null;
}

export default function EmailCampaignCenter() {
  const [stats, setStats] = useState<CampaignStats>({
    emailsSentToday: 0,
    openRate: 0,
    clickRate: 0,
    conversionRate: 0,
  });
  const [abTests, setAbTests] = useState<{
    templateA?: ABTestTemplate;
    templateB?: ABTestTemplate;
    winner?: "A" | "B";
    testId?: string;
  }>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [emailCount, setEmailCount] = useState(10);
  const [targetSegment, setTargetSegment] = useState("no-website");
  const [scheduleTime, setScheduleTime] = useState("");
  const [emailQueue, setEmailQueue] = useState<EmailQueueItem[]>([]);
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({
    isActive: false,
    current: 0,
    total: 0,
    message: ""
  });
  const [testEmailAddress, setTestEmailAddress] = useState("yosiwizman5638@gmail.com");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const createDefaultTemplates = useCallback(async () => {
    const defaultTemplates = [
      {
        name: "Professional Template",
        subject: "Your New Professional Website is Ready!",
        content: `Hi {{business_name}},

Your stunning new website is live and ready to attract customers!

View your website: {{preview_url}}

This professional website includes:
• Mobile-responsive design
• SEO optimization
• Contact forms
• Business hours & location

Best regards,
The Team`,
        is_active: true
      },
      {
        name: "Friendly Template",
        subject: "Hey {{business_name}}! Check Out Your Amazing New Website 🎉",
        content: `Hey there!

Great news - your brand new website just went live and it looks fantastic!

Check it out here: {{preview_url}}

We've included everything you need to grow your business online. Your customers are going to love it!

Cheers,
The Team`,
        is_active: true
      }
    ];

    for (const template of defaultTemplates) {
      await supabase.from("email_templates").insert(template);
    }
  }, [supabase]);

  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setTemplates(data);
        setSelectedTemplate(data[0].id);
      } else {
        // Create default templates if none exist
        await createDefaultTemplates();
        // Recursive call to fetch after creating
        const { data: newData } = await supabase
          .from("email_templates")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        
        if (newData && newData.length > 0) {
          setTemplates(newData);
          setSelectedTemplate(newData[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }, [createDefaultTemplates, supabase]);

  const fetchStats = useCallback(async () => {
    try {
      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Query emails sent today
      const { data: sentToday, error: sentError } = await supabase
        .from("emails")
        .select("*")
        .gte("sent_at", today.toISOString())
        .lt("sent_at", tomorrow.toISOString());

      if (sentError) throw sentError;

      // Query all emails for rates
      const { data: allEmails, error: allError } = await supabase
        .from("emails")
        .select("*");

      if (allError) throw allError;

      // Filter for sent emails
      const sentEmails = allEmails?.filter(e => e.sent_at) || [];
      const total = sentEmails.length;
      const opened = sentEmails.filter((e) => e.opened_at).length;
      const clicked = sentEmails.filter((e) => e.clicked_at).length;
      const converted = sentEmails.filter((e) => e.converted_at).length;

      setStats({
        emailsSentToday: sentToday?.filter(e => e.sent_at).length || 0,
        openRate: total > 0 ? Math.round((opened / total) * 100) : 0,
        clickRate: total > 0 ? Math.round((clicked / total) * 100) : 0,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [supabase]);

  const fetchABTests = useCallback(async () => {
    try {
      // Get active A/B test
      const { data: activeTests, error: testError } = await supabase
        .from("ab_tests")
        .select("*")
        .eq("is_active", true);

      if (testError || !activeTests || activeTests.length === 0) {
        console.log("No active A/B test found");
        return;
      }

      const activeTest = activeTests[0];

      // Get metrics for each variant
      const { data: variantA, error: errorA } = await supabase
        .from("emails")
        .select("*")
        .eq("ab_test_id", activeTest.id)
        .eq("ab_variant", "A");

      const { data: variantB, error: errorB } = await supabase
        .from("emails")
        .select("*")
        .eq("ab_test_id", activeTest.id)
        .eq("ab_variant", "B");

      if (errorA || errorB) throw errorA || errorB;

      const calculateMetrics = (emails: any[]) => {
        const sent = emails?.length || 0;
        const opens = emails?.filter(e => e.opened_at).length || 0;
        const clicks = emails?.filter(e => e.clicked_at).length || 0;
        const conversions = emails?.filter(e => e.converted_at).length || 0;

        return {
          sent,
          opens,
          clicks,
          conversions,
          openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
          clickRate: sent > 0 ? Math.round((clicks / sent) * 100) : 0,
          conversionRate: sent > 0 ? Math.round((conversions / sent) * 100) : 0,
        };
      };

      const metricsA = calculateMetrics(variantA || []);
      const metricsB = calculateMetrics(variantB || []);

      // Determine winner based on click rate
      let winner: "A" | "B" | undefined;
      if (metricsA.sent >= 50 && metricsB.sent >= 50) {
        winner = metricsA.clickRate > metricsB.clickRate ? "A" : "B";
      }

      setAbTests({
        templateA: {
          id: activeTest.template_a_id,
          name: activeTest.template_a_name || "Variant A",
          subject: activeTest.template_a_subject || "",
          content: activeTest.template_a_content || "",
          variant: "A",
          test_id: activeTest.id,
          metrics: metricsA
        },
        templateB: {
          id: activeTest.template_b_id,
          name: activeTest.template_b_name || "Variant B",
          subject: activeTest.template_b_subject || "",
          content: activeTest.template_b_content || "",
          variant: "B",
          test_id: activeTest.id,
          metrics: metricsB
        },
        winner,
        testId: activeTest.id
      });
    } catch (error) {
      console.error("Error fetching A/B tests:", error);
    }
  }, [supabase]);

  const fetchEmailQueue = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("email_queue")
        .select("*")
        .in("status", ["pending", "sending"])
        .order("scheduled_for", { ascending: true })
        .limit(20);

      if (error) throw error;

      if (data) {
        // Fetch related data separately
        const businessIds = [...new Set(data.map(item => item.business_id).filter(Boolean))];
        const templateIds = [...new Set(data.map(item => item.template_id).filter(Boolean))];

        let businesses: any[] = [];
        let templates: any[] = [];

        if (businessIds.length > 0) {
          const { data: bizData } = await supabase
            .from("businesses")
            .select("id, business_name, email")
            .in("id", businessIds);
          businesses = bizData || [];
        }

        if (templateIds.length > 0) {
          const { data: tempData } = await supabase
            .from("email_templates")
            .select("id, name")
            .in("id", templateIds);
          templates = tempData || [];
        }

        setEmailQueue(
          data.map((item) => {
            const business = businesses.find(b => b.id === item.business_id);
            const template = templates.find(t => t.id === item.template_id);
            
            return {
              id: item.id,
              business_id: item.business_id,
              business_name: business?.business_name || "Unknown",
              email: business?.email || item.email || "No email",
              template_id: item.template_id,
              template_name: template?.name || "Default Template",
              scheduled_for: item.scheduled_for,
              status: item.status,
              created_at: item.created_at,
            };
          })
        );
      }
    } catch (error) {
      console.error("Error fetching email queue:", error);
    }
  }, [supabase]);

  const fetchEmailHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("emails")
        .select("*")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data) {
        // Fetch related data separately
        const businessIds = [...new Set(data.map(item => item.business_id).filter(Boolean))];
        const templateIds = [...new Set(data.map(item => item.template_id).filter(Boolean))];

        let businesses: any[] = [];
        let templates: any[] = [];
        let previews: any[] = [];

        if (businessIds.length > 0) {
          const { data: bizData } = await supabase
            .from("businesses")
            .select("id, business_name, email")
            .in("id", businessIds);
          businesses = bizData || [];

          const { data: previewData } = await supabase
            .from("website_previews")
            .select("business_id, preview_url")
            .in("business_id", businessIds);
          previews = previewData || [];
        }

        if (templateIds.length > 0) {
          const { data: tempData } = await supabase
            .from("email_templates")
            .select("id, name")
            .in("id", templateIds);
          templates = tempData || [];
        }

        setEmailHistory(
          data.map((item) => {
            const business = businesses.find(b => b.id === item.business_id);
            const template = templates.find(t => t.id === item.template_id);
            const preview = previews.find(p => p.business_id === item.business_id);
            
            return {
              id: item.id,
              business_id: item.business_id,
              business_name: business?.business_name || "Unknown",
              email: business?.email || item.email || "No email",
              template_id: item.template_id,
              template_name: template?.name || "Default Template",
              sent_at: item.sent_at,
              opened_at: item.opened_at,
              clicked_at: item.clicked_at,
              converted_at: item.converted_at,
              preview_url: preview?.preview_url,
            };
          })
        );
      }
    } catch (error) {
      console.error("Error fetching email history:", error);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStats();
    fetchEmailQueue();
    fetchEmailHistory();
    fetchTemplates();
    fetchABTests();
  }, [fetchStats, fetchEmailQueue, fetchEmailHistory, fetchTemplates, fetchABTests]);

  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmailAddress,
          businessName: 'Test Business',
          businessId: 'test-id-123',
          subject: 'WebInstant Test Email',
          content: `
            <h1 style="color: #333;">Test Email from WebInstant</h1>
            <p>If you're receiving this email, your Resend integration is working correctly!</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Sent at: ${new Date().toLocaleString()}</li>
              <li>Email service: Resend</li>
              <li>Environment: ${process.env.NODE_ENV || 'development'}</li>
            </ul>
            <p style="color: #666; font-size: 12px;">This is a test email from your WebInstant admin panel.</p>
          `,
          isTest: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Test email sent successfully to ${testEmailAddress}! Check your inbox.`);
        
        // Log success to operations
        await supabase.from("operations_log").insert({
          operation_type: "test_email_sent",
          status: "success",
          details: {
            to: testEmailAddress,
            message_id: result.messageId
          },
          created_at: new Date().toISOString()
        });
      } else {
        alert(`❌ Failed to send test email: ${result.error || 'Unknown error'}`);
        
        // Log error to operations
        await supabase.from("operations_log").insert({
          operation_type: "test_email_sent",
          status: "error",
          details: {
            to: testEmailAddress,
            error: result.error
          },
          created_at: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      alert(`❌ Error: ${(error as Error).message}`);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSendCampaign = async () => {
    setLoading(true);
    setSendingProgress({
      isActive: true,
      current: 0,
      total: emailCount,
      message: "Preparing campaign..."
    });

    try {
      // Get businesses based on segment
      let query = supabase
        .from("businesses")
        .select("*");

      // Apply segment filter
      switch (targetSegment) {
        case "no-website":
          query = query.is("website_url", null);
          break;
        case "high-priority":
          query = query.eq("priority", "high");
          break;
        case "inactive":
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          query = query.lt("last_contact", thirtyDaysAgo.toISOString());
          break;
        case "all":
        default:
          // No additional filter
          break;
      }

      // Limit to requested count
      query = query.limit(emailCount);

      const { data: businesses, error: bizError } = await query;

      if (bizError) throw bizError;

      if (!businesses || businesses.length === 0) {
        alert("No businesses found for the selected segment");
        return;
      }

      setSendingProgress({
        isActive: true,
        current: 0,
        total: businesses.length,
        message: `Sending to ${businesses.length} businesses...`
      });

      // Get selected template
      const template = templates.find(t => t.id === selectedTemplate);
      if (!template) {
        alert("Please select a template");
        return;
      }

      // Send emails
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < businesses.length; i++) {
        const business = businesses[i];
        
        setSendingProgress({
          isActive: true,
          current: i + 1,
          total: businesses.length,
          message: `Sending to ${business.business_name}...`
        });

        try {
          // Check if we need to generate a preview first
          let previewUrl = null;
          const { data: existingPreview } = await supabase
            .from("website_previews")
            .select("preview_url")
            .eq("business_id", business.id)
            .limit(1);

          if (existingPreview && existingPreview.length > 0) {
            previewUrl = existingPreview[0].preview_url;
          } else {
            // Generate preview first
            const previewResponse = await fetch("/api/generate-preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessId: business.id }),
            });

            if (previewResponse.ok) {
              const previewData = await previewResponse.json();
              previewUrl = previewData.previewUrl;
            }
          }

          // Send email via API
          const response = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: business.email,
              businessName: business.business_name,
              businessId: business.id,
              templateId: template.id,
              subject: template.subject.replace("{{business_name}}", business.business_name),
              content: template.content
                .replace(/{{business_name}}/g, business.business_name)
                .replace(/{{preview_url}}/g, previewUrl || "http://localhost:3000"),
              previewUrl: previewUrl,
              scheduleTime: scheduleTime || null,
              abTestId: abTests.testId,
              abVariant: Math.random() > 0.5 ? "A" : "B"
            }),
          });

          if (response.ok) {
            successCount++;
            
            // Log to operations_log
            await supabase.from("operations_log").insert({
              operation_type: "email_sent",
              status: "success",
              details: {
                business_id: business.id,
                business_name: business.business_name,
                template_id: template.id,
                template_name: template.name
              },
              created_at: new Date().toISOString()
            });
          } else {
            failCount++;
            const error = await response.text();
            
            // Log error
            await supabase.from("operations_log").insert({
              operation_type: "email_sent",
              status: "error",
              details: {
                business_id: business.id,
                business_name: business.business_name,
                error: error
              },
              created_at: new Date().toISOString()
            });
          }
        } catch (error) {
          failCount++;
          console.error(`Error sending to ${business.business_name}:`, error);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setSendingProgress({
        isActive: false,
        current: 0,
        total: 0,
        message: ""
      });

      alert(`Campaign complete! Sent: ${successCount}, Failed: ${failCount}`);
      
      // Refresh data
      fetchStats();
      fetchEmailQueue();
      fetchEmailHistory();
    } catch (error) {
      console.error("Error sending campaign:", error);
      alert("Error sending campaign: " + (error as Error).message);
    } finally {
      setLoading(false);
      setSendingProgress({
        isActive: false,
        current: 0,
        total: 0,
        message: ""
      });
    }
  };

  const handleCancelEmail = async (id: string) => {
    try {
      const { error } = await supabase
        .from("email_queue")
        .update({ 
          status: "cancelled",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;

      // Log cancellation
      await supabase.from("operations_log").insert({
        operation_type: "email_cancelled",
        status: "info",
        details: { queue_id: id },
        created_at: new Date().toISOString()
      });

      fetchEmailQueue();
      alert("Email cancelled successfully");
    } catch (error) {
      console.error("Error cancelling email:", error);
      alert("Failed to cancel email");
    }
  };

  const handleResendEmail = async (historyItem: EmailHistoryItem) => {
    setLoading(true);
    try {
      // Get the template
      const { data: template, error: templateError } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", historyItem.template_id);

      if (templateError || !template || template.length === 0) {
        alert("Template not found");
        return;
      }

      const templateData = template[0];

      // Send email via API
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: historyItem.email,
          businessName: historyItem.business_name,
          businessId: historyItem.business_id,
          templateId: templateData.id,
          subject: templateData.subject.replace("{{business_name}}", historyItem.business_name),
          content: templateData.content
            .replace(/{{business_name}}/g, historyItem.business_name)
            .replace(/{{preview_url}}/g, historyItem.preview_url || "http://localhost:3000"),
          previewUrl: historyItem.preview_url,
          isResend: true,
          originalEmailId: historyItem.id
        }),
      });

      if (response.ok) {
        alert("Email resent successfully!");
        
        // Log resend
        await supabase.from("operations_log").insert({
          operation_type: "email_resent",
          status: "success",
          details: {
            business_id: historyItem.business_id,
            business_name: historyItem.business_name,
            original_email_id: historyItem.id
          },
          created_at: new Date().toISOString()
        });

        fetchEmailHistory();
      } else {
        const error = await response.text();
        alert("Failed to resend email: " + error);
      }
    } catch (error) {
      console.error("Error resending email:", error);
      alert("Error resending email");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from("email_templates")
        .update({
          name: editingTemplate.name,
          subject: editingTemplate.subject,
          content: editingTemplate.content,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingTemplate.id);

      if (error) throw error;

      alert("Template saved successfully!");
      setShowTemplateEditor(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      alert("Failed to save template");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Test Email Section */}
      <div className="bg-green-50 border border-green-200 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4 text-green-800">🧪 Email Service Test</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-green-700">
              Test Email Address
            </label>
            <input
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              className="w-full border border-green-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter email address"
            />
            <p className="text-xs text-green-600 mt-1">
              Send a test email to verify Resend is configured correctly
            </p>
          </div>
          <button
            onClick={handleSendTestEmail}
            disabled={sendingTestEmail || !testEmailAddress}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sendingTestEmail ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send Test Email
              </>
            )}
          </button>
        </div>
      </div>

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
      {abTests.templateA && abTests.templateB && (
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
                <div className="text-sm text-gray-600 line-clamp-2">
                  {abTests.templateA.content}
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
                <div className="flex justify-between text-sm">
                  <span>Conversion Rate:</span>
                  <span className="font-semibold text-orange-600">
                    {abTests.templateA.metrics.conversionRate}%
                  </span>
                </div>
              </div>
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
                <div className="text-sm text-gray-600 line-clamp-2">
                  {abTests.templateB.content}
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
                <div className="flex justify-between text-sm">
                  <span>Conversion Rate:</span>
                  <span className="font-semibold text-orange-600">
                    {abTests.templateB.metrics.conversionRate}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              disabled={templates.length === 0}
            >
              {templates.length === 0 ? (
                <option value="">No templates available</option>
              ) : (
                templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Number of Emails
            </label>
            <input
              type="number"
              value={emailCount}
              onChange={(e) => setEmailCount(parseInt(e.target.value) || 1)}
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
              <option value="inactive">Inactive (30+ days)</option>
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
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        </div>
        
        {/* Sending Progress */}
        {sendingProgress.isActive && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">{sendingProgress.message}</span>
              <span className="text-sm font-medium">
                {sendingProgress.current} / {sendingProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${(sendingProgress.current / sendingProgress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSendCampaign}
          disabled={loading || sendingProgress.isActive || templates.length === 0}
          className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading || sendingProgress.isActive
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
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {emailQueue.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.business_name}</td>
                    <td className="py-2 text-sm">{item.email}</td>
                    <td className="py-2">{item.template_name}</td>
                    <td className="py-2 text-sm">
                      {new Date(item.scheduled_for).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        item.status === 'sending' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => handleCancelEmail(item.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Cancel
                        </button>
                      )}
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
        {emailHistory.length === 0 ? (
          <p className="text-gray-500">No emails sent yet</p>
        ) : (
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
                    <td className="py-2">
                      <div>
                        <div className="font-medium">{item.business_name}</div>
                        <div className="text-xs text-gray-500">{item.email}</div>
                      </div>
                    </td>
                    <td className="py-2">{item.template_name}</td>
                    <td className="py-2 text-sm">
                      {new Date(item.sent_at).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        {item.opened_at && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            Opened
                          </span>
                        )}
                        {item.clicked_at && (
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                            Clicked
                          </span>
                        )}
                        {item.converted_at && (
                          <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                            Converted
                          </span>
                        )}
                        {!item.opened_at && !item.clicked_at && (
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
        )}
      </div>

      {/* Template Editor Modal */}
      {showTemplateEditor && editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              Edit Template: {editingTemplate.name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    name: e.target.value
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    subject: e.target.value
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use {"{{business_name}}"} to insert the business name
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Email Content
                </label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 h-64 font-mono text-sm"
                  value={editingTemplate.content}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    content: e.target.value
                  })}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: {"{{business_name}}"}, {"{{preview_url}}"}
                </p>
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
                  onClick={handleSaveTemplate}
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
