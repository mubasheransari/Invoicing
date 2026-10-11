"use client";

import { useMemo, useState } from "react";

import { formatNum, plural } from "@/lib/format";
import type { InvoiceItemView } from "@/lib/types";

const PAGE_SIZE = 25;

export function ItemsTable({ items }: { items: InvoiceItemView[] }) {
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    // Keep the original line number even when filtering.
    const numbered = items.map((item, i) => ({ item, line: i + 1 }));
    return q ? numbered.filter((r) => r.item.itmCode.toLowerCase().includes(q)) : numbered;
  }, [items, filter]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const start = current * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  return (
    <div>
      {items.length > PAGE_SIZE && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            placeholder="Filter by item code"
            aria-label="Filter items by item code"
            className="h-10 w-full max-w-xs rounded-lg border border-line bg-surface px-3 text-sm font-semibold outline-none placeholder:font-medium placeholder:text-muted/70 focus:border-ink"
          />
          <p className="text-xs font-semibold text-muted">
            {filter ? `${plural(rows.length, "match", "matches")} of ` : ""}
            {plural(items.length, "item")}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-soft/60 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
            <tr>
              <th className="px-4 py-2.5 text-left">#</th>
              <th className="px-4 py-2.5 text-left">Item</th>
              <th className="px-4 py-2.5 text-right">Qty</th>
              <th className="px-4 py-2.5 text-right">Rate</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
              <th className="px-4 py-2.5 text-right">Fix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-semibold tabular-nums">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center font-medium text-muted">
                  No items match &ldquo;{filter}&rdquo;.
                </td>
              </tr>
            ) : (
              visible.map(({ item, line }) => (
                <tr key={line} className="hover:bg-soft/30">
                  <td className="px-4 py-2.5 text-muted">{line}</td>
                  <td className="px-4 py-2.5">{item.itmCode || "-"}</td>
                  <td className="px-4 py-2.5 text-right">{formatNum(item.qty)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNum(item.rate)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNum(item.amount)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNum(item.fixRate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-muted">
          <span>
            Showing {start + 1}&ndash;{Math.min(start + PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              className="h-9 rounded-lg border border-line px-3 font-bold text-ink transition hover:bg-soft disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              {current + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              className="h-9 rounded-lg border border-line px-3 font-bold text-ink transition hover:bg-soft disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
