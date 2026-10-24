'use client';

import dynamic from 'next/dynamic';

/**
 * Client-component wrapper for the dynamically imported PlanDetail.
 *
 * Next.js 16 forbids `ssr: false` with `next/dynamic` inside Server
 * Components, so the client-only dynamic import lives here and the
 * server page (app/plan/[id]/page.tsx) renders <PlanDetailClient />.
 * Same code as before the Next 16 migration — just relocated to the
 * client boundary (the official pattern).
 */
export const PlanDetailClient = dynamic(
  () => import('@/components/PlanDetail').then((m) => ({ default: m.PlanDetail })),
  {
    ssr: false,
    loading: () => (
      <main className="container mx-auto px-4 py-6 sm:py-8 animate-fade-in">
        <div className="flex min-h-[600px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-foreground" />
            <p className="mt-4 text-lg text-muted-foreground">Loading plan details...</p>
          </div>
        </div>
      </main>
    ),
  },
);
