import type { NextRequest } from "next/server";

import { HttpError } from "@/lib/errors";
import { submitToFbr } from "@/lib/fbr";
import { fetchInvoices } from "@/lib/ords";
import { getSubmission, markSubmitted, tryLock, unlock } from "@/lib/submission-store";
import type { ApiError, SubmitSuccess } from "@/lib/types";

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number, code?: string, fbrNumber?: string) {
  const body: ApiError = { error, code, fbrNumber };
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Submits ONE invoice to FBR.
 *
 * The browser only sends the GNO. The invoice is re-read from ORDS here
 * (source of truth), so the client can never tamper with amounts or items.
 */
export async function POST(request: NextRequest) {
  let gno = "";
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "gno" in body) {
      gno = String((body as { gno: unknown }).gno ?? "").trim().toUpperCase();
    }
  } catch {
    return fail("Invalid request.", 400, "validation");
  }
  if (!gno) return fail("GNO is required.", 400, "validation");

  // Parallel clicks / tabs: only one submission per invoice at a time.
  if (!tryLock(gno)) {
    return fail("This invoice is already being submitted.", 409, "in_progress");
  }

  try {
    // Already accepted by FBR? Never send again.
    try {
      const existing = await getSubmission(gno);
      if (existing) {
        return fail(
          "This invoice was already submitted to FBR.",
          409,
          "already_submitted",
          existing.fbrNumber,
        );
      }
    } catch (e) {
      // Can't verify -> refuse rather than risk a duplicate.
      console.error("[store] could not read submission records:", e);
      return fail(
        "Submission history is unavailable, so the invoice was not sent. Check the server.",
        500,
        "store",
      );
    }

    const found = await fetchInvoices({ gno });
    const invoice = found.find((i) => i.key === gno);
    if (!invoice) return fail(`Invoice ${gno} was not found.`, 404, "not_found");

    const result = await submitToFbr(invoice);

    // FBR accepted it. Record it so it can't be sent again.
    let persisted = true;
    try {
      await markSubmitted(gno, result.invoiceNumber);
    } catch (e) {
      persisted = false;
      console.error(
        `[store] FBR ACCEPTED ${gno} (FBR no. ${result.invoiceNumber}) but saving the record failed:`,
        e,
      );
    }

    const ok: SubmitSuccess = {
      ok: true,
      fbrNumber: result.invoiceNumber,
      dated: result.dated,
      persisted,
    };
    return Response.json(ok, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status, e.code);
    console.error("[submit] unexpected error:", e);
    return fail("Something went wrong while submitting.", 500);
  } finally {
    unlock(gno);
  }
}
