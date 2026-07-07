"use client";

import type { AlertToast } from "../hooks/useAlertDispatcher";

export interface AlertToastsProps {
  toasts: AlertToast[];
  onDismiss: (id: string) => void;
  onSelect: (toast: AlertToast) => void;
}

/**
 * In-app alert toasts, shown (instead of a system Notification) when the tab is
 * visible. Clicking a toast selects the event; each also auto-dismisses.
 */
export function AlertToasts({ toasts, onDismiss, onSelect }: AlertToastsProps) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-72 flex-col gap-2"
      role="region"
      aria-label="Alerts"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="border-border bg-surface-2 pointer-events-auto flex items-start gap-2 rounded-lg border p-3 shadow-xl"
        >
          <button type="button" onClick={() => onSelect(toast)} className="flex-1 text-left">
            <p className="text-fg text-sm font-semibold tabular-nums">{toast.title}</p>
            <p className="text-fg-secondary mt-0.5 text-xs">{toast.body}</p>
          </button>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss alert"
            className="text-fg-muted hover:text-fg"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
