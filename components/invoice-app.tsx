"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { searchInvoices, type SearchInput } from "@/lib/client-api";
import { plural } from "@/lib/format";
import type { InvoiceView } from "@/lib/types";
import { AlertIcon, CloudUploadIcon, SearchIcon, SpinnerIcon } from "./icons";
import { InvoiceCard } from "./invoice-card";
import { SearchForm } from "./search-form";
import { SubmitDialog } from "./submit-dialog";
import { Badge, Checkbox, StateCard } from "./ui";

type View =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty"; message: string }
  | { kind: "ready" };

export function InvoiceApp() {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [environment, setEnvironment] = useState("");
  const [warning, setWarning] = useState<string | undefined>();
  const [dialogTargets, setDialogTargets] = useState<InvoiceView[] | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastSearch = useRef<SearchInput | null>(null);

  const search = useCallback(async (input: SearchInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastSearch.current = input;

    setView({ kind: "loading" });
    setInvoices([]);
    setSelected(new Set());
    setWarning(undefined);

    const res = await searchInvoices(input, controller.signal);
    if (controller.signal.aborted) return; // a newer search replaced this one

    if (res.ok) {
      setInvoices(res.data.invoices);
      setEnvironment(res.data.environment);
      setWarning(res.data.warning);
      setView({ kind: "ready" });
    } else if (res.status === 404) {
      setView({ kind: "empty", message: res.error });
    } else {
      setView({ kind: "error", message: res.error });
    }
  }, []);

  const pending = useMemo(() => invoices.filter((i) => !i.submission), [invoices]);
  const selectedPending = pending.filter((i) => selected.has(i.key));
  const allSelected = pending.length > 0 && selectedPending.length === pending.length;

  function toggle(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(pending.map((i) => i.key)) : new Set());
  }

  /** Called by the dialog as soon as FBR accepts an invoice. */
  const handleSubmitted = useCallback((key: string, fbrNumber: string) => {
    setInvoices((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, submission: { fbrNumber, at: new Date().toISOString() } }
          : i,
      ),
    );
    setSelected((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const dialogOpen = dialogTargets !== null;
  const showBar = view.kind === "ready" && selectedPending.length > 0 && !dialogOpen;

  return (
    <div className={`mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 ${showBar ? "pb-32" : "pb-16"}`}>
      {/* Hero */}
      <section className="mb-8 max-w-2xl">
        <p className="text-sm font-semibold text-muted">Digital invoicing</p>
        <h1 className="mt-1 text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          Find an invoice.
        </h1>
        <p className="mt-3 text-[15px] font-medium leading-relaxed text-muted">
          Search by GNO, STN, or invoice date, review the details, then submit to FBR.
        </p>
      </section>

      <SearchForm loading={view.kind === "loading"} onSearch={search} />

      {/* Results */}
      <section className="mt-8" aria-live="polite">
        {view.kind === "idle" && (
          <StateCard
            icon={<SearchIcon width={30} height={30} />}
            title="No invoice selected"
            message="Use any one of GNO, STN, or From date. Multiple values can also be combined."
          />
        )}

        {view.kind === "loading" && (
          <div className="flex items-center justify-center gap-3 py-16 text-sm font-bold text-muted">
            <SpinnerIcon width={22} height={22} className="text-ink" />
            Searching invoices...
          </div>
        )}

        {view.kind === "error" && (
          <StateCard
            tone="red"
            icon={<AlertIcon width={34} height={34} />}
            title="Search failed"
            message={view.message}
            action={
              <button
                type="button"
                onClick={() => lastSearch.current && search(lastSearch.current)}
                className="h-11 rounded-xl border border-line px-5 text-sm font-bold transition hover:bg-soft"
              >
                Try again
              </button>
            }
          />
        )}

        {view.kind === "empty" && (
          <StateCard
            icon={<SearchIcon width={30} height={30} />}
            title="No invoice found"
            message={view.message || "Nothing matched your search. Check the values and try again."}
          />
        )}

        {view.kind === "ready" && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">
                  {String(invoices.length).padStart(2, "0")} result{invoices.length === 1 ? "" : "s"}
                </h2>
                {environment && <Badge tone="orange">{environment}</Badge>}
              </div>

              {pending.length > 1 && (
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={selectedPending.length > 0}
                    onChange={toggleAll}
                    disabled={dialogOpen}
                    label="Select all pending invoices"
                  />
                  Select all ({pending.length})
                </label>
              )}
            </div>

            {warning && (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-warn-soft px-4 py-3 text-sm font-semibold text-warn"
              >
                {warning}
              </p>
            )}

            <div className="space-y-4">
              {invoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.key}
                  invoice={invoice}
                  selected={selected.has(invoice.key)}
                  busy={dialogOpen}
                  defaultOpen={invoices.length === 1}
                  onSelect={(checked) => toggle(invoice.key, checked)}
                  onSubmit={() => setDialogTargets([invoice])}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Bulk action bar */}
      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
            <p className="text-sm font-extrabold">{selectedPending.length} selected</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="h-11 rounded-xl px-4 text-sm font-bold text-muted transition hover:bg-soft"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setDialogTargets(selectedPending)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-extrabold text-white transition hover:bg-brand/90"
              >
                <CloudUploadIcon width={18} height={18} />
                Submit {plural(selectedPending.length, "invoice")} to FBR
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogTargets && (
        <SubmitDialog
          targets={dialogTargets}
          onSubmitted={handleSubmitted}
          onClose={() => setDialogTargets(null)}
        />
      )}
    </div>
  );
}
