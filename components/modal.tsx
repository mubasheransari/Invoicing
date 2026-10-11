"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog> element (focus trap, Esc,
 * backdrop). `locked` blocks closing (used while submissions are running).
 */
export function Modal({
  children,
  onClose,
  locked = false,
  labelledBy,
}: {
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
  labelledBy: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault(); // we decide when it closes
        if (!locked) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className="m-auto w-[min(94vw,680px)] rounded-3xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/45 backdrop:backdrop-blur-[2px]"
    >
      {children}
    </dialog>
  );
}
