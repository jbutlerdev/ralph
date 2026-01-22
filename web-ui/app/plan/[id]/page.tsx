import dynamic from 'next/dynamic';

const PlanDetail = dynamic(() => import('@/components/PlanDetail').then(m => ({ default: m.PlanDetail })), {
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
});

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
 */
export default async function PlanPage({ params }: PlanPageProps) {
  const { id } = await params;

  return (
    <main className="container mx-auto px-4 py-6 sm:py-8 animate-fade-in">
      <PlanDetail planId={id} />
    </main>
  );
}
