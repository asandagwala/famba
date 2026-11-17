import { balanceOf, newId, transact, type SupplierPayment } from "@/lib/famba/db";
import { getRates, round } from "@/lib/famba/rates";
import { isTxHash, verifyUsdcTransfer } from "@/lib/famba/chain";
import { HttpError } from "@/lib/famba/http";

// POST /api/suppliers/pay { supplierId, usdcAmount, note, txHash? } — pay a supplier in another country
export async function POST(request: Request) {
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const usdcAmount = Number(b?.usdcAmount);
  const note = typeof b?.note === "string" ? b.note.trim().slice(0, 160) : "";
  if (!(usdcAmount > 0)) return Response.json({ error: "Enter an amount above zero." }, { status: 400 });
  if (b?.txHash !== undefined && !isTxHash(b.txHash))
    return Response.json({ error: "Invalid transaction hash." }, { status: 400 });
  const txHash = b?.txHash as string | undefined;
  const { rates } = await getRates();
  try {
    const payment = await transact(async (db) => {
      const s = db.suppliers.find((x) => x.id === b?.supplierId);
      if (!s) throw new HttpError(404, "Supplier not found.");
      if (txHash) {
        const v = await verifyUsdcTransfer(txHash, s.walletAddress, usdcAmount);
        if (!v.ok) throw new HttpError(422, v.reason);
      } else {
        const available = balanceOf(db).available;
        if (usdcAmount > available + 1e-9)
          throw new HttpError(422, `Not enough balance. You have ${available.toFixed(2)} USDC available.`);
      }
      const p: SupplierPayment = {
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
      db.supplierPayments.push(p);
      return p;
    });
    return Response.json({ payment }, { status: 201 });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Couldn't reach Base Sepolia. Try again." }, { status: 502 });
  }
}
