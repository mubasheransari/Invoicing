import { ReceiptIcon, ShieldCheckIcon } from "./icons";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-ink text-white">
            <ReceiptIcon />
          </span>
          <div className="leading-tight">
            <p className="text-[15px] font-extrabold tracking-tight">Digital Invoicing</p>
            <p className="text-xs font-medium text-muted">FBR submission portal</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-extrabold">
          <ShieldCheckIcon width={16} height={16} className="text-brand" />
          FBR DI
        </span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs font-medium text-muted sm:px-6">
        Invoices are submitted to FBR through the WebDNA Digital Invoicing gateway. Invoices
        accepted by FBR cannot be submitted again.
      </div>
    </footer>
  );
}
