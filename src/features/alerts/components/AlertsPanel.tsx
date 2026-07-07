"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { NotificationPermissionState } from "../hooks/useNotificationPermission";
import type { AlertRule, BoundingBox } from "../types";

export interface AlertsPanelProps {
  rules: AlertRule[];
  permission: NotificationPermissionState;
  onRequestPermission: () => void;
  onAdd: (rule: Omit<AlertRule, "id">) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  /** Latest map viewport, used for the "current view" region option. */
  currentBounds: BoundingBox | null;
}

const fieldClass =
  "rounded border border-border bg-surface-2 px-2 py-1 text-sm text-fg outline-none focus-visible:ring-1 focus-visible:ring-accent";

function ruleDescription(rule: AlertRule): string {
  const region = rule.region ? "in a region" : "worldwide";
  return `M${rule.minMagnitude.toFixed(1)}+ ${region}`;
}

export function AlertsPanel({
  rules,
  permission,
  onRequestPermission,
  onAdd,
  onToggle,
  onRemove,
  currentBounds,
}: AlertsPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const enabledCount = rules.filter((rule) => rule.enabled).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className={fieldClass}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Alerts{enabledCount > 0 ? ` (${enabledCount})` : ""}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Alert rules"
          className="border-border bg-surface-1 absolute right-0 z-50 mt-2 w-80 rounded-lg border p-3 shadow-xl"
        >
          <PermissionNotice permission={permission} onRequestPermission={onRequestPermission} />
          <CreateRuleForm onAdd={onAdd} currentBounds={currentBounds} />
          <RuleList rules={rules} onToggle={onToggle} onRemove={onRemove} />
        </div>
      ) : null}
    </div>
  );
}

function PermissionNotice({
  permission,
  onRequestPermission,
}: {
  permission: NotificationPermissionState;
  onRequestPermission: () => void;
}) {
  if (permission === "granted") {
    return <p className="text-fg-muted mb-3 text-xs">System notifications are on.</p>;
  }
  if (permission === "denied") {
    return (
      <p className="mb-3 text-xs text-amber-400">
        Notifications are blocked. Re-enable them in your browser’s site settings. In-app alerts
        will still show while this tab is open.
      </p>
    );
  }
  if (permission === "unsupported") {
    return (
      <p className="text-fg-muted mb-3 text-xs">
        This browser doesn’t support system notifications; in-app alerts will be used.
      </p>
    );
  }
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-fg-muted text-xs">Get notified even when the tab is hidden.</span>
      <button
        type="button"
        onClick={onRequestPermission}
        className="bg-accent text-surface-0 rounded px-2 py-1 text-xs font-medium"
      >
        Enable
      </button>
    </div>
  );
}

function CreateRuleForm({
  onAdd,
  currentBounds,
}: {
  onAdd: (rule: Omit<AlertRule, "id">) => void;
  currentBounds: BoundingBox | null;
}) {
  const [minMagnitude, setMinMagnitude] = useState(4.5);
  const [useCurrentView, setUseCurrentView] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const region = useCurrentView ? currentBounds : null;
    onAdd({
      label: "",
      minMagnitude,
      region,
      enabled: true,
    });
    setUseCurrentView(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border-border mb-3 flex flex-col gap-2 border-b pb-3">
      <label className="text-fg-muted flex items-center justify-between gap-2 text-xs">
        Minimum magnitude
        <span className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={minMagnitude}
            onChange={(event) => setMinMagnitude(Number(event.target.value))}
            className="accent-accent"
            aria-label="Minimum magnitude"
          />
          <span className="text-fg w-8 tabular-nums">{minMagnitude.toFixed(1)}</span>
        </span>
      </label>

      <label className="text-fg-muted flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={useCurrentView}
          disabled={currentBounds === null}
          onChange={(event) => setUseCurrentView(event.target.checked)}
          className="accent-accent"
        />
        Restrict to current map view
        {currentBounds === null ? <span className="text-fg-muted">(map loading…)</span> : null}
      </label>

      <button
        type="submit"
        className="bg-accent text-surface-0 self-start rounded px-3 py-1 text-xs font-medium"
      >
        Add rule
      </button>
    </form>
  );
}

function RuleList({
  rules,
  onToggle,
  onRemove,
}: {
  rules: AlertRule[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (rules.length === 0) {
    return <p className="text-fg-muted text-xs">No rules yet. Add one above.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {rules.map((rule) => (
        <li key={rule.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={() => onToggle(rule.id)}
            className="accent-accent"
            aria-label={`Enable ${ruleDescription(rule)}`}
          />
          <span className={`flex-1 tabular-nums ${rule.enabled ? "text-fg" : "text-fg-muted"}`}>
            {ruleDescription(rule)}
          </span>
          <button
            type="button"
            onClick={() => onRemove(rule.id)}
            aria-label={`Delete ${ruleDescription(rule)}`}
            className="text-fg-muted hover:text-red-400"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
