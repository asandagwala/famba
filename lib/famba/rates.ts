// FX engine: every corridor is bridged through USDC (pegged 1:1 to USD).
// Live USD rates are fetched from a public FX feed and cached; if the feed is
// unreachable we fall back to indicative baseline rates so the app keeps working.

export const CURRENCIES = ["ZAR", "KES", "NGN", "ZMW", "GHS"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const COUNTRY: Record<Currency, string> = {
  ZAR: "South Africa",
  KES: "Kenya",
  NGN: "Nigeria",
  ZMW: "Zambia",
  GHS: "Ghana",
};

export const SWIFT ={ feePct: 9.5, settlementSeconds: 4 * 24 * 60 * 60, label: "4 days" };
export const FAMBA = { feePct: 0.2, settlementSeconds: 15, label: "15 seconds" };

export type Corridor = {
  id: string;
  from: Currency;
  to: Currency;
  fromCountry: string;
  toCountry: string;
  payoutMethod: string;
};

export const CORRIDORS: Corridor[] = [
  { id: "ZAR-KES", from: "ZAR", to: "KES", fromCountry: "South Africa", toCountry: "Kenya", payoutMethod: "M-Pesa mobile money" },
  { id: "ZAR-NGN", from: "ZAR", to: "NGN", fromCountry: "South Africa", toCountry: "Nigeria", payoutMethod: "NIP instant bank transfer" },
  { id: "ZMW-ZAR", from: "ZMW", to: "ZAR", fromCountry: "Zambia", toCountry: "South Africa", payoutMethod: "Local bank EFT" },
  { id: "GHS-ZAR", from: "GHS", to: "ZAR", fromCountry: "Ghana", toCountry: "South Africa", payoutMethod: "Local bank EFT" },
];

export function getCorridor(id: string) {
  return CORRIDORS.find((c) => c.id === id);
}

// Units of local currency per 1 USDC. Used only when the live feed is down.
const FALLBACK: Record<Currency, number> = {
  ZAR: 18.2,
  KES: 129.2,
  NGN: 1545,
  ZMW: 26.4,
  GHS: 15.3,
};

export type RateSnapshot = {
  base: "USDC";
  rates: Record<Currency, number>;
  source: "live" | "fallback";
  provider: string;
  fetchedAt: string;
};

const CACHE_MS = 10 * 60 * 1000;
let cache: { snap: RateSnapshot; at: number } | null = null;

export async function getRates(): Promise<RateSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.snap;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`FX feed HTTP ${res.status}`);
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body.result !== "success" || !body.rates) throw new Error("FX feed returned no rates");
    const rates = {} as Record<Currency, number>;
    for (const c of CURRENCIES) {
      const r = body.rates[c];
      if (typeof r !== "number" || !(r > 0)) throw new Error(`FX feed missing ${c}`);
      rates[c] = r;
    }
    const snap: RateSnapshot = {
      base: "USDC",
      rates,
      source: "live",
      provider: "open.er-api.com (USD ≡ USDC)",
      fetchedAt: new Date().toISOString(),
    };
    cache = { snap, at: Date.now() };
    return snap;
  } catch {
    const snap: RateSnapshot = {
      base: "USDC",
      rates: { ...FALLBACK },
      source: "fallback",
      provider: "Famba indicative baseline",
      fetchedAt: new Date().toISOString(),
    };
    // Retry the live feed sooner when we're on fallback.
    cache = { snap, at: Date.now() - CACHE_MS + 60_000 };
    return snap;
  }
}

export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Cross rate: units of `to` per 1 unit of `from`, bridged via USDC. */
export function crossRate(rates: Record<Currency, number>, from: Currency, to: Currency) {
  return rates[to] / rates[from];
}

export function quote(rates: Record<Currency, number>, corridor: Corridor, amount: number) {
  const usdc = amount / rates[corridor.from];
  const swiftFee = (amount * SWIFT.feePct) / 100;
  const fambaFee = (amount * FAMBA.feePct) / 100;
  return {
    corridor: corridor.id,
    amount: round(amount),
    currency: corridor.from,
    usdcEquivalent: round(usdc, 6),
    crossRate: round(crossRate(rates, corridor.from, corridor.to), 6),
    supplierReceives: round(usdc * rates[corridor.to]),
    supplierCurrency: corridor.to,
    swift: {
      feePct: SWIFT.feePct,
      fee: round(swiftFee),
      feeUsd: round(swiftFee / rates[corridor.from]),
      settlement: SWIFT.label,
      settlementSeconds: SWIFT.settlementSeconds,
    },
    famba: {
      feePct: FAMBA.feePct,
      fee: round(fambaFee),
      feeUsd: round(fambaFee / rates[corridor.from], 4),
      settlement: FAMBA.label,
      settlementSeconds: FAMBA.settlementSeconds,
    },
    savings: round(swiftFee - fambaFee),
    savingsUsd: round((swiftFee - fambaFee) / rates[corridor.from]),
    totalDebited: round(amount + fambaFee),
  };
}

export type Quote = ReturnType<typeof quote>;
