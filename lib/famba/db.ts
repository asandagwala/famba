// Persistent JSON database (data/famba-db.json), seeded with an African SME on
// first run. Writes are serialised and atomic (temp file + rename).
import { promises as fs } from "node:fs";
import path from "node:path";
import { seed } from "./seed";
import type { Currency } from "./rates";

export type Merchant = {
  name: string;
  tagline: string;
  city: string;
  walletAddress: string; // receives USDC on Base Sepolia
};

export type OrderStatus = "PENDING" | "PAID";
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

export type DB = {
  merchant: Merchant;
  orders: Order[];
  suppliers: Supplier[];
  supplierPayments: SupplierPayment[];
  cashOuts: CashOut[];
};

const DATA_DIR = process.env.FAMBA_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "famba-db.json");

let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<DB> {
  try {
    const parsed = JSON.parse(await fs.readFile(DB_FILE, "utf8")) as Partial<DB>;
    if (parsed.merchant && Array.isArray(parsed.orders)) {
      return {
        merchant: parsed.merchant,
        orders: parsed.orders,
        suppliers: parsed.suppliers ?? [],
        supplierPayments: parsed.supplierPayments ?? [],
        cashOuts: parsed.cashOuts ?? [],
      };
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT" && !(err instanceof SyntaxError)) throw err;
  }
  return seed(); // first run, or an old-format file
}

async function save(db: DB) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

export function transact<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function readDb(): Promise<DB> {
  await queue;
  return load();
}

/** USDC the merchant holds in Famba: paid orders minus supplier payments and cash-outs. */
export function balanceOf(db: DB) {
  const received = db.orders.filter((o) => o.status === "PAID").reduce((s, o) => s + o.usdcAmount, 0);
  const paidOut = db.supplierPayments.reduce((s, p) => s + p.usdcAmount, 0);
  const cashedOut = db.cashOuts.reduce((s, c) => s + c.usdcAmount, 0);
  return { received, paidOut, cashedOut, available: Math.max(0, received - paidOut - cashedOut) };
}

export function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
