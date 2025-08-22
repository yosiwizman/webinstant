import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard - WebInstant',
  description: 'Manage your website generation business',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {children}
    </div>
  );
}
