"use client";

import { useState, type FormEvent } from "react";

import type { SearchInput } from "@/lib/client-api";
import { CalendarIcon, ReceiptIcon, SearchIcon, SpinnerIcon, StoreIcon, XIcon } from "./icons";

const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-3 text-sm font-semibold outline-none transition placeholder:font-medium placeholder:text-muted/70 focus:border-ink focus:ring-1 focus:ring-ink";

export function SearchForm({
  loading,
  onSearch,
}: {
  loading: boolean;
  onSearch: (input: SearchInput) => void;
}) {
  const [gno, setGno] = useState("");
  const [stn, setStn] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const hasAny = gno.trim() !== "" || stn.trim() !== "" || fromDate !== "";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!hasAny) {
      setHint("Enter a GNO or STN, or select a date.");
      return;
    }
    setHint(null);
    onSearch({ gno, stn, fromDate });
  }

  function clear() {
    setGno("");
    setStn("");
    setFromDate("");
    setHint(null);
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-line bg-surface p-5 sm:p-6"
      aria-label="Search invoices"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="gno" className="mb-1.5 block text-xs font-extrabold">
            GNO
          </label>
          <div className="relative">
            <ReceiptIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="gno"
              name="gno"
              value={gno}
              onChange={(e) => setGno(e.target.value)}
              placeholder="e.g. PND1700655"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${fieldClass} uppercase placeholder:normal-case`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="stn" className="mb-1.5 block text-xs font-extrabold">
            STN
          </label>
          <div className="relative">
            <StoreIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="stn"
              name="stn"
              value={stn}
              onChange={(e) => setStn(e.target.value)}
              placeholder="e.g. PND"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={`${fieldClass} uppercase placeholder:normal-case`}
            />
          </div>
        </div>

        <div>
          <label htmlFor="fromDate" className="mb-1.5 block text-xs font-extrabold">
            From date
          </label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="fromDate"
              name="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={`${fieldClass} ${fromDate ? "" : "text-muted"}`}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p
          className={`text-xs font-semibold ${hint ? "text-danger" : "text-muted"}`}
          role={hint ? "alert" : undefined}
        >
          {hint ?? "Use any one of GNO, STN or From date. You can also combine them."}
        </p>

        <div className="flex w-full gap-3 sm:w-auto">
          {hasAny && (
            <button
              type="button"
              onClick={clear}
              disabled={loading}
              className="inline-flex h-12 items-center gap-2 rounded-xl border border-line px-4 text-sm font-bold text-muted transition hover:bg-soft disabled:opacity-50"
            >
              <XIcon width={16} height={16} />
              Clear
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-sm font-extrabold text-white transition hover:bg-ink/85 disabled:cursor-wait disabled:opacity-70 sm:flex-none"
          >
            {loading ? <SpinnerIcon width={18} height={18} /> : <SearchIcon width={18} height={18} />}
            {loading ? "Searching..." : "Search invoices"}
          </button>
        </div>
      </div>
    </form>
  );
}
