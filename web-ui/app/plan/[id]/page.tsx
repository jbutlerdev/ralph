import { PlanDetailClient } from '@/components/PlanDetailClient';

interface PlanPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Plan Detail Page
 *
 * Displays a detailed view of a specific implementation plan including:
 * - Project overview
 * - Progress indicator
 * - Task list with filtering and sorting
 * - Validation warnings (if any)
 *
 * The heavy client-only PlanDetail (websockets/polling; ssr:false) is
 * loaded via a Client Component wrapper — Next 16 disallows
 * `next/dynamic` with `ssr: false` directly in Server Components.
 */
export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;

  return (
    <main className="container mx-auto px-4 py-6 sm:py-8 animate-fade-in">
      <PlanDetailClient planId={id} />
    </main>
  );
}
