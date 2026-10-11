import { InvoiceApp } from "@/components/invoice-app";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <InvoiceApp />
      </main>
      <SiteFooter />
    </>
  );
}
