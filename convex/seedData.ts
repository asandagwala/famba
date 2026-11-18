// Demo data for a Cape Town shea-butter & black-soap brand that buys from
// women's co-ops in West Africa and sells to customers across the region.

const daysAgo = (now: number, d: number, h = 10) => {
  const t = new Date(now);
  t.setUTCDate(t.getUTCDate() - d);
  t.setUTCHours(h, 15, 0, 0);
  return t.toISOString();
};

export function seedData(now: number) {
  return {
    merchant: {
      name: "Ubuntu Naturals",
      tagline: "Shea butter & black soap, made by women's co-ops",
      city: "Cape Town, South Africa",
      walletAddress: "0xA8f73eb996C58688240474D442C1D467f7171D58",
      received: 74.18 + 34.07 + 489.01,
      paidOut: 180,
      cashedOut: 0,
    },
    orders: [
      { orderId: "ord_kente01", customerName: "Thandi Mokoena", customerCountry: "Kenya", description: "Raw shea butter 1kg × 3", amountZar: 1350, usdcAmount: 74.18, status: "PAID" as const, createdAt: daysAgo(now, 6), paidAt: daysAgo(now, 6, 11), mode: "demo" as const, paidWith: { method: "mobile_money" as const, provider: "M-Pesa", currency: "KES" as const, amount: 9642.6 } },
      { orderId: "ord_soap002", customerName: "Kofi Mensah", customerCountry: "Ghana", description: "African black soap gift box", amountZar: 620, usdcAmount: 34.07, status: "PAID" as const, createdAt: daysAgo(now, 4), paidAt: daysAgo(now, 4, 12), mode: "demo" as const, paidWith: { method: "mobile_money" as const, provider: "MTN MoMo", currency: "GHS" as const, amount: 400.35 } },
      { orderId: "ord_salon03", customerName: "Glow Salon Lusaka", customerCountry: "Zambia", description: "Wholesale: shea butter 10kg", amountZar: 8900, usdcAmount: 489.01, status: "PAID" as const, createdAt: daysAgo(now, 2), paidAt: daysAgo(now, 2, 15), mode: "demo" as const, paidWith: { method: "bank" as const, provider: "Zanaco bank transfer", currency: "ZMW" as const, amount: 10064.83 } },
      { orderId: "ord_basket4", customerName: "Amara Okafor", customerCountry: "Nigeria", description: "Bolga market basket + body butter", amountZar: 1150, usdcAmount: 63.19, status: "PENDING" as const, createdAt: daysAgo(now, 0, 9) },
    ],
    suppliers: [
      { supplierId: "sup_tamale", name: "Tamale Shea Women's Co-op", product: "Unrefined shea butter", country: "Ghana", currency: "GHS" as const, walletAddress: "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", payoutMethod: "Mobile money" },
      { supplierId: "sup_bolga", name: "Bolga Basket Weavers", product: "Handwoven straw baskets", country: "Ghana", currency: "GHS" as const, walletAddress: "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359", payoutMethod: "Mobile money" },
      { supplierId: "sup_rift", name: "Rift Valley Sisal Co.", product: "Sisal packaging & twine", country: "Kenya", currency: "KES" as const, walletAddress: "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB", payoutMethod: "M-Pesa" },
      { supplierId: "sup_lagos", name: "Lagos Label & Print", product: "Jars, labels & printing", country: "Nigeria", currency: "NGN" as const, walletAddress: "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", payoutMethod: "Bank transfer" },
    ],
    supplierPayments: [
      { paymentId: "spay_seed1", supplierId: "sup_tamale", supplierName: "Tamale Shea Women's Co-op", usdcAmount: 180, localAmount: 2115.09, currency: "GHS" as const, note: "Invoice #TS-114: 60kg shea butter", createdAt: daysAgo(now, 3), mode: "demo" as const },
    ],
  };
}
