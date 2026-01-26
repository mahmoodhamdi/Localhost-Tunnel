import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, type Toast } from '../../src/hooks/use-toast';

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with empty toasts array', () => {
      const { result } = renderHook(() => useToast());
      expect(result.current.toasts).toEqual([]);
    });
  });

  describe('toast', () => {
    it('should add a toast with title', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test Toast' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Test Toast');
    });

    it('should add a toast with description', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: 'Title',
          description: 'Description text',
        });
      });

      expect(result.current.toasts[0].description).toBe('Description text');
    });

    it('should add a toast with default variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      expect(result.current.toasts[0].variant).toBe('default');
    });

    it('should add a toast with destructive variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({
          title: 'Error',
          variant: 'destructive',
        });
      });

      expect(result.current.toasts[0].variant).toBe('destructive');
    });

    it('should return toast id', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        toastId = result.current.toast({ title: 'Test' });
      });

      expect(toastId!).toBeDefined();
      expect(result.current.toasts[0].id).toBe(toastId!);
    });

    it('should add multiple toasts', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
        result.current.toast({ title: 'Toast 3' });
      });

      expect(result.current.toasts).toHaveLength(3);
    });

    it('should auto-dismiss toast after 5 seconds', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Auto-dismiss test' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should not dismiss other toasts when one auto-dismisses', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Toast 1' });
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        result.current.toast({ title: 'Toast 2' });
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // First toast should be dismissed, second should remain
      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 2');
    });
  });

  describe('dismiss', () => {
    it('should dismiss a specific toast by id', () => {
      const { result } = renderHook(() => useToast());

      let toastId: string;
      act(() => {
        toastId = result.current.toast({ title: 'Toast to dismiss' });
      });

      expect(result.current.toasts).toHaveLength(1);

      act(() => {
        result.current.dismiss(toastId);
      });

      expect(result.current.toasts).toHaveLength(0);
    });

    it('should only dismiss the specified toast', () => {
      const { result } = renderHook(() => useToast());

      let toastId1: string;
      act(() => {
        toastId1 = result.current.toast({ title: 'Toast 1' });
        result.current.toast({ title: 'Toast 2' });
      });

      act(() => {
        result.current.dismiss(toastId1);
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Toast 2');
    });

    it('should handle dismissing non-existent toast', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        result.current.toast({ title: 'Test' });
      });

      act(() => {
        result.current.dismiss('non-existent-id');
      });

      expect(result.current.toasts).toHaveLength(1);
    });
  });

  describe('id generation', () => {
    it('should generate unique ids for each toast', () => {
      const { result } = renderHook(() => useToast());

      const ids: string[] = [];
      act(() => {
        ids.push(result.current.toast({ title: 'Toast 1' }));
        ids.push(result.current.toast({ title: 'Toast 2' }));
        ids.push(result.current.toast({ title: 'Toast 3' }));
      });

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});
