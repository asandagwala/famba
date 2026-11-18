import { getOrder } from "@/lib/famba/db";
import { getRates } from "@/lib/famba/rates";

// GET /api/orders/:id — public checkout data
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const [{ order, merchant }, rates] = await Promise.all([getOrder(id), getRates()]);
  if (!order || !merchant) return Response.json({ error: "This payment link doesn't exist." }, { status: 404 });
  const { name, city, walletAddress } = merchant;
  return Response.json({ order, merchant: { name, city, walletAddress }, rates: rates.rates, rateSource: rates.source });
}
