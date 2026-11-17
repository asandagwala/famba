import { readDb } from "@/lib/famba/db";
import { getRates } from "@/lib/famba/rates";

// GET /api/orders/:id — public checkout data
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [db, rates] = await Promise.all([readDb(), getRates()]);
  const order = db.orders.find((o) => o.id === id);
  if (!order) return Response.json({ error: "This payment link doesn't exist." }, { status: 404 });
  const { name, city, walletAddress } = db.merchant;
  return Response.json({ order, merchant: { name, city, walletAddress }, rates: rates.rates, rateSource: rates.source });
}
