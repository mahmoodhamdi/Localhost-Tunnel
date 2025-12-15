'use client';

import { useState, useCallback } from 'react';

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
}

let toastCount = 0;

function generateId() {
  toastCount = (toastCount + 1) % Number.MAX_SAFE_INTEGER;
  return toastCount.toString();
}

// Simple toast hook for notifications
export function useToast() {
  const [state, setState] = useState<ToastState>({ toasts: [] });

  const toast = useCallback(
    ({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
      const id = generateId();
      const newToast: Toast = { id, title, description, variant };

      setState((prev) => ({
        toasts: [...prev.toasts, newToast],
      }));

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setState((prev) => ({
          toasts: prev.toasts.filter((t) => t.id !== id),
        }));
      }, 5000);

      return id;
    },
    []
  );

  const dismiss = useCallback((toastId: string) => {
    setState((prev) => ({
      toasts: prev.toasts.filter((t) => t.id !== toastId),
    }));
  }, []);

  return {
    toast,
    dismiss,
    toasts: state.toasts,
  };
}
