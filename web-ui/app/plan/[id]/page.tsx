import { PlanDetail } from '@/components/PlanDetail';

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
