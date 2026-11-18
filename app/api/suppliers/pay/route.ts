import { addSupplierPayment, FambaError, newId, readDb, type SupplierPayment } from "@/lib/famba/db";
import { getRates, round } from "@/lib/famba/rates";
import { isTxHash, verifyUsdcTransfer } from "@/lib/famba/chain";

// POST /api/suppliers/pay { supplierId, usdcAmount, note, txHash? } — pay a supplier in another country
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const usdcAmount = Number(b?.usdcAmount);
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 160) : "";
  if (!(usdcAmount > 0)) return Response.json({ error: "Enter an amount above zero." }, { status: 400 });
  if (b?.txHash !== undefined && !isTxHash(b.txHash))
    return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
  const txHash = b?.txHash as string | undefined;

  const [db, { rates }] = await Promise.all([readDb(), getRates()]);
  const s = db.suppliers.find((x) => x.id === b?.supplierId);
  if (!s) return Response.json({ error: "Supplier not found." }, { status: 404 });

  if (txHash) {
    try {
      const v = await verifyUsdcTransfer(txHash, s.walletAddress, usdcAmount);
      if (!v.ok) return Response.json({ error: v.reason }, { status: 422 });
    } catch {
      return Response.json({ error: "Couldn't reach Base Sepolia. Try again." }, { status: 502 });
    }
  }

  const payment: SupplierPayment = {
    id: newId("spay"),
    supplierId: s.id,
    supplierName: s.name,
    usdcAmount: round(usdcAmount, 2),
    localAmount: round(usdcAmount * rates[s.currency]),
    currency: s.currency,
    note: note || `Payment to ${s.name}`,
    createdAt: new Date().toISOString(),
    txHash,
    mode: txHash ? "onchain" : "demo",
  };
  try {
    // With a tx hash it was paid from the merchant's own wallet; otherwise it comes out of the Famba balance.
    await addSupplierPayment(payment, !txHash);
  } catch (e) {
    if (e instanceof FambaError) return Response.json({ error: e.message }, { status: 422 });
    throw e;
  }
  return Response.json({ payment }, { status: 201 });
}
