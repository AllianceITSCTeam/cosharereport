import { useQuery } from '@tanstack/react-query';
import { getLatestUsersApi } from '@/api/reports.api';
import { formatDateTime } from '@/lib/dateFormat';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function LatestUsersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reports', 'latest-users'],
    queryFn: getLatestUsersApi,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Latest Users</h1>
        <p className="text-sm text-muted-foreground">The 10 most recently created accounts.</p>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading && (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        )}

        {isError && (
          <div className="p-6 text-sm text-destructive">Failed to load report data.</div>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">No users found.</div>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created At</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Username</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((user) => (
                <TableRow key={`${user.Username}-${user.Log_CreatedDate}`}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(user.Log_CreatedDate)}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{user.DisplayName}</TableCell>
                  <TableCell className="text-muted-foreground">{user.Username}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
