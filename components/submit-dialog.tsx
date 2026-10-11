"use client";

import { useEffect, useRef, useState } from "react";

import { submitInvoice } from "@/lib/client-api";
import { formatMoney, plural } from "@/lib/format";
import type { InvoiceView } from "@/lib/types";
import { AlertIcon, CheckCircleIcon, CloudUploadIcon, SpinnerIcon } from "./icons";
import { Modal } from "./modal";

type RowState = {
  state: "pending" | "sending" | "ok" | "already" | "error";
  message?: string;
  fbrNumber?: string;
};

type Phase = "confirm" | "running" | "done";

export function SubmitDialog({
  targets,
  onSubmitted,
  onClose,
}: {
  /** Snapshot of the invoices to submit (does not change while running). */
  targets: InvoiceView[];
  onSubmitted: (key: string, fbrNumber: string) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(targets.map((t) => [t.key, { state: "pending" } as RowState])),
  );

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patch = (key: string, row: RowState) =>
    setRows((prev) => ({ ...prev, [key]: row }));

  /** Sends the invoices one at a time (safest for the FBR gateway). */
  async function run(keys: string[]) {
    setPhase("running");

    for (const key of keys) {
      if (!alive.current) return;
      patch(key, { state: "sending" });

      const res = await submitInvoice(key);
      if (!alive.current) return;

      if (res.ok) {
        patch(key, {
          state: "ok",
          fbrNumber: res.data.fbrNumber,
          message: res.data.persisted
            ? undefined
            : "Accepted by FBR, but the record could not be saved on the server. Note the FBR number.",
        });
        onSubmitted(key, res.data.fbrNumber);
      } else if (res.code === "already_submitted") {
        patch(key, { state: "already", fbrNumber: res.fbrNumber });
        onSubmitted(key, res.fbrNumber ?? "");
      } else {
        patch(key, { state: "error", message: res.error });
      }
    }

    setPhase("done");
  }

  const total = targets.length;
  const states = Object.values(rows);
  const finished = states.filter((r) => r.state !== "pending" && r.state !== "sending").length;
  const sent = states.filter((r) => r.state === "ok" || r.state === "already").length;
  const failedKeys = targets.filter((t) => rows[t.key]?.state === "error").map((t) => t.key);
  const locked = phase === "running";

  return (
    <Modal onClose={onClose} locked={locked} labelledBy="submit-title">
      <div className="p-6 sm:p-7">
        <h2 id="submit-title" className="text-xl font-extrabold tracking-tight">
          {phase === "confirm" && "Submit to FBR"}
          {phase === "running" && `Submitting ${Math.min(finished + 1, total)} of ${total}...`}
          {phase === "done" &&
            (failedKeys.length === 0
              ? `${plural(sent, "invoice")} submitted`
              : `${sent} sent, ${failedKeys.length} failed`)}
        </h2>

        <p className="mt-1.5 text-sm font-medium text-muted" aria-live="polite">
          {phase === "confirm" &&
            `You are about to submit ${plural(total, "invoice")} to FBR. Submitted invoices cannot be sent again.`}
          {phase === "running" && "Please keep this window open until it finishes."}
          {phase === "done" &&
            (failedKeys.length === 0
              ? "FBR accepted everything."
              : "Failed invoices were not recorded as submitted, so you can retry them.")}
        </p>

        {phase !== "confirm" && (
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-soft"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={finished}
          >
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{ width: `${(finished / total) * 100}%` }}
            />
          </div>
        )}

        <ul className="mt-5 max-h-[45vh] divide-y divide-line overflow-y-auto rounded-2xl border border-line">
          {targets.map((t) => {
            const row = rows[t.key];
            return (
              <li key={t.key} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 shrink-0">
                  {row.state === "sending" && (
                    <SpinnerIcon width={18} height={18} className="text-ink" />
                  )}
                  {(row.state === "ok" || row.state === "already") && (
                    <CheckCircleIcon width={18} height={18} className="text-brand" />
                  )}
                  {row.state === "error" && (
                    <AlertIcon width={18} height={18} className="text-danger" />
                  )}
                  {row.state === "pending" && (
                    <span className="block size-[18px] rounded-full border-2 border-line" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-extrabold">{t.gno || t.no}</p>
                  <p className="text-xs font-medium text-muted">
                    {plural(t.items.length, "item")} &middot; {formatMoney(t.totalAmount)}
                  </p>

                  {row.state === "ok" && row.fbrNumber && (
                    <p className="mt-1 text-xs font-bold text-brand">FBR no. {row.fbrNumber}</p>
                  )}
                  {row.state === "already" && (
                    <p className="mt-1 text-xs font-bold text-brand">
                      Already submitted{row.fbrNumber ? ` (FBR no. ${row.fbrNumber})` : ""}
                    </p>
                  )}
                  {row.message && (
                    <p
                      className={`mt-1 whitespace-pre-line text-xs font-semibold ${
                        row.state === "error" ? "text-danger" : "text-warn"
                      }`}
                    >
                      {row.message}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {phase === "confirm" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl border border-line px-5 text-sm font-bold transition hover:bg-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => run(targets.map((t) => t.key))}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white transition hover:bg-brand/90"
              >
                <CloudUploadIcon width={18} height={18} />
                Submit {plural(total, "invoice")}
              </button>
            </>
          )}

          {phase === "done" && (
            <>
              {failedKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => run(failedKeys)}
                  className="h-11 rounded-xl border border-line px-5 text-sm font-bold transition hover:bg-soft"
                >
                  Retry failed ({failedKeys.length})
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl bg-ink px-6 text-sm font-extrabold text-white transition hover:bg-ink/85"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
