// Shared (client + server) types. No server-only imports here.

export interface InvoiceItemView {
  no: string;
  trans: number | null;
  itmCode: string;
  blendId: number | null;
  ordNo: string;
  qty: number | null;
  rate: number | null;
  amount: number | null;
  fixRate: number | null;
  tradeOffer: number | null;
}

export interface SubmissionInfo {
  fbrNumber: string;
  at: string;
}

export interface InvoiceView {
  /** Unique key used for selection / duplicate protection (the GNO). */
  key: string;
  stn: string;
  no: string;
  vdate: string | null; // YYYY-MM-DD
  scode: string;
  docno: string;
  vehNo: string;
  rid: string;
  gno: string;
  gstNo: string;
  fdt: string | null; // YYYY-MM-DD
  items: InvoiceItemView[];
  totalAmount: number;
  submission: SubmissionInfo | null;
}

export interface SearchResponse {
  invoices: InvoiceView[];
  message: string;
  environment: string;
  /** Set when "already submitted" records could not be read. */
  warning?: string;
}

export interface SubmitSuccess {
  ok: true;
  fbrNumber: string;
  dated: string | null;
  /** false if FBR accepted the invoice but saving the record failed. */
  persisted: boolean;
}

export interface ApiError {
  ok?: false;
  error: string;
  code?: string;
  fbrNumber?: string;
}
