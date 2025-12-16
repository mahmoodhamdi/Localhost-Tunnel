import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimisticList, useOptimisticMutation } from '@/hooks/useOptimistic';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

interface TestItem {
  id: string;
  name: string;
  value: number;
  [key: string]: unknown;
}

describe('useOptimisticList Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty array by default', () => {
      const { result } = renderHook(() => useOptimisticList<TestItem>());

      expect(result.current.items).toEqual([]);
      expect(result.current.isPending).toBe(false);
      expect(result.current.pendingId).toBeNull();
    });

    it('should initialize with provided items', () => {
      const initialItems: TestItem[] = [
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 },
      ];

      const { result } = renderHook(() =>
        useOptimisticList<TestItem>(initialItems)
      );

      expect(result.current.items).toEqual(initialItems);
    });
  });

  describe('setItems', () => {
    it('should update items directly', () => {
      const { result } = renderHook(() => useOptimisticList<TestItem>());

      const newItems: TestItem[] = [{ id: '1', name: 'New Item', value: 50 }];

      act(() => {
        result.current.setItems(newItems);
      });

      expect(result.current.items).toEqual(newItems);
    });
  });

  describe('optimisticDelete', () => {
    it('should remove item immediately', async () => {
      const initialItems: TestItem[] = [
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 },
      ];

      const { result } = renderHook(() =>
        useOptimisticList<TestItem>(initialItems)
      );

      const apiCall = vi.fn().mockResolvedValue(undefined);

      await act(async () => {
        await result.current.optimisticDelete('1', apiCall);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('2');
    });

    it('should rollback on API failure', async () => {
      const initialItems: TestItem[] = [
        { id: '1', name: 'Item 1', value: 100 },
        { id: '2', name: 'Item 2', value: 200 },
      ];

      const { result } = renderHook(() =>
        useOptimisticList<TestItem>(initialItems)
      );

      const apiCall = vi.fn().mockRejectedValue(new Error('API Error'));

      await act(async () => {
        await result.current.optimisticDelete('1', apiCall);
      });

      // Item should be restored
      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].id).toBe('1');
    });
  });

  describe('optimisticAdd', () => {
    it('should add item immediately', async () => {
      const { result } = renderHook(() => useOptimisticList<TestItem>());

      const newItem: TestItem = { id: 'temp-1', name: 'New Item', value: 300 };
      const serverItem: TestItem = { id: 'server-1', name: 'New Item', value: 300 };

      const apiCall = vi.fn().mockResolvedValue(serverItem);

      await act(async () => {
        await result.current.optimisticAdd(newItem, apiCall);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].id).toBe('server-1');
    });

    it('should rollback on API failure', async () => {
      const { result } = renderHook(() => useOptimisticList<TestItem>());

      const newItem: TestItem = { id: 'temp-1', name: 'New Item', value: 300 };
      const apiCall = vi.fn().mockRejectedValue(new Error('API Error'));

      await act(async () => {
        await result.current.optimisticAdd(newItem, apiCall);
      });

      // Item should be removed
      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('optimisticUpdate', () => {
    it('should update item immediately', async () => {
      const initialItems: TestItem[] = [
        { id: '1', name: 'Item 1', value: 100 },
      ];

      const { result } = renderHook(() =>
        useOptimisticList<TestItem>(initialItems)
      );

      const serverItem: TestItem = { id: '1', name: 'Updated Item', value: 999 };
      const apiCall = vi.fn().mockResolvedValue(serverItem);

      await act(async () => {
        await result.current.optimisticUpdate('1', { name: 'Updated Item' }, apiCall);
      });

      expect(result.current.items[0].name).toBe('Updated Item');
      expect(result.current.items[0].value).toBe(999);
    });

    it('should rollback on API failure', async () => {
      const initialItems: TestItem[] = [
        { id: '1', name: 'Item 1', value: 100 },
      ];

      const { result } = renderHook(() =>
        useOptimisticList<TestItem>(initialItems)
      );

      const apiCall = vi.fn().mockRejectedValue(new Error('API Error'));

      await act(async () => {
        await result.current.optimisticUpdate('1', { name: 'Updated Item' }, apiCall);
      });

      // Should rollback to original
      expect(result.current.items[0].name).toBe('Item 1');
      expect(result.current.items[0].value).toBe(100);
    });
  });

  describe('Pending State', () => {
    it('should track pending state during operations', async () => {
      const { result } = renderHook(() => useOptimisticList<TestItem>());

      const newItem: TestItem = { id: 'temp-1', name: 'New', value: 1 };

      let resolveFn: (value: TestItem) => void;
      const apiCall = vi.fn().mockImplementation(
        () =>
          new Promise<TestItem>((resolve) => {
            resolveFn = resolve;
          })
      );

      // Start the operation
      act(() => {
        result.current.optimisticAdd(newItem, apiCall);
      });

      // Should be pending
      expect(result.current.isPending).toBe(true);
      expect(result.current.pendingId).toBe('temp-1');

      // Resolve the promise
      await act(async () => {
        resolveFn!({ id: 'server-1', name: 'New', value: 1 });
      });

      // Should no longer be pending
      expect(result.current.isPending).toBe(false);
      expect(result.current.pendingId).toBeNull();
    });
  });

  describe('Custom ID Key', () => {
    interface CustomIdItem {
      customId: string;
      name: string;
      [key: string]: unknown;
    }

    it('should use custom ID key', async () => {
      const initialItems: CustomIdItem[] = [
        { customId: 'custom-1', name: 'Item 1' },
        { customId: 'custom-2', name: 'Item 2' },
      ];

      const { result } = renderHook(() =>
        useOptimisticList<CustomIdItem>(initialItems, 'customId')
      );

      const apiCall = vi.fn().mockResolvedValue(undefined);

      await act(async () => {
        await result.current.optimisticDelete('custom-1', apiCall);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].customId).toBe('custom-2');
    });
  });
});

describe('useOptimisticMutation Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful Mutation', () => {
    it('should return result on success', async () => {
      const { result } = renderHook(() => useOptimisticMutation<unknown, string>());

      const apiCall = vi.fn().mockResolvedValue('success');

      let mutationResult: string | null = null;

      await act(async () => {
        mutationResult = await result.current.mutate(apiCall);
      });

      expect(mutationResult).toBe('success');
      expect(result.current.error).toBeNull();
    });

    it('should call onSuccess callback', async () => {
      const { result } = renderHook(() => useOptimisticMutation<unknown, string>());

      const apiCall = vi.fn().mockResolvedValue('success');
      const onSuccess = vi.fn();

      await act(async () => {
        await result.current.mutate(apiCall, { onSuccess });
      });

      expect(onSuccess).toHaveBeenCalledWith('success');
    });
  });

  describe('Failed Mutation', () => {
    it('should return null on failure', async () => {
      const { result } = renderHook(() => useOptimisticMutation<unknown, string>());

      const apiCall = vi.fn().mockRejectedValue(new Error('API Error'));

      let mutationResult: string | null = null;

      await act(async () => {
        mutationResult = await result.current.mutate(apiCall);
      });

      expect(mutationResult).toBeNull();
      expect(result.current.error).toBeDefined();
    });

    it('should call onError callback', async () => {
      const { result } = renderHook(() => useOptimisticMutation<unknown, string>());

      const error = new Error('API Error');
      const apiCall = vi.fn().mockRejectedValue(error);
      const onError = vi.fn();

      await act(async () => {
        await result.current.mutate(apiCall, { onError });
      });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('Pending State', () => {
    it('should track pending state during mutation', async () => {
      const { result } = renderHook(() => useOptimisticMutation<unknown, string>());

      let resolveFn: (value: string) => void;
      const apiCall = vi.fn().mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveFn = resolve;
          })
      );

      // Start the mutation
      act(() => {
        result.current.mutate(apiCall);
      });

      // Should be pending
      expect(result.current.isPending).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolveFn!('done');
      });

      // Should no longer be pending
      expect(result.current.isPending).toBe(false);
    });
  });
});
