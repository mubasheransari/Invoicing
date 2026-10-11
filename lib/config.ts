import "server-only";

/**
 * All configuration comes from environment variables (see .env.example).
 * It is read on every call (not at import time) so changes to .env.local are
 * picked up and nothing is frozen into a build.
 */
function str(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function getConfig() {
  return {
    environment: str("FBR_ENVIRONMENT", "staging"),
    requestTimeoutMs: Number(str("REQUEST_TIMEOUT_MS", "25000")) || 25000,

    ordsSearchUrl: str(
      "ORDS_SEARCH_URL",
      "http://tapex.mezangrp.com/ords/tea/di-invoice/search",
    ),

    // FBR / WebDNA. Per the WebDNA spec the URLs are identical for sandbox and
    // production - the token's scope decides which one you post to.
    fbrSubmitUrl: str(
      "FBR_SUBMIT_URL",
      "https://stg-fbrdi-gw.webdnaworks.com/diapi/v1/submitinvoice",
    ),
    fbrTokenUrl: str(
      "FBR_TOKEN_URL",
      "https://stg-fbrdi-apim.webdnaworks.com/oauth2/token",
    ),
    tokenUsername: str("FBR_TOKEN_USERNAME"),
    tokenPassword: str("FBR_TOKEN_PASSWORD"),
    /** Full header value, e.g. "Basic dGhp..." (prefix added if missing). */
    tokenAuthHeader: str("FBR_TOKEN_AUTH_HEADER"),
    consumerKey: str("FBR_CONSUMER_KEY"),
    consumerSecret: str("FBR_CONSUMER_SECRET"),
    /** TESTING ONLY: skip the token API and use this Bearer token. */
    testAccessToken: str("FBR_TEST_ACCESS_TOKEN"),
    /** false (default) = fetch a brand-new token before every submit. */
    reuseToken: str("FBR_REUSE_TOKEN", "false").toLowerCase() === "true",

    seller: {
      code: str("SELLER_CODE"),
      ntnCnic: str("SELLER_NTN_CNIC"),
      businessName: str("SELLER_BUSINESS_NAME"),
      address: str("SELLER_ADDRESS"),
      province: str("SELLER_PROVINCE", "SINDH"),
    },

    defaults: {
      invoiceSource: str("INVOICE_SOURCE", "ERP"),
      invoiceType: str("INVOICE_TYPE", "Sale Invoice"),
      scenarioId: str("SCENARIO_ID", "SN001"),
      buyerRegistrationType: str("DEFAULT_BUYER_REGISTRATION_TYPE", "Registered"),
      saleType: str("DEFAULT_SALE_TYPE", "Goods at standard rate (default)"),
      uom: str("DEFAULT_UOM", "Numbers, pieces, units"),
      taxRate: str("DEFAULT_TAX_RATE", "18%"),
      sroScheduleNo: str("DEFAULT_SRO_SCHEDULE_NO", "0"),
      sroItemSerialNo: str("DEFAULT_SRO_ITEM_SERIAL_NO", "0"),
    },
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
