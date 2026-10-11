import type { NextRequest } from "next/server";

import { getConfig } from "@/lib/config";
import { HttpError } from "@/lib/errors";
import { fetchInvoices } from "@/lib/ords";
import { getSubmissions } from "@/lib/submission-store";
import type { ApiError, InvoiceView, SearchResponse, SubmissionInfo } from "@/lib/types";

const NO_STORE = { "Cache-Control": "no-store" };

const clean = (v: string | null) => {
  const t = v?.trim();
  return t ? t : undefined;
};

function fail(error: string, status: number, code?: string) {
  const body: ApiError = { error, code };
  return Response.json(body, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  // ORDS data is stored upper-case, so search is case-insensitive here.
  const gno = clean(sp.get("gno"))?.toUpperCase();
  const stn = clean(sp.get("stn"))?.toUpperCase();
  const fromDate = clean(sp.get("fromDate"));

  if (!gno && !stn && !fromDate) {
    return fail("Enter a GNO or STN, or select a date.", 400, "validation");
  }
  if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    return fail("Invalid date. Use the date picker (YYYY-MM-DD).", 400, "validation");
  }

  try {
    const found = await fetchInvoices({ gno, stn, fromDate });

    // Merge "already submitted" status. If the records can't be read, still
    // return the invoices (submit re-checks server-side and refuses safely).
    let warning: string | undefined;
    let submitted = new Map<string, SubmissionInfo>();
    try {
      submitted = await getSubmissions(found.map((i) => i.key));
    } catch (e) {
      console.error("[store] could not read submission records:", e);
      warning = "Submission history could not be read. Submitted invoices may not be marked.";
    }

    const invoices: InvoiceView[] = found.map((inv) => ({
      key: inv.key,
      stn: inv.stn,
      no: inv.no,
      vdate: inv.vdate,
      scode: inv.scode,
      docno: inv.docno,
      vehNo: inv.vehNo,
      rid: inv.rid,
      gno: inv.gno,
      gstNo: inv.gstNo,
      fdt: inv.fdt,
      totalAmount: inv.totalAmount,
      items: inv.items.map((it) => ({
        no: it.no,
        trans: it.trans,
        itmCode: it.itmCode,
        blendId: it.blendId,
        ordNo: it.ordNo,
        qty: it.qty,
        rate: it.rate,
        amount: it.amount,
        fixRate: it.fixRate,
        tradeOffer: it.tradeOffer,
      })),
      submission: submitted.get(inv.key) ?? null,
    }));

    const body: SearchResponse = {
      invoices,
      message: "",
      environment: getConfig().environment,
      warning,
    };
    return Response.json(body, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status, e.code);
    console.error("[search] unexpected error:", e);
    return fail("Something went wrong while searching.", 500);
  }
}
