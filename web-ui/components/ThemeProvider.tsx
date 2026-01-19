'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

/**
 * ThemeProvider Component
 *
 * Wraps the application with next-themes provider to enable:
 * - Light/dark mode switching
 * - System preference detection
 * - Persistent theme storage in localStorage
 * - Prevents flash of wrong theme (FOUC)
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
