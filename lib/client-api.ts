import type { ApiError, SearchResponse, SubmitSuccess } from "./types";

export interface SearchInput {
  gno: string;
  stn: string;
  fromDate: string; // YYYY-MM-DD or ""
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      fbrNumber?: string;
      aborted?: boolean;
    };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { ...init, cache: "no-store" });

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON body */
    }

    if (res.ok) return { ok: true, data: body as T };

    const err = (body ?? {}) as Partial<ApiError>;
    return {
      ok: false,
      status: res.status,
      error: err.error || `Request failed (HTTP ${res.status}).`,
      code: err.code,
      fbrNumber: err.fbrNumber,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, status: 0, error: "Request cancelled.", aborted: true };
    }
    return {
      ok: false,
      status: 0,
      error: "Network error. Check your connection and try again.",
    };
  }
}

export function searchInvoices(input: SearchInput, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (input.gno.trim()) qs.set("gno", input.gno.trim());
  if (input.stn.trim()) qs.set("stn", input.stn.trim());
  if (input.fromDate) qs.set("fromDate", input.fromDate);
  return request<SearchResponse>(`/api/invoices/search?${qs}`, { signal });
}

export function submitInvoice(gno: string) {
  return request<SubmitSuccess>("/api/fbr/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gno }),
  });
}
