import "server-only";

import { getConfig, type AppConfig } from "./config";
import { HttpError } from "./errors";
import type { ServerInvoice, ServerItem } from "./ords";

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

function numOrNull(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Round to 2 decimals, half away from zero. */
const round2 = (v: number) => Math.sign(v) * (Math.round(Math.abs(v) * 100) / 100);

// ---------------------------------------------------------------------------
// Access token (WebDNA OAuth2 "password" grant)
// ---------------------------------------------------------------------------

const cache = globalThis as unknown as {
  __fbrToken?: { token: string; expiresAt: number };
};

/** Authorization header for the token endpoint (Basic client credential). */
function clientAuthHeader(cfg: AppConfig): string {
  if (cfg.consumerKey && cfg.consumerSecret) {
    const b64 = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
    return `Basic ${b64}`;
  }
  const pasted = cfg.tokenAuthHeader;
  if (!pasted) return "";
  return /^basic\s/i.test(pasted) ? pasted : `Basic ${pasted}`;
}

export async function getAccessToken(forceNew = false): Promise<string> {
  const cfg = getConfig();

  if (cfg.testAccessToken) return cfg.testAccessToken;

  if (cfg.reuseToken && !forceNew) {
    const c = cache.__fbrToken;
    if (c && Date.now() < c.expiresAt - 2 * 60_000) return c.token;
  }

  const auth = clientAuthHeader(cfg);
  if (!auth) {
    throw new HttpError(
      "FBR client credential is not set. Set FBR_TOKEN_AUTH_HEADER in .env.local.",
      500,
      "config",
    );
  }

  let res: Response;
  try {
    res = await fetch(cfg.fbrTokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: auth,
      },
      body: new URLSearchParams({
        grant_type: "password",
        username: cfg.tokenUsername,
        password: cfg.tokenPassword,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(cfg.requestTimeoutMs),
    });
  } catch (e) {
    console.error("[fbr] token request failed:", e);
    throw new HttpError("Unable to reach the FBR token server.", 502, "token");
  }

  let json: unknown = null;
  try {
    json = JSON.parse(await res.text());
  } catch {
    /* handled below */
  }

  if (!res.ok) {
    const detail = isObj(json) ? str(json.error_description ?? json.error) : "";
    throw new HttpError(
      `FBR token request failed (HTTP ${res.status}). ${detail}`.trim(),
      502,
      "token",
    );
  }

  const accessToken = isObj(json) ? str(json.access_token) : "";
  if (!accessToken) {
    throw new HttpError("FBR token response did not contain an access_token.", 502, "token");
  }

  const expiresIn = isObj(json) ? Number(json.expires_in) : NaN;
  // Never trust an odd value: at most 1 hour.
  const lifetime = Number.isFinite(expiresIn) && expiresIn > 0 && expiresIn <= 3600 ? expiresIn : 3600;
  cache.__fbrToken = { token: accessToken, expiresAt: Date.now() + lifetime * 1000 };

  return accessToken;
}

// ---------------------------------------------------------------------------
// Payload (WebDNA spec 6.3)
// ---------------------------------------------------------------------------

function buildItem(item: ServerItem, cfg: AppConfig): Obj {
  const r = item.raw;

  const rate =
    typeof r.rate === "string" && r.rate.includes("%") ? r.rate : cfg.defaults.taxRate;
  const taxPercent = Number(rate.replace("%", "").trim()) || 0;

  const valueExclST = round2(numOrNull(r.valueSalesExcludingST) ?? item.amount ?? 0);
  const salesTax = round2(numOrNull(r.salesTaxApplicable) ?? (valueExclST * taxPercent) / 100);
  const total = round2(numOrNull(r.totalValues) ?? valueExclST + salesTax);

  return {
    sellerItemCode: item.itmCode,
    productDescription: r.productDescription ?? item.itmCode,
    hsCode: r.hsCode ?? "",
    uoM: r.uoM ?? cfg.defaults.uom,
    sroScheduleNo: r.sroScheduleNo ?? cfg.defaults.sroScheduleNo,
    discount: numOrNull(r.discount) ?? 0,
    saleType: r.saleType ?? cfg.defaults.saleType,
    sroItemSerialNo: r.sroItemSerialNo ?? cfg.defaults.sroItemSerialNo,
    totalValues: total,
    valueSalesExcludingST: valueExclST,
    salesTaxApplicable: salesTax,
    salesTaxWithheldAtSource: numOrNull(r.salesTaxWithheldAtSource) ?? 0,
    extraTax: numOrNull(r.extraTax) ?? 0,
    furtherTax: numOrNull(r.furtherTax) ?? 0,
    quantity: item.qty ?? 0,
    fedPayable: numOrNull(r.fedPayable) ?? 0,
    rate,
    fixedNotifiedValueOrRetailPrice: item.fixRate ?? 0,
  };
}

/**
 * Builds the FBR DI request body. Values come from the ORDS invoice where
 * available; any FBR-named key the ORDS response already carries (e.g.
 * buyerNTNCNIC, hsCode) overrides the default, so adding those columns to the
 * Oracle package later needs no change here.
 */
export function buildPayload(inv: ServerInvoice, cfg: AppConfig = getConfig()): Obj {
  const r = inv.raw;

  return {
    invoiceSource: cfg.defaults.invoiceSource,
    sellerCode: cfg.seller.code,
    invoiceDate: inv.vdate,
    sellerNTNCNIC: cfg.seller.ntnCnic,
    sellerBusinessName: cfg.seller.businessName,
    sellerAddress: cfg.seller.address,
    sellerProvince: cfg.seller.province,
    buyerNTNCNIC: r.buyerNTNCNIC ?? "",
    buyerBusinessName: r.buyerBusinessName ?? "",
    buyerProvince: r.buyerProvince ?? "",
    buyerAddress: r.buyerAddress ?? "",
    buyerRegistrationType: r.buyerRegistrationType ?? cfg.defaults.buyerRegistrationType,
    invoiceRefNo: inv.gno || inv.no,
    poNo: inv.no,
    doNo: inv.docno,
    poDate: inv.vdate,
    deliveryDate: inv.fdt ?? inv.vdate,
    invoiceType: cfg.defaults.invoiceType,
    advanceIncomeTax: numOrNull(r.advanceIncomeTax) ?? 0,
    advanceIncomeTaxRate: str(r.advanceIncomeTaxRate),
    scenarioId: cfg.defaults.scenarioId,
    items: inv.items.map((it) => buildItem(it, cfg)),
  };
}

// ---------------------------------------------------------------------------
// Submit (WebDNA spec 6: Direct/Instant Post)
// ---------------------------------------------------------------------------

export interface FbrResult {
  invoiceNumber: string;
  dated: string | null;
}

/** Formats a validationResponse (spec 6.4 / 6.5) into readable text. */
function validationError(v: Obj): string {
  const parts: string[] = [];

  const error = str(v.error).trim();
  const errorCode = str(v.errorCode).trim();
  if (error) parts.push(errorCode ? `[${errorCode}] ${error}` : error);

  const itemErrors: string[] = [];
  const collect = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (isObj(node) && str(node.statusCode) !== "00") {
      const e = str(node.error).trim();
      if (e) itemErrors.push(`Item ${str(node.itemSNo) || "?"}: ${e}`);
    }
  };
  collect(v.invoiceStatuses);

  parts.push(...itemErrors.slice(0, 5));
  if (itemErrors.length > 5) parts.push(`...and ${itemErrors.length - 5} more item errors`);

  return parts.length > 0
    ? parts.join("\n")
    : `FBR marked the invoice invalid (status ${str(v.statusCode)}).`;
}

