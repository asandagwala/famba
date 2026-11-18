import { ConvexError, v } from "convex/values";
import { env, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { cashOutFields, orderFields, paidWith, supplierPaymentFields } from "./schema";
import { seedData } from "./seedData";

// All Famba functions are called only by the Famba Next.js server, which proves
// itself with FAMBA_SERVER_SECRET. Browsers never call these directly.
function requireServer(secret: string) {
  const expected = env.FAMBA_SERVER_SECRET;
  if (!expected || secret !== expected) throw new ConvexError("Not authorised");
}

const LIST_LIMIT = 200;
const EPS = 1e-9;

async function getMerchant(ctx: QueryCtx) {
  return await ctx.db.query("merchants").first();
}

async function requireMerchant(ctx: MutationCtx) {
  const m = await getMerchant(ctx);
  if (!m) throw new ConvexError("Famba is not set up yet");
  return m;
}

const available = (m: { received: number; paidOut: number; cashedOut: number }) =>
  Math.max(0, m.received - m.paidOut - m.cashedOut);

async function insertSeed(ctx: MutationCtx) {
  const s = seedData(Date.now());
  await ctx.db.insert("merchants", s.merchant);
  for (const o of s.orders) await ctx.db.insert("orders", o);
  for (const sup of s.suppliers) await ctx.db.insert("suppliers", sup);
  for (const p of s.supplierPayments) await ctx.db.insert("supplierPayments", p);
}

// ── Reads ────────────────────────────────────────────────

/** Everything the merchant dashboard shows (newest first, bounded). */
export const snapshot = query({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireServer(secret);
    const merchant = await getMerchant(ctx);
    if (!merchant) return null;
    return {
      merchant,
      orders: await ctx.db.query("orders").order("desc").take(LIST_LIMIT),
      suppliers: await ctx.db.query("suppliers").take(LIST_LIMIT),
      supplierPayments: await ctx.db.query("supplierPayments").order("desc").take(LIST_LIMIT),
      cashOuts: await ctx.db.query("cashOuts").order("desc").take(LIST_LIMIT),
    };
  },
});

/** One order plus the merchant it belongs to (for the public checkout page). */
export const getOrder = query({
  args: { secret: v.string(), orderId: v.string() },
  handler: async (ctx, { secret, orderId }) => {
    requireServer(secret);
    const merchant = await getMerchant(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .unique();
    return { merchant, order };
  },
});

// ── Writes ───────────────────────────────────────────────

/** Creates the demo data the first time the app runs. Safe to call repeatedly. */
export const ensureSeeded = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireServer(secret);
    if (await getMerchant(ctx)) return null;
    await insertSeed(ctx);
    return null;
  },
});

export const createOrder = mutation({
  args: { secret: v.string(), order: v.object(orderFields) },
  handler: async (ctx, { secret, order }) => {
    requireServer(secret);
    await requireMerchant(ctx);
    await ctx.db.insert("orders", order);
    return null;
  },
});

/** Marks a pending order paid and adds its USDC to the merchant's balance, atomically. */
export const markOrderPaid = mutation({
  args: {
    secret: v.string(),
    orderId: v.string(),
    paidAt: v.string(),
    mode: v.union(v.literal("onchain"), v.literal("demo")),
    paidWith,
    txHash: v.optional(v.string()),
    payer: v.optional(v.string()),
  },
  handler: async (ctx, { secret, orderId, txHash, ...paid }) => {
    requireServer(secret);
    const merchant = await requireMerchant(ctx);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .unique();
    if (!order) throw new ConvexError("Order not found.");
    if (order.status === "PAID") return order; // already settled; nothing to do
    if (txHash) {
      const used = await ctx.db
        .query("orders")
        .withIndex("by_txHash", (q) => q.eq("txHash", txHash))
        .first();
      if (used) throw new ConvexError("That transaction was already used for another order.");
    }
    await ctx.db.patch("orders", order._id, { status: "PAID", txHash, ...paid });
    await ctx.db.patch("merchants", merchant._id, { received: merchant.received + order.usdcAmount });
    return await ctx.db.get("orders", order._id);
  },
});

/** Records a supplier payment. Paying from the Famba balance requires enough balance. */
export const addSupplierPayment = mutation({
  args: { secret: v.string(), payment: v.object(supplierPaymentFields), fromBalance: v.boolean() },
  handler: async (ctx, { secret, payment, fromBalance }) => {
    requireServer(secret);
    const merchant = await requireMerchant(ctx);
    const supplier = await ctx.db
      .query("suppliers")
      .withIndex("by_supplierId", (q) => q.eq("supplierId", payment.supplierId))
      .unique();
    if (!supplier) throw new ConvexError("Supplier not found.");
    if (fromBalance && payment.usdcAmount > available(merchant) + EPS)
      throw new ConvexError(`Not enough balance. You have ${available(merchant).toFixed(2)} USDC available.`);
    await ctx.db.insert("supplierPayments", payment);
    if (fromBalance) await ctx.db.patch("merchants", merchant._id, { paidOut: merchant.paidOut + payment.usdcAmount });
    return null;
  },
});

export const addCashOut = mutation({
  args: { secret: v.string(), cashOut: v.object(cashOutFields) },
  handler: async (ctx, { secret, cashOut }) => {
    requireServer(secret);
    const merchant = await requireMerchant(ctx);
    if (cashOut.usdcAmount > available(merchant) + EPS)
      throw new ConvexError(`You only have ${available(merchant).toFixed(2)} USDC available.`);
    await ctx.db.insert("cashOuts", cashOut);
    await ctx.db.patch("merchants", merchant._id, { cashedOut: merchant.cashedOut + cashOut.usdcAmount });
    return null;
  },
});

/** Restores the demo data. The demo tables are small, so one batch per table is enough. */
export const reset = mutation({
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    requireServer(secret);
    for (const table of ["merchants", "orders", "suppliers", "supplierPayments", "cashOuts"] as const) {
      for (const doc of await ctx.db.query(table).take(1000)) await ctx.db.delete(table, doc._id);
    }
    await insertSeed(ctx);
    return null;
  },
});
