import type { Currency } from "./rates";

/** Local ways a customer can pay in each country (the on-ramp side of the gateway). */
export const LOCAL_METHODS: Record<Currency, { mobile: string[]; bank: string }> = {
  KES: { mobile: ["M-Pesa", "Airtel Money"], bank: "PesaLink bank transfer" },
  NGN: { mobile: ["OPay", "MTN MoMo"], bank: "NIP instant transfer" },
  GHS: { mobile: ["MTN MoMo", "Telecel Cash"], bank: "GhIPSS bank transfer" },
  ZMW: { mobile: ["Airtel Money", "MTN MoMo"], bank: "Zanaco bank transfer" },
  ZAR: { mobile: [], bank: "Instant EFT" },
};

export const COUNTRY_CCY: Record<string, Currency> = {
  "South Africa": "ZAR",
  Kenya: "KES",
  Nigeria: "NGN",
  Ghana: "GHS",
  Zambia: "ZMW",
};