/** Readable message for a non-2xx gateway answer (incl. WSO2 faults). */
function gatewayError(decoded: unknown, status: number): string {
  if (isObj(decoded)) {
    if (isObj(decoded.validationResponse)) return validationError(decoded.validationResponse);

    const src = isObj(decoded.fault) ? decoded.fault : decoded;
    const code = str(src.code).trim();
    const message = str(src.message ?? src.error ?? src.errorMessage).trim();
    const description = str(src.description ?? src.error_description ?? src.detail).trim();
    const lines = [message, description].filter(Boolean);
    if (lines.length > 0) {
      return `HTTP ${status}${code ? ` / code ${code}` : ""}\n${lines.join("\n")}`;
    }
  }
  if (status === 403) {
    return "HTTP 403 Forbidden - the FBR gateway refused access to this API for your account.";
  }
  return `FBR rejected the submission (HTTP ${status}).`;
}

export async function submitToFbr(inv: ServerInvoice): Promise<FbrResult> {
  const cfg = getConfig();

  const missing = [
    !cfg.seller.ntnCnic && "SELLER_NTN_CNIC",
    !cfg.seller.businessName && "SELLER_BUSINESS_NAME",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new HttpError(
      `FBR is not configured. Set ${missing.join(", ")} in .env.local.`,
      500,
      "config",
    );
  }

  if (inv.items.length === 0) {
    throw new HttpError("This invoice has no items to submit.", 422, "no_items");
  }

  const body = JSON.stringify(buildPayload(inv, cfg));

  const post = (token: string) =>
    fetch(cfg.fbrSubmitUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(cfg.requestTimeoutMs),
    });

  console.log(`[fbr] submit ${inv.key} (${inv.items.length} items) -> ${cfg.fbrSubmitUrl}`);

  let res: Response;
  try {
    // A fresh token before every submit (unless FBR_REUSE_TOKEN=true).
    res = await post(await getAccessToken());
    if (res.status === 401) {
      // Token rejected -> get a new one and retry once.
      res = await post(await getAccessToken(true));
    }
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error("[fbr] submit request failed:", e);
    throw new HttpError("Unable to reach the FBR gateway.", 502, "fbr_network");
  }

  const text = await res.text();
  let decoded: unknown = null;
  try {
    decoded = JSON.parse(text);
  } catch {
    /* not JSON */
  }

  console.log(`[fbr] response ${res.status} for ${inv.key}`);

  if (!res.ok) {
    console.error("[fbr] error body:", text.slice(0, 600));
    throw new HttpError(gatewayError(decoded, res.status), 502, "fbr_http");
  }

  if (!isObj(decoded)) {
    throw new HttpError("FBR returned an unexpected (non-JSON) response.", 502, "fbr_format");
  }

  // HTTP 200 can still carry an INVALID result: statusCode "00" = valid.
  const validation = decoded.validationResponse;
  if (isObj(validation)) {
    if (str(validation.statusCode) !== "00") {
      throw new HttpError(validationError(validation), 422, "fbr_invalid");
    }
  } else if (!str(decoded.invoiceNumber)) {
    throw new HttpError(
      "FBR response did not confirm the invoice was accepted.",
      502,
      "fbr_unconfirmed",
    );
  }

  return {
    invoiceNumber: str(decoded.invoiceNumber),
    dated: str(decoded.dated) || null,
  };
}
