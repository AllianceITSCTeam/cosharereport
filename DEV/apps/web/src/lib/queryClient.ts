import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 401/403/404
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error
        ) {
          const status = (error as { response?: { status?: number } }).response?.status;
          if (status === 401 || status === 403 || status === 404) {
            return false;
          }
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
