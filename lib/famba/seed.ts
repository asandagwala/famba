import type { DB } from "./db";

const daysAgo = (d: number, h = 10) => {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 15, 0, 0);
  return t.toISOString();
};

// Demo data for a Cape Town shea-butter & black-soap brand that buys from
// West and East African producers and sells to customers across the region.
export function seed(): DB {
  return {
    merchant: {
      name: "Ubuntu Naturals",
      tagline: "Shea butter & black soap, made by women's co-ops",
      city: "Cape Town, South Africa",
      walletAddress: process.env.MERCHANT_WALLET_ADDRESS ?? "0xA8f73eb996C58688240474D442C1D467f7171D58",
    },
    orders: [
      { id: "ord_kente01", customerName: "Thandi Mokoena", customerCountry: "Kenya", description: "Raw shea butter 1kg × 3", amountZar: 1350, usdcAmount: 74.18, status: "PAID", createdAt: daysAgo(6), paidAt: daysAgo(6, 11), mode: "demo" },
      { id: "ord_soap002", customerName: "Kofi Mensah", customerCountry: "Ghana", description: "African black soap gift box", amountZar: 620, usdcAmount: 34.07, status: "PAID", createdAt: daysAgo(4), paidAt: daysAgo(4, 12), mode: "demo" },
      { id: "ord_salon03", customerName: "Glow Salon Lusaka", customerCountry: "Zambia", description: "Wholesale: shea butter 10kg", amountZar: 8900, usdcAmount: 489.01, status: "PAID", createdAt: daysAgo(2), paidAt: daysAgo(2, 15), mode: "demo" },
      { id: "ord_basket4", customerName: "Amara Okafor", customerCountry: "Nigeria", description: "Bolga market basket + body butter", amountZar: 1150, usdcAmount: 63.19, status: "PENDING", createdAt: daysAgo(0, 9) },
    ],
    suppliers: [
      { id: "sup_tamale", name: "Tamale Shea Women's Co-op", product: "Unrefined shea butter", country: "Ghana", currency: "GHS", walletAddress: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", payoutMethod: "Mobile money" },
      { id: "sup_bolga", name: "Bolga Basket Weavers", product: "Handwoven straw baskets", country: "Ghana", currency: "GHS", walletAddress: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", payoutMethod: "Mobile money" },
      { id: "sup_rift", name: "Rift Valley Sisal Co.", product: "Sisal packaging & twine", country: "Kenya", currency: "KES", walletAddress: "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", payoutMethod: "M-Pesa" },
      { id: "sup_lagos", name: "Lagos Label & Print", product: "Jars, labels & printing", country: "Nigeria", currency: "NGN", walletAddress: "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", payoutMethod: "Bank transfer" },
    ],
    supplierPayments: [
      { id: "spay_seed1", supplierId: "sup_tamale", supplierName: "Tamale Shea Women's Co-op", usdcAmount: 180, localAmount: 2115.09, currency: "GHS", note: "Invoice #TS-114: 60kg shea butter", createdAt: daysAgo(3), mode: "demo" },
    ],
    cashOuts: [],
  };
}
