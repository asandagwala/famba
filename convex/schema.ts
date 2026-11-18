import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const currency = v.union(v.literal("ZAR"), v.literal("KES"), v.literal("NGN"), v.literal("GHS"), v.literal("ZMW"));

export const paidWith = v.object({
  method: v.union(v.literal("mobile_money"), v.literal("bank"), v.literal("usdc_wallet")),
  provider: v.string(),
  currency,
  amount: v.number(),
});

export const orderFields = {
  orderId: v.string(),
  customerName: v.string(),
  customerCountry: v.string(),
  description: v.string(),
  amountZar: v.number(),
  usdcAmount: v.number(),
  status: v.union(v.literal("PENDING"), v.literal("PAID")),
  createdAt: v.string(),
  paidAt: v.optional(v.string()),
  txHash: v.optional(v.string()),
  payer: v.optional(v.string()),
  mode: v.optional(v.union(v.literal("onchain"), v.literal("demo"))),
  paidWith: v.optional(paidWith),
};

export const supplierFields = {
  supplierId: v.string(),
  name: v.string(),
  product: v.string(),
  country: v.string(),
  currency,
  walletAddress: v.string(),
  payoutMethod: v.string(),
};

export const supplierPaymentFields = {
  paymentId: v.string(),
  supplierId: v.string(),
  supplierName: v.string(),
  usdcAmount: v.number(),
  localAmount: v.number(),
  currency,
  note: v.string(),
  createdAt: v.string(),
  txHash: v.optional(v.string()),
  mode: v.union(v.literal("onchain"), v.literal("demo")),
};

export const cashOutFields = {
  cashOutId: v.string(),
  usdcAmount: v.number(),
  zarAmount: v.number(),
  fee: v.number(),
  bank: v.string(),
  createdAt: v.string(),
};

export default defineSchema({
  // One merchant for this demo. Running USDC totals are kept here so balance
  // checks never have to scan whole tables.
  merchants: defineTable({
    name: v.string(),
    tagline: v.string(),
    city: v.string(),
    walletAddress: v.string(),
    received: v.number(),
    paidOut: v.number(),
    cashedOut: v.number(),
  }),
  orders: defineTable(orderFields).index("by_orderId", ["orderId"]).index("by_txHash", ["txHash"]),
  suppliers: defineTable(supplierFields).index("by_supplierId", ["supplierId"]),
  supplierPayments: defineTable(supplierPaymentFields),
  cashOuts: defineTable(cashOutFields),
});
