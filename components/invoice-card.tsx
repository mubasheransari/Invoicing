"use client";

import { useState } from "react";

import { formatDate, formatMoney, plural } from "@/lib/format";
import type { InvoiceView } from "@/lib/types";
import { CheckCircleIcon, ChevronIcon, CloudUploadIcon } from "./icons";
import { ItemsTable } from "./items-table";
import { Badge, Checkbox, Label } from "./ui";

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-xl bg-soft px-3 py-2">
      <span className="text-[10px] font-extrabold tracking-wide text-muted">{label}</span>
      <span className="text-[13px] font-bold">{value || "-"}</span>
    </span>
  );
}

export function InvoiceCard({
  invoice,
  selected,
  busy,
  defaultOpen,
  onSelect,
  onSubmit,
}: {
  invoice: InvoiceView;
  selected: boolean;
  /** true while a submit dialog is open */
  busy: boolean;
  defaultOpen: boolean;
  onSelect: (checked: boolean) => void;
  onSubmit: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const submitted = invoice.submission !== null;
  const title = invoice.gno || invoice.no;

  return (
    <article
      className={`rounded-3xl border bg-surface p-5 transition sm:p-6 ${
        selected ? "border-ink ring-1 ring-ink" : "border-line"
      }`}
      aria-label={`Invoice ${title}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {!submitted && (
          <div className="pt-1.5">
            <Checkbox
              checked={selected}
              onChange={onSelect}
              disabled={busy}
              label={`Select invoice ${title}`}
            />
          </div>
        )}

        <div className="min-w-[8rem] flex-1">
          <Label>GNO</Label>
          <h3 className="mt-1 break-all text-2xl font-extrabold tracking-tight">{title}</h3>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {submitted ? (
            <Badge tone="green">
              <CheckCircleIcon width={14} height={14} />
              Submitted
              {invoice.submission?.fbrNumber ? ` \u2022 ${invoice.submission.fbrNumber}` : ""}
            </Badge>
          ) : (
            <Badge>Ready to submit</Badge>
          )}
          <Badge tone="blue">{plural(invoice.items.length, "item")}</Badge>
        </div>
      </div>

      {/* Details */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Chip label="STN" value={invoice.stn} />
        <Chip label="NO" value={invoice.no} />
        <Chip label="DATE" value={formatDate(invoice.vdate)} />
        <Chip label="SCODE" value={invoice.scode} />
        <Chip label="GST" value={invoice.gstNo} />
        {invoice.docno && <Chip label="DOC NO" value={invoice.docno} />}
      </div>

      {/* Items */}
      <div className="mt-6 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 rounded-lg py-1 text-left"
        >
          <span className="text-sm font-extrabold">Invoice items ({invoice.items.length})</span>
          <ChevronIcon
            className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="mt-3">
            {invoice.items.length > 0 ? (
              <ItemsTable items={invoice.items} />
            ) : (
              <p className="rounded-xl bg-soft px-4 py-6 text-center text-sm font-medium text-muted">
                This invoice has no items.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
        <div>
          <Label>Total amount</Label>
          <p className="mt-1 text-xl font-extrabold tabular-nums">
            {formatMoney(invoice.totalAmount)}
          </p>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitted || busy || invoice.items.length === 0}
          className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-extrabold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:bg-soft disabled:text-muted"
        >
          {submitted ? (
            <CheckCircleIcon width={18} height={18} />
          ) : (
            <CloudUploadIcon width={18} height={18} />
          )}
          {submitted ? "Submitted" : "Submit to FBR"}
        </button>
      </div>
    </article>
  );
}
