import { useQuery } from '@tanstack/react-query';
import { getReportsPingApi } from '@/api/reports.api';

export function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'ping'],
    queryFn: getReportsPingApi,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        {isLoading && 'Checking database connection...'}
        {!isLoading && data?.connected && 'Connected to the CoShare database.'}
        {!isLoading && !data?.connected && 'Unable to reach the database.'}
      </div>
    </div>
  );
}
