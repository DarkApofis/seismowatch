"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState = "unsupported" | "default" | "granted" | "denied";

export interface UseNotificationPermissionResult {
  permission: NotificationPermissionState;
  request: () => Promise<void>;
}

/**
 * Wraps the Notification permission model with an explicit `unsupported` state
 * (some browsers/contexts lack the API) so the UI can branch cleanly across all
 * four cases. Reads the permission in an effect to stay SSR-safe.
 */
export function useNotificationPermission(): UseNotificationPermissionResult {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  return { permission, request };
}
