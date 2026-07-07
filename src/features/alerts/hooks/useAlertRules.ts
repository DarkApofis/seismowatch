"use client";

import { useCallback, useEffect, useState } from "react";
import { ALERT_RULES_STORAGE_KEY, parseStoredRules, serializeRules } from "../storage";
import type { AlertRule } from "../types";

export interface UseAlertRulesResult {
  rules: AlertRule[];
  /** True once the initial load from localStorage has run (client-only). */
  isLoaded: boolean;
  addRule: (rule: Omit<AlertRule, "id">) => void;
  updateRule: (id: string, patch: Partial<Omit<AlertRule, "id">>) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
}

/**
 * Alert rules persisted in localStorage under a versioned schema.
 *
 * The list loads in an effect (never during render) so server and first client
 * render agree — avoiding hydration mismatch — and is written back whenever it
 * changes. Parsing/serialization are the pure, tested functions in `storage.ts`.
 */
export function useAlertRules(): UseAlertRulesResult {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setRules(parseStoredRules(window.localStorage.getItem(ALERT_RULES_STORAGE_KEY)));
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // Don't clobber stored rules with the empty initial state before load.
    if (!isLoaded) return;
    window.localStorage.setItem(ALERT_RULES_STORAGE_KEY, serializeRules(rules));
  }, [rules, isLoaded]);

  const addRule = useCallback((rule: Omit<AlertRule, "id">) => {
    setRules((prev) => [...prev, { ...rule, id: crypto.randomUUID() }]);
  }, []);

  const updateRule = useCallback((id: string, patch: Partial<Omit<AlertRule, "id">>) => {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)),
    );
  }, []);

  return { rules, isLoaded, addRule, updateRule, removeRule, toggleRule };
}
