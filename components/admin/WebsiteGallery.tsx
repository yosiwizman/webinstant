"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getBrowserSupabase } from '@/lib/supabase';
import {
  Eye,
  Mail,
  Copy,
  Trash2,
  ExternalLink,
  Filter,
  Search,
  CheckCircle,
  MousePointer,
  DollarSign,
  MailOpen,
  Calendar,
  Building,
  Users,
  MoreVertical,
} from "lucide-react";

interface WebsitePreview {
  id: string;
  business_id: string;
  preview_url: string;
  html_content: string;
  template_used: string;
  slug: string;
  create_at: string;
  business: {
    id: string;
    business_name: string;
    industry_type: string;
    email: string;
    claimed_at: string | null;
  };
  emails: Array<{
    id: string;
    sent_at: string;
    opened_at: string | null;
    clicked_at: string | null;
  }>;
}

interface Stats {
  total: number;
  generatedToday: number;
  pending: number;
  withEmailsSent: number;
}

export default function WebsiteGallery() {
  const [previews, setPreviews] = useState<WebsitePreview[]>([]);
  const [filteredPreviews, setFilteredPreviews] = useState<WebsitePreview[]>(
    []
  );
  const [stats, setStats] = useState<Stats>({
    total: 0,
    generatedToday: 0,
    pending: 0,
    withEmailsSent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedPreviews, setSelectedPreviews] = useState<Set<string>>(
    new Set()
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Use refs to prevent unnecessary re-fetches
  const hasFetchedData = useRef(false);
  const cachedPreviews = useRef<WebsitePreview[]>([]);

  const supabase = getBrowserSupabase() as any;

  const fetchPreviews = useCallback(async (forceRefresh = false) => {
    // Use cached data if available and not forcing refresh
    if (!forceRefresh && cachedPreviews.current.length > 0) {
      setPreviews(cachedPreviews.current);
      setLoading(false);
      return;
    }

    try {
      // Query website_previews joined with businesses and emails
      const { data, error } = await supabase
        .from("website_previews")
        .select(
          `
          *,
          business:businesses!business_id (
            id,
            business_name,
            industry_type,
            email,
            claimed_at
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // For each preview, fetch associated emails
      const previewsWithEmails = await Promise.all(
(data as any[] || []).map(async (preview: any) => {
          const { data: emailData } = await supabase
            .from("emails")
            .select("id, sent_at, opened_at, clicked_at")
            .eq("business_id", preview.business_id)
            .order("sent_at", { ascending: false });

          return {
            ...preview,
            emails: emailData || [],
          } as any;
        })
      );

      cachedPreviews.current = previewsWithEmails;
      setPreviews(previewsWithEmails);
    } catch (error) {
      console.error("Error fetching previews:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchStats = useCallback(async () => {
    try {
      // Total previews
      const { count: totalCount } = await supabase
        .from("website_previews")
        .select("*", { count: "exact", head: true });

      // Generated today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { count: todayCount } = await supabase
        .from("website_previews")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayISO);

      // Pending (businesses without previews)
      const { data: allBusinesses } = await supabase
        .from("businesses")
        .select("id");

      const { data: businessesWithPreviews } = await supabase
        .from("website_previews")
        .select("business_id");

      const businessesWithPreviewsSet = new Set(
        businessesWithPreviews?.map((p) => p.business_id) || []
      );
      const pendingCount = (allBusinesses || []).filter(
        (b) => !businessesWithPreviewsSet.has(b.id)
      ).length;

      // With emails sent
      const { data: previewsWithEmails } = await supabase
        .from("emails")
        .select("business_id")
        .not("business_id", "is", null);

      const uniqueBusinessesWithEmails = new Set(
        previewsWithEmails?.map((e) => e.business_id) || []
      );

      setStats({
        total: totalCount || 0,
        generatedToday: todayCount || 0,
        pending: pendingCount,
        withEmailsSent: uniqueBusinessesWithEmails.size,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [supabase]);

  const filterPreviews = useCallback(() => {
    let filtered = [...previews];

    // Status filter
    switch (statusFilter) {
      case "no-email":
      filtered = filtered.filter((p: any) => p.emails.length === 0);
        break;
      case "opened":
        filtered = filtered.filter((p: any) =>
          p.emails.some((e: any) => e.opened_at !== null)
        );
        break;
      case "customer":
        filtered = filtered.filter((p: any) => p.business.claimed_at !== null);
        break;
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(
        (p: any) => p.business.industry_type === categoryFilter
      );
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter((p: any) =>
        String(p.business.business_name)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    }

    setFilteredPreviews(filtered);
  }, [previews, statusFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    // Only fetch once on mount
    if (!hasFetchedData.current) {
      hasFetchedData.current = true;
      fetchPreviews();
      fetchStats();
    }
  }, [fetchPreviews, fetchStats]);

  useEffect(() => {
    filterPreviews();
  }, [filterPreviews]);

  useEffect(() => {
    setShowBulkActions(selectedPreviews.size > 0);
  }, [selectedPreviews]);

  const handleSelectPreview = (id: string) => {
    const newSelected = new Set(selectedPreviews);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPreviews(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedPreviews.size === filteredPreviews.length) {
      setSelectedPreviews(new Set());
    } else {
      setSelectedPreviews(new Set(filteredPreviews.map((p: any) => p.id)));
    }
  };

const handleSendEmail = async (preview: any) => {
    try {
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          businessId: preview.business_id,
          businessName: preview.business.business_name,
          email: preview.business.email,
          previewUrl: preview.preview_url,
        }),
      });

      if (response.ok) {
        console.log("Email sent successfully");
        await fetchPreviews(true); // Force refresh
        await fetchStats();
      } else {
        console.error("Failed to send email");
      }
    } catch (error) {
      console.error("Error sending email:", error);
    }
  };

  const handleBulkSendEmails = async () => {
    for (const previewId of selectedPreviews) {
      const preview = previews.find((p) => p.id === previewId);
      if (preview) {
        await handleSendEmail(preview);
      }
    }
    setSelectedPreviews(new Set());
    await fetchPreviews(true); // Force refresh
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedPreviews.size} previews?`)) return;

    for (const id of selectedPreviews) {
      await supabase.from("website_previews").delete().eq("id", id);
    }

    await fetchPreviews(true); // Force refresh
    await fetchStats();
    setSelectedPreviews(new Set());
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    // You could add a toast notification here
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this preview?")) return;

    await supabase.from("website_previews").delete().eq("id", id);
    await fetchPreviews(true); // Force refresh
    await fetchStats();
  };

  const getBusinessTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      restaurant: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      beauty: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
      medical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      retail: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      service: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      fitness: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      default: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    };
    return colors[type] || colors.default;
  };

  const categories = Array.from(
    new Set(previews.map((p) => p.business.industry_type).filter(Boolean))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Previews</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
              <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Generated Today</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.generatedToday}
              </p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
              <Calendar className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Pending</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.pending}
              </p>
            </div>
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-lg">
              <Users className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">With Emails</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {stats.withEmailsSent}
              </p>
            </div>
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
              <Mail className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="no-email">No Email Sent</option>
              <option value="opened">Email Opened</option>
              <option value="customer">Customers</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by business name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {filteredPreviews.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {selectedPreviews.size === filteredPreviews.length
                ? "Deselect All"
                : "Select All"}
            </button>
          )}
        </div>

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedPreviews.size} selected
            </span>
            <button
              onClick={handleBulkSendEmails}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md"
            >
              <Mail className="w-4 h-4" />
              Send Emails
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 shadow-md"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Preview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPreviews.map((preview) => {
          const emailSent = preview.emails.length > 0;
          const emailOpened = preview.emails.some((e) => e.opened_at !== null);
          const linkClicked = preview.emails.some((e) => e.clicked_at !== null);
          const isCustomer = preview.business.claimed_at !== null;

          return (
            <div
              key={preview.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 ${
                selectedPreviews.has(preview.id)
                  ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                  : "border-gray-200 dark:border-gray-700"
              } overflow-hidden hover:shadow-xl transition-all duration-200`}
            >
              {/* Selection Checkbox */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPreviews.has(preview.id)}
                    onChange={() => handleSelectPreview(preview.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select
                  </span>
                </label>
                <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Preview Thumbnail */}
              <div className="relative h-48 bg-gray-100 dark:bg-gray-900 overflow-hidden">
                <iframe
                  src={preview.preview_url}
                  className="w-full h-full pointer-events-none rounded-lg"
                  style={{
                    transform: "scale(0.5)",
                    transformOrigin: "top left",
                    width: "200%",
                    height: "200%",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
              </div>

              {/* Card Content */}
              <div className="p-4">
                {/* Business Name and Category */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {preview.business.business_name}
                  </h3>
                  {preview.business.industry_type && (
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getBusinessTypeColor(
                        preview.business.industry_type
                      )}`}
                    >
                      {preview.business.industry_type}
                    </span>
                  )}
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-full shadow-sm">
                    <CheckCircle className="w-3 h-3" />
                    Preview Ready
                  </span>

                  {emailSent && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full shadow-sm">
                      <Mail className="w-3 h-3" />
                      Email Sent
                    </span>
                  )}

                  {emailOpened && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded-full shadow-sm">
                      <MailOpen className="w-3 h-3" />
                      Opened
                    </span>
                  )}

                  {linkClicked && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs font-medium rounded-full shadow-sm">
                      <MousePointer className="w-3 h-3" />
                      Clicked
                    </span>
                  )}

                  {isCustomer && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded-full shadow-sm">
                      <DollarSign className="w-3 h-3" />
                      Customer
                    </span>
                  )}
                </div>

                {/* Preview URL */}
                <div className="mb-4">
                  <a
                    href={preview.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline flex items-center gap-1 font-medium"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {preview.preview_url
                      .replace("http://localhost:3000/", "")
                      .substring(0, 30)}
                    ...
                  </a>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={preview.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </a>

                  <button
                    onClick={() => handleSendEmail(preview)}
                    disabled={emailSent}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm ${
                      emailSent
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    {emailSent ? "Sent" : "Send"}
                  </button>

                  <button
                    onClick={() => handleCopyLink(preview.preview_url)}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>

                  <button
                    onClick={() => handleDelete(preview.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredPreviews.length === 0 && (
        <div className="text-center py-12">
          <Building className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No previews found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your filters or search term
          </p>
        </div>
      )}
    </div>
  );
}
