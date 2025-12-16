import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface OptimisticOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseOptimisticListReturn<T> {
  items: T[];
  setItems: (items: T[]) => void;
  isPending: boolean;
  pendingId: string | null;
  optimisticAdd: (
    newItem: T,
    apiCall: () => Promise<T>,
    options?: OptimisticOptions<T>
  ) => Promise<void>;
  optimisticUpdate: (
    id: string,
    updates: Partial<T>,
    apiCall: () => Promise<T>,
    options?: OptimisticOptions<T>
  ) => Promise<void>;
  optimisticDelete: (
    id: string,
    apiCall: () => Promise<void>,
    options?: OptimisticOptions<void>
  ) => Promise<void>;
}

/**
 * Hook for managing optimistic updates on a list of items.
 * Provides immediate UI updates with automatic rollback on failure.
 *
 * @param initialItems - Initial array of items
 * @param idKey - Key to use for identifying items (default: 'id')
 */
export function useOptimisticList<T extends object>(
  initialItems: T[] = [],
  idKey: keyof T = 'id' as keyof T
): UseOptimisticListReturn<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isPending, setIsPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const optimisticAdd = useCallback(
    async (
      newItem: T,
      apiCall: () => Promise<T>,
      options: OptimisticOptions<T> = {}
    ) => {
      const tempId = newItem[idKey] as string;

      // Optimistically add the item
      setItems((prev) => [...prev, newItem]);
      setIsPending(true);
      setPendingId(tempId);

      try {
        const result = await apiCall();
        // Replace temp item with actual result
        setItems((prev) =>
          prev.map((item) =>
            item[idKey] === tempId ? result : item
          )
        );
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        options.onSuccess?.(result);
      } catch (error) {
        // Rollback: remove the optimistically added item
        setItems((prev) => prev.filter((item) => item[idKey] !== tempId));
        const errorMsg = options.errorMessage || 'Operation failed';
        toast.error(errorMsg);
        options.onError?.(error as Error);
      } finally {
        setIsPending(false);
        setPendingId(null);
      }
    },
    [idKey]
  );

  const optimisticUpdate = useCallback(
    async (
      id: string,
      updates: Partial<T>,
      apiCall: () => Promise<T>,
      options: OptimisticOptions<T> = {}
    ) => {
      // Store original item for rollback
      const originalItem = items.find((item) => item[idKey] === id);
      if (!originalItem) return;

      // Optimistically update
      setItems((prev) =>
        prev.map((item) =>
          item[idKey] === id ? { ...item, ...updates } : item
        )
      );
      setIsPending(true);
      setPendingId(id);

      try {
        const result = await apiCall();
        // Update with actual result
        setItems((prev) =>
          prev.map((item) => (item[idKey] === id ? result : item))
        );
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        options.onSuccess?.(result);
      } catch (error) {
        // Rollback to original
        setItems((prev) =>
          prev.map((item) => (item[idKey] === id ? originalItem : item))
        );
        const errorMsg = options.errorMessage || 'Update failed';
        toast.error(errorMsg);
        options.onError?.(error as Error);
      } finally {
        setIsPending(false);
        setPendingId(null);
      }
    },
    [items, idKey]
  );

  const optimisticDelete = useCallback(
    async (
      id: string,
      apiCall: () => Promise<void>,
      options: OptimisticOptions<void> = {}
    ) => {
      // Store original item for rollback
      const originalItem = items.find((item) => item[idKey] === id);
      const originalIndex = items.findIndex((item) => item[idKey] === id);
      if (!originalItem) return;

      // Optimistically remove
      setItems((prev) => prev.filter((item) => item[idKey] !== id));
      setIsPending(true);
      setPendingId(id);

      try {
        await apiCall();
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        options.onSuccess?.();
      } catch (error) {
        // Rollback: restore the item at its original position
        setItems((prev) => {
          const newItems = [...prev];
          newItems.splice(originalIndex, 0, originalItem);
          return newItems;
        });
        const errorMsg = options.errorMessage || 'Delete failed';
        toast.error(errorMsg);
        options.onError?.(error as Error);
      } finally {
        setIsPending(false);
        setPendingId(null);
      }
    },
    [items, idKey]
  );

  return {
    items,
    setItems,
    isPending,
    pendingId,
    optimisticAdd,
    optimisticUpdate,
    optimisticDelete,
  };
}

/**
 * Hook for managing a single optimistic mutation.
 * Useful for update/delete operations on a single item.
 */
export function useOptimisticMutation<T, R = T>() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (
      apiCall: () => Promise<R>,
      options: OptimisticOptions<R> = {}
    ): Promise<R | null> => {
      setIsPending(true);
      setError(null);

      try {
        const result = await apiCall();
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        const errorMsg = options.errorMessage || 'Operation failed';
        toast.error(errorMsg);
        options.onError?.(error);
        return null;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return { mutate, isPending, error };
}
