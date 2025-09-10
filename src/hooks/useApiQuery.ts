/**
 * Enhanced query hooks with error handling and loading states
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ApiService } from '@/services/api';

export function useApiQuery<T>(
  key: (string | number | boolean)[], 
  queryFn: () => Promise<T>,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    errorMessage?: string;
  }
) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await queryFn();
      } catch (error) {
        ApiService.handleError(error, `query_${key.join('_')}`, options?.errorMessage);
        throw error;
      }
    },
    enabled: options?.enabled,
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes default
  });
}

export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: any, variables: TVariables) => void;
    invalidateQueries?: (string | number | boolean)[][];
    errorMessage?: string;
    successMessage?: string;
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: TVariables) => {
      try {
        return await mutationFn(variables);
      } catch (error) {
        ApiService.handleError(error, 'mutation', options?.errorMessage);
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      options?.onSuccess?.(data, variables);
      
      // Invalidate related queries
      options?.invalidateQueries?.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
    },
    onError: options?.onError,
  });
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient();
  
  return useCallback((queryKeys: (string | number | boolean)[][]) => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }, [queryClient]);
}