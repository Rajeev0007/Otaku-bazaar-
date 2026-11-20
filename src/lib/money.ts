// Money helpers. Amounts are integer minor units (e.g. paise). Currency is always passed explicitly.

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX"]);

export function minorUnitDigits(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** minorUnitDigits(currency));
}

export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnitDigits(currency);
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(minor: number, currency: string, locale = "en-IN"): string {
  const key = `${locale}|${currency}`;
  let f = formatters.get(key);
  if (!f) {
    const digits = minorUnitDigits(currency);
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
    formatters.set(key, f);
  }
  return f.format(toMajor(minor, currency));
}

/** Whole-number percentage saved, or 0 when there is no valid compare-at price. */
export function discountPercent(price: number, compareAt: number | null | undefined): number {
  if (!compareAt || compareAt <= price || compareAt <= 0) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Applies basis points with banker-safe integer rounding (half up). */
export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10_000);
}

/** Tax contained in a tax-inclusive amount, e.g. GST included in an MRP. */
export function inclusiveTax(amount: number, bps: number): number {
  if (bps <= 0) return 0;
  return amount - Math.round((amount * 10_000) / (10_000 + bps));
}
