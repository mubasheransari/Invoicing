"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Checkbox({
  checked,
  indeterminate = false,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="size-5 shrink-0 cursor-pointer rounded-md border-line accent-ink disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

const TONES = {
  green: "bg-brand-soft text-brand",
  blue: "bg-info-soft text-info",
  red: "bg-danger-soft text-danger",
  orange: "bg-warn-soft text-warn",
  neutral: "bg-soft text-muted",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
      {children}
    </span>
  );
}

export function StateCard({
  icon,
  title,
  message,
  tone = "neutral",
  action,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  tone?: "neutral" | "red" | "orange";
  action?: ReactNode;
}) {
  const color =
    tone === "red" ? "text-danger" : tone === "orange" ? "text-warn" : "text-muted";
  return (
    <div
      className="rounded-3xl border border-line bg-surface px-6 py-12 text-center"
      role={tone === "red" ? "alert" : "status"}
    >
      <div className={`mx-auto mb-3 grid size-12 place-items-center ${color}`}>{icon}</div>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md whitespace-pre-line text-sm font-medium leading-relaxed text-muted">
        {message}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
