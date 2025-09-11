'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = theme === 'system' ? systemTheme : theme;

  if (!mounted) {
    return (
      <button
        className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg transition-all duration-200 hover:shadow-xl"
        aria-label="Toggle theme"
      >
        <div className="w-5 h-5" />
      </button>
    );
  }

  return (
    <select
      aria-label="Theme"
      value={theme || 'system'}
      onChange={(e) => setTheme(e.target.value)}
      className="border rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  );
}
