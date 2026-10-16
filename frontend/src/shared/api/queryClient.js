import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide TanStack Query client. Lets plain (non-hook) loaders share cached
 * server data and de-duplicate concurrent requests via fetchQuery.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: false,
    },
  },
});

export const queryKeys = {
  systemTemplates: ['gameTemplates', 'system'],
};
