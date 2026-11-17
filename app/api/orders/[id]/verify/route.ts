import { transact } from "@/lib/famba/db";
import { isTxHash, verifyUsdcTransfer } from "@/lib/famba/chain";
import { HttpError } from "@/lib/famba/http";

// POST /api/orders/:id/verify { txHash } — check the USDC transfer on Base Sepolia, then mark paid
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => null)) as { txHash?: unknown } | null;
  if (!isTxHash(b?.txHash)) return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
  const txHash = b.txHash;
  try {
    const order = await transact(async (db) => {
      const o = db.orders.find((x) => x.id === id);
      if (!o) throw new HttpError(404, "Order not found.");
      if (o.status === "PAID") return o;
      if (db.orders.some((x) => x.txHash?.toLowerCase() === txHash.toLowerCase()))
        throw new HttpError(409, "That transaction was already used for another order.");
      const v = await verifyUsdcTransfer(txHash, db.merchant.walletAddress, o.usdcAmount);
      if (!v.ok) throw new HttpError(422, v.reason);
      Object.assign(o, { status: "PAID", paidAt: new Date().toISOString(), txHash, payer: v.from, mode: "onchain" });
      return o;
    });
    return Response.json({ order });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Couldn't reach Base Sepolia. Try again." }, { status: 502 });
  }
}
