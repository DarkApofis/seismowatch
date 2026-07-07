"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EarthquakeEvent } from "@/features/earthquakes/types";
import { matchesAnyRule } from "../matching";
import type { AlertRule } from "../types";
import type { NotificationPermissionState } from "./useNotificationPermission";

const TOAST_TTL_MS = 8000;

export interface AlertToast {
  id: string;
  title: string;
  body: string;
  event: EarthquakeEvent;
}

export interface UseAlertDispatcherArgs {
  /** New events from the feed notifier (a fresh array per poll). */
  newEvents: readonly EarthquakeEvent[];
  rules: readonly AlertRule[];
  permission: NotificationPermissionState;
  /** Focuses/selects the event when a notification or toast is clicked. */
  onSelect: (event: EarthquakeEvent) => void;
}

export interface UseAlertDispatcherResult {
  toasts: AlertToast[];
  dismiss: (id: string) => void;
}

function describe(event: EarthquakeEvent): { title: string; body: string } {
  const magnitude = event.magnitude === null ? "—" : `M ${event.magnitude.toFixed(1)}`;
  return {
    title: `${magnitude} — ${event.place ?? "Unknown location"}`,
    body: event.title,
  };
}

/**
 * Fires alerts for newly-arrived events that match an enabled rule.
 *
 * Delivery depends on tab visibility (a system Notification for a quake you're
 * already looking at would be noise): when the tab is visible we show an in-app
 * toast; when it's hidden and permission is granted we post a system
 * Notification whose click focuses the app and selects the event.
 *
 * `rules`, `permission`, and `onSelect` are read through refs so the effect
 * only runs when a genuinely new `newEvents` batch arrives — toggling a rule
 * must not replay alerts for the current batch.
 */
export function useAlertDispatcher({
  newEvents,
  rules,
  permission,
  onSelect,
}: UseAlertDispatcherArgs): UseAlertDispatcherResult {
  const [toasts, setToasts] = useState<AlertToast[]>([]);

  const rulesRef = useRef(rules);
  rulesRef.current = rules;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: AlertToast) => {
      setToasts((prev) => (prev.some((t) => t.id === toast.id) ? prev : [...prev, toast]));
      window.setTimeout(() => dismiss(toast.id), TOAST_TTL_MS);
    },
    [dismiss],
  );

  useEffect(() => {
    if (newEvents.length === 0) return;
    const enabled = rulesRef.current.filter((rule) => rule.enabled);
    if (enabled.length === 0) return;

    const tabVisible = typeof document !== "undefined" && document.visibilityState === "visible";

    for (const event of newEvents) {
      if (!matchesAnyRule(event, enabled)) continue;
      const { title, body } = describe(event);

      if (!tabVisible && permissionRef.current === "granted" && "Notification" in window) {
        const notification = new Notification(title, { body, tag: event.id });
        notification.onclick = () => {
          window.focus();
          onSelectRef.current(event);
          notification.close();
        };
      } else {
        pushToast({ id: event.id, title, body, event });
      }
    }
    // Only re-run for a new batch; rules/permission/onSelect are read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newEvents]);

  return { toasts, dismiss };
}
