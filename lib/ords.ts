import "server-only";

import { getConfig } from "./config";
import { HttpError } from "./errors";
import { parseJsonLenient } from "./json-repair";
import type { InvoiceItemView, InvoiceView } from "./types";

/** Server-side invoice: the public view plus the raw ORDS fields. */
export type ServerItem = InvoiceItemView & { raw: Record<string, unknown> };
export type ServerInvoice = Omit<InvoiceView, "items" | "submission"> & {
  items: ServerItem[];
  raw: Record<string, unknown>;
};

export interface SearchParams {
  gno?: string;
  stn?: string;
  fromDate?: string; // YYYY-MM-DD
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

/** Normalises ORDS dates to YYYY-MM-DD (or null). */
function date(v: unknown): string | null {
  const s = str(v).trim();
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function parseItem(raw: Obj): ServerItem {
  return {
    raw,
    no: str(raw.no),
    trans: num(raw.trans),
    itmCode: str(raw.itmCode ?? raw.itm_code),
    blendId: num(raw.blendId ?? raw.blend_id),
    ordNo: str(raw.ordNo ?? raw.ord_no),
    qty: num(raw.qty),
    rate: num(raw.rate),
    amount: num(raw.amount),
    fixRate: num(raw.fixRate ?? raw.fix_rate),
    tradeOffer: num(raw.tradeOffer ?? raw.trade_offer),
  };
}

function parseInvoice(invoice: Obj, itemsRaw: unknown): ServerInvoice {
  const items = (Array.isArray(itemsRaw) ? itemsRaw : [])
    .filter(isObj)
    .map(parseItem);
  const gno = str(invoice.gno);
  const no = str(invoice.no);

  return {
    raw: invoice,
    key: (gno || no).toUpperCase(),
    stn: str(invoice.stn),
    no,
    vdate: date(invoice.vdate),
    scode: str(invoice.scode),
    docno: str(invoice.docno),
    vehNo: str(invoice.vehNo ?? invoice.veh_no),
    rid: str(invoice.rid),
    gno,
    gstNo: str(invoice.gstNo ?? invoice.gst_no),
    fdt: date(invoice.fdt),
    items,
    totalAmount: items.reduce((sum, it) => sum + (it.amount ?? 0), 0),
  };
}

/** Accepts the current ORDS shape ({invoice, items}) and a future {invoices:[]}. */
function parseResponse(json: Obj): ServerInvoice[] {
  const invoices: ServerInvoice[] = [];

  if (isObj(json.invoice)) {
    invoices.push(parseInvoice(json.invoice, json.items));
  }

  if (Array.isArray(json.invoices)) {
    for (const entry of json.invoices) {
      if (!isObj(entry)) continue;
      const invoice = isObj(entry.invoice) ? entry.invoice : entry;
      invoices.push(parseInvoice(invoice, entry.items));
    }
  }

  return invoices;
}

export async function fetchInvoices(params: SearchParams): Promise<ServerInvoice[]> {
  const cfg = getConfig();

  const url = new URL(cfg.ordsSearchUrl);
  if (params.gno) url.searchParams.set("gno", params.gno);
  if (params.stn) url.searchParams.set("stn", params.stn);
  if (params.fromDate) url.searchParams.set("fromDate", params.fromDate);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
      signal: AbortSignal.timeout(cfg.requestTimeoutMs),
    });
  } catch (e) {
    console.error("[ords] request failed:", e);
    throw new HttpError(
      "Unable to reach the invoice server. Check the connection and try again.",
      502,
    );
  }

  // Decode the bytes ourselves: ORDS answers with text/html for JSON.
  const text = new TextDecoder("utf-8").decode(await res.arrayBuffer()).trim();

  if (!text) {
    throw new HttpError(`The invoice server returned an empty response (HTTP ${res.status}).`, 502);
  }

  let json: unknown;
  try {
    json = parseJsonLenient(text);
  } catch (e) {
    console.error("[ords] unparseable response:", e, text.slice(0, 500));
    throw new HttpError(
      `The invoice server returned a response that could not be read (HTTP ${res.status}).`,
      502,
    );
  }

  if (!isObj(json)) {
    throw new HttpError("The invoice server returned an unexpected response.", 502);
  }

  if (!res.ok) {
    throw new HttpError(
      str(json.message) || `Invoice search failed (HTTP ${res.status}).`,
      res.status === 404 ? 404 : res.status === 400 ? 400 : 502,
    );
  }

  const invoices = parseResponse(json);
  if (str(json.status).toLowerCase() !== "success" || invoices.length === 0) {
    throw new HttpError(str(json.message) || "No invoice found.", 404);
  }

  return invoices;
}
