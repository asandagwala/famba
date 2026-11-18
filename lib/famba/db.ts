// Famba's data lives in Convex (see convex/famba.ts). This module is the only
// place the Next.js server talks to it. It runs server-side only and proves
// itself to Convex with FAMBA_SERVER_SECRET, so browsers can't change payments.
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import type { Currency } from "./rates";

export type Merchant = {
  name: string;
  tagline: string;
  city: string;
  walletAddress: string; // receives USDC on Base Sepolia
};

export type OrderStatus = "PENDING" | "PAID";
export type PaidWith = { method: "mobile_money" | "bank" | "usdc_wallet"; provider: string; currency: Currency; amount: number };
export type Order = {
  id: string;
  customerName: string;
  customerCountry: string; // where the payer is
  description: string;
  amountZar: number;
  usdcAmount: number;
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  txHash?: string;
  payer?: string;
  mode?: "onchain" | "demo";
  /** How the customer paid, in their own currency. */
  paidWith?: PaidWith;
};

export type Supplier = {
  id: string;
  name: string;
  product: string;
  country: string;
  currency: Currency;
  walletAddress: string;
  payoutMethod: string;
};

export type SupplierPayment = {
  id: string;
  supplierId: string;
  supplierName: string;
  usdcAmount: number;
  localAmount: number;
  currency: Currency;
  note: string;
  createdAt: string;
  txHash?: string;
  mode: "onchain" | "demo";
};

export type CashOut = {
  id: string;
  usdcAmount: number;
  zarAmount: number;
  fee: number;
  bank: string;
  createdAt: string;
};

export type Totals = { received: number; paidOut: number; cashedOut: number };

/** Lists are oldest-first, like the original file store. */
export type DB = {
  merchant: Merchant;
  totals: Totals;
  orders: Order[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  cashOuts: CashOut[];
};

/** A refusal Convex raised on purpose (not found, not enough balance…), safe to show to users. */
export class FambaError extends Error {}

let client: ConvexHttpClient | null = null;
function convex() {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("CONVEX_URL is not set");
  client ??= new ConvexHttpClient(url);
  return client;
}

function secret() {
  const s = process.env.FAMBA_SERVER_SECRET;
  if (!s) throw new Error("FAMBA_SERVER_SECRET is not set");
  return s;
}

/** Turns intentional Convex refusals into FambaError; anything else is rethrown. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ConvexError) throw new FambaError(String(e.data));
    throw e;
  }
}

const strip = <T extends { _id: unknown; _creationTime: unknown }>(d: T) => {
  const { _id, _creationTime, ...rest } = d;
  void _id;
  void _creationTime;
  return rest;
};

export async function readDb(): Promise<DB> {
  let snap = await call(() => convex().query(api.famba.snapshot, { secret: secret() }));
  if (!snap) {
    await call(() => convex().mutation(api.famba.ensureSeeded, { secret: secret() }));
    snap = await call(() => convex().query(api.famba.snapshot, { secret: secret() }));
    if (!snap) throw new Error("Famba could not be set up");
  }
  const { name, tagline, city, walletAddress, received, paidOut, cashedOut } = snap.merchant;
  return {
    merchant: { name, tagline, city, walletAddress },
    totals: { received, paidOut, cashedOut },
    orders: snap.orders.map(({ orderId, ...o }) => ({ id: orderId, ...strip(o) })).reverse(),
    suppliers: snap.suppliers.map(({ supplierId, ...s }) => ({ id: supplierId, ...strip(s) })),
    supplierPayments: snap.supplierPayments.map(({ paymentId, ...p }) => ({ id: paymentId, ...strip(p) })).reverse(),
    cashOuts: snap.cashOuts.map(({ cashOutId, ...c }) => ({ id: cashOutId, ...strip(c) })).reverse(),
  };
}

/** USDC the merchant holds in Famba: paid orders minus supplier payments and cash-outs. */
export function balanceOf(db: DB) {
  const { received, paidOut, cashedOut } = db.totals;
  return { received, paidOut, cashedOut, available: Math.max(0, received - paidOut - cashedOut) };
}

export async function getOrder(orderId: string): Promise<{ order: Order | null; merchant: Merchant | null }> {
  await readDb(); // makes sure the demo data exists on a brand-new deployment
  const r = await call(() => convex().query(api.famba.getOrder, { secret: secret(), orderId }));
  const order = r.order ? (({ orderId: id, ...o }) => ({ id, ...strip(o) }))(r.order) : null;
  const merchant = r.merchant
    ? { name: r.merchant.name, tagline: r.merchant.tagline, city: r.merchant.city, walletAddress: r.merchant.walletAddress }
    : null;
  return { order, merchant };
}

export async function createOrder(order: Order) {
  await readDb();
  const { id, ...rest } = order;
  await call(() => convex().mutation(api.famba.createOrder, { secret: secret(), order: { orderId: id, ...rest } }));
}

export async function markOrderPaid(args: {
  orderId: string;
  paidAt: string;
  mode: "onchain" | "demo";
  paidWith: PaidWith;
  txHash?: string;
  payer?: string;
}): Promise<Order> {
  const doc = await call(() => convex().mutation(api.famba.markOrderPaid, { secret: secret(), ...args }));
  if (!doc) throw new FambaError("Order not found.");
  const { orderId, ...o } = doc;
  return { id: orderId, ...strip(o) };
}

export async function addSupplierPayment(payment: SupplierPayment, fromBalance: boolean) {
  const { id, ...rest } = payment;
  await call(() =>
    convex().mutation(api.famba.addSupplierPayment, { secret: secret(), payment: { paymentId: id, ...rest }, fromBalance }),
  );
}

export async function addCashOut(cashOut: CashOut) {
  const { id, ...rest } = cashOut;
  await call(() => convex().mutation(api.famba.addCashOut, { secret: secret(), cashOut: { cashOutId: id, ...rest } }));
}

export async function resetDemo() {
  await call(() => convex().mutation(api.famba.reset, { secret: secret() }));
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
