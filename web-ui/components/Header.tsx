'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Moon, Sun, Loader2, LayoutDashboard } from 'lucide-react';
import { Button } from './ui/button';
import { useEffect, useState } from 'react';

/**
 * Header Component
 *
 * Application header with:
 * - Logo and navigation
 * - Theme toggle button (light/dark/system)
 * - Responsive design with mobile support
 */
export function Header() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('system');
    } else {
      setTheme('dark');
    }
  };

  const getThemeIcon = () => {
    if (!mounted) {
      return <Loader2 className="h-5 w-5 animate-spin" />;
    }
    if (theme === 'dark') {
      return <Moon className="h-5 w-5" />;
    }
    if (theme === 'light') {
      return <Sun className="h-5 w-5" />;
    }
    return <Loader2 className="h-5 w-5 animate-spin" />;
  };

  const getThemeLabel = () => {
    if (!mounted) return 'Loading...';
    if (theme === 'dark') return 'Dark mode';
    if (theme === 'light') return 'Light mode';
    return 'System';
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-semibold hover:text-primary transition-colors"
            >
              <LayoutDashboard className="h-6 w-6" />
              <span className="hidden sm:inline-block">Ralph</span>
            </Link>
          </div>

          {/* Theme Toggle */}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={getThemeLabel()}
              title={getThemeLabel()}
              className="relative"
            >
              {getThemeIcon()}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
