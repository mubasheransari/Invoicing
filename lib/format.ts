/** YYYY-MM-DD -> DD/MM/YYYY ("-" when missing). */
export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** 15636796.9 -> "15,636,796.90" */
export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Up to 4 decimals, "-" for null. */
export function formatNum(n: number | null): string {
  if (n === null) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
