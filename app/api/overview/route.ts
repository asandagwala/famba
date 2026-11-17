import { connection } from "next/server";
import { balanceOf, readDb } from "@/lib/famba/db";
import { getRates } from "@/lib/famba/rates";
import { usdcBalance } from "@/lib/famba/chain";

// GET /api/overview — everything the merchant dashboard needs
export async function GET() {
  await connection();
  const [db, rates] = await Promise.all([readDb(), getRates()]);
  const walletUsdc = await usdcBalance(db.merchant.walletAddress).catch(() => null);
  return Response.json({
    merchant: db.merchant,
    balance: balanceOf(db),
    walletUsdc,
    rates,
    orders: [...db.orders].reverse(),
    suppliers: db.suppliers,
    supplierPayments: [...db.supplierPayments].reverse(),
    cashOuts: [...db.cashOuts].reverse(),
  });
}
