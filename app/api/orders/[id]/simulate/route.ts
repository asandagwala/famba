import { transact } from "@/lib/famba/db";

// POST /api/orders/:id/simulate — demo payment for people without a testnet wallet
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const order = await transact((db) => {
    const o = db.orders.find((x) => x.id === id);
    if (o && o.status === "PENDING") Object.assign(o, { status: "PAID", paidAt: new Date().toISOString(), mode: "demo" });
    return o;
  });
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  return Response.json({ order });
}
