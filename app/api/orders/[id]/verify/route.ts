import { FambaError, getOrder, markOrderPaid } from "@/lib/famba/db";
import { isTxHash, verifyUsdcTransfer } from "@/lib/famba/chain";

// POST /api/orders/:id/verify { txHash } — check the USDC transfer on Base Sepolia, then mark paid
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await request.json().catch(() => null)) as { txHash?: unknown } | null;
  if (!isTxHash(b?.txHash)) return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
  const txHash = b.txHash;

  const { order, merchant } = await getOrder(id);
  if (!order || !merchant) return Response.json({ error: "Order not found." }, { status: 404 });
  if (order.status === "PAID") return Response.json({ order });

  let v: Awaited<ReturnType<typeof verifyUsdcTransfer>>;
  try {
    v = await verifyUsdcTransfer(txHash, merchant.walletAddress, order.usdcAmount);
  } catch {
    return Response.json({ error: "Couldn't reach Base Sepolia. Try again." }, { status: 502 });
  }
  if (!v.ok) return Response.json({ error: v.reason }, { status: 422 });

  try {
    const paid = await markOrderPaid({
      orderId: id,
      paidAt: new Date().toISOString(),
      mode: "onchain",
      txHash,
      payer: v.from,
      paidWith: { method: "usdc_wallet", provider: "USDC wallet", currency: "ZAR", amount: order.amountZar },
    });
    return Response.json({ order: paid });
  } catch (e) {
    if (e instanceof FambaError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
